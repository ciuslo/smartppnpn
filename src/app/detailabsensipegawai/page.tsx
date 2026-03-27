'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import XLSX from 'xlsx-js-style' 
// Tambahan Library PDF
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

import { 
  ArrowLeft, 
  FileSpreadsheet, 
  FileText, // Icon PDF
  User, 
  Calendar, 
  Filter,
  Clock, 
  Search, 
  ChevronDown,
  AlertCircle,
  XCircle,
  Briefcase,
  FileText as FileIcon,
  Loader2,
  UserCheck
} from 'lucide-react'
import { Toaster, toast } from 'react-hot-toast'
import { 
  format, 
  eachDayOfInterval, 
  startOfMonth, 
  endOfMonth, 
  parseISO, 
  isAfter, 
  startOfDay, 
  isSunday, 
  isSaturday,
  isBefore,
  isSameDay
} from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import dayjs from 'dayjs' 

// --- Types ---
type Profile = {
  id: string
  full_name: string
  position: string
}

type ShiftDetail = {
  shiftName: string
  checkIn: string | null
  checkOut: string | null
  lateMinutes: number
  isLate: boolean
}

type DailyRecord = {
  // Info Pegawai
  profileId: string
  profileName: string
  profilePosition: string
  
  // Info Tanggal
  date: Date
  dateStr: string
  dayName: string
  
  // Status Absensi
  status: string
  statusCode: 'H' | '2x' | 'T' | '2T¹' | '2T²' | 'A' | 'I' | 'C' | 'S' | '½' | '-' | 'Libur'
  shifts: ShiftDetail[] 
  notes: string 
  color: string
}

export default function DetailAbsensiPegawaiPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // --- Filter State ---
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string>('') // Kosong = Semua Pegawai
  
  const [searchTerm, setSearchTerm] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Filter Tipe: daily (default), monthly, custom
  const [filterType, setFilterType] = useState<'daily' | 'monthly' | 'custom'>('daily')
  
  // State Waktu
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd')) // Untuk Harian
  const [month, setMonth] = useState<number>(new Date().getMonth()) 
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))

  // --- Data State ---
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([])
  
  const [stats, setStats] = useState({
    tepatWaktu: 0, 
    telat: 0,      
    izin: 0,
    cuti: 0,
    alpha: 0,
    totalLateMinutes: 0
  })

  // 1. Load Daftar Pegawai
  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, position')
        .neq('role', 'admin')
        .neq('is_admin', true)
        .order('full_name')
      
      if (data) setProfiles(data)
    }
    fetchProfiles()
  }, [])

  // Close dropdown logic
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProfiles = profiles.filter(p => 
    p.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 2. Fetch Data Utama
  const fetchData = async () => {
    setLoading(true)

    try {
      // A. Tentukan Range Tanggal
      let start: Date, end: Date
      if (filterType === 'daily') {
        start = new Date(selectedDate)
        end = new Date(selectedDate)
      } else if (filterType === 'monthly') {
        start = startOfMonth(new Date(year, month))
        end = endOfMonth(new Date(year, month))
      } else {
        if (!startDate || !endDate) {
            setLoading(false)
            return
        }
        start = new Date(startDate)
        end = new Date(endDate)
      }

      const startStr = format(start, 'yyyy-MM-dd')
      const endStr = format(end, 'yyyy-MM-dd')

      // B. Tentukan Target Pegawai (Satu atau Semua)
      let targetProfiles = profiles
      if (selectedProfileId) {
        targetProfiles = profiles.filter(p => p.id === selectedProfileId)
      }

      if (targetProfiles.length === 0) {
        setLoading(false)
        return
      }

      // C. Ambil Data (Batch Fetching)
      // 1. Absensi
      let attQuery = supabase
        .from('attendances')
        .select(`
            user_id, attendance_date, shift, shift_start,
            check_in, check_out
        `)
        .gte('attendance_date', startStr)
        .lte('attendance_date', endStr)
        .order('shift', { ascending: true })
      
      if (selectedProfileId) attQuery = attQuery.eq('user_id', selectedProfileId)
      const { data: attData } = await attQuery

      // 2. Cuti
      let leaveQuery = supabase
        .from('leave_requests')
        .select('user_id, start_date, end_date, leave_type, half_day')
        .eq('status', 'Disetujui')
        .or(`start_date.lte.${endStr},end_date.gte.${startStr}`)
      
      if (selectedProfileId) leaveQuery = leaveQuery.eq('user_id', selectedProfileId)
      const { data: leaveData } = await leaveQuery

      // 3. Izin
      let permitQuery = supabase
        .from('permission_requests')
        .select('user_id, tanggal_mulai, tanggal_selesai')
        .in('status', ['Disetujui', 'Disetujui Level 1', 'Disetujui Level 2'])
        .or(`tanggal_mulai.lte.${endStr},tanggal_selesai.gte.${startStr}`)
      
      if (selectedProfileId) permitQuery = permitQuery.eq('user_id', selectedProfileId)
      const { data: permitData } = await permitQuery

      // --- PROSES DATA ---
      const days = eachDayOfInterval({ start, end })
      const today = startOfDay(new Date())
      let newStats = { tepatWaktu: 0, telat: 0, izin: 0, cuti: 0, alpha: 0, totalLateMinutes: 0 }
      const records: DailyRecord[] = []

      // Loop Hari -> Loop Pegawai (agar urut berdasarkan tanggal dulu)
      for (const day of days) {
        const dateStr = format(day, 'yyyy-MM-dd')
        const isWeekend = isSunday(day) || isSaturday(day)

        for (const profile of targetProfiles) {
            let rec: DailyRecord = {
                profileId: profile.id,
                profileName: profile.full_name,
                profilePosition: profile.position,
                date: day,
                dateStr,
                dayName: format(day, 'EEEE', { locale: idLocale }),
                status: isWeekend ? 'Libur' : '-',
                statusCode: isWeekend ? 'Libur' : '-',
                shifts: [],
                notes: '',
                color: isWeekend ? 'bg-red-50/30' : 'bg-white'
            }

            // Filter data milik pegawai ini di tanggal ini
            const dailyAtts = attData?.filter(a => a.user_id === profile.id && a.attendance_date === dateStr) || []
            
            // --- LOGIC ABSENSI ---
            if (dailyAtts.length > 0) {
                let totalLateCount = 0;

                rec.shifts = dailyAtts.map(att => {
                    let lateMins = 0;
                    let isLate = false;

                    if (att.check_in) {
                        const checkInTime = dayjs(att.check_in);
const userPos = profile.position?.toUpperCase() || '';
let lockHour = 8;
let lockMin = 0;

// Samakan persis dengan logika di Halaman Absen
if ((att.shift || '').toLowerCase().includes('pagi')) {
    if (userPos.includes('SATPAM')) {
        [lockHour, lockMin] = [7, 5]; 
    } else if (userPos.includes('CS')) {
        [lockHour, lockMin] = [7, 30];
    } else {
        [lockHour, lockMin] = [8, 0];
    }
} else {
    // Shift Malam
    if (userPos.includes('SATPAM')) {
        [lockHour, lockMin] = [18, 5];
    } else {
        [lockHour, lockMin] = [19, 0];
    }
}

const shiftLimit = checkInTime.hour(lockHour).minute(lockMin).second(0);

if (checkInTime.isAfter(shiftLimit)) {
    lateMins = checkInTime.diff(shiftLimit, 'minute');
    isLate = true;
    totalLateCount++;
    newStats.totalLateMinutes += lateMins;
}
                    }

                    return {
                        shiftName: att.shift || '-',
                        checkIn: att.check_in,
                        checkOut: att.check_out,
                        lateMinutes: lateMins,
                        isLate
                    }
                })

                // Tentukan Status Harian
                if (dailyAtts.length > 1) { 
                    if (totalLateCount === 0) {
                        rec.status = 'Hadir (2x)'
                        rec.statusCode = '2x'
                        rec.color = 'bg-green-50 border-l-4 border-green-500'
                        newStats.tepatWaktu++ 
                    } else if (totalLateCount === 1) {
                        rec.status = '2 Shift (1 Telat)'
                        rec.statusCode = '2T¹'
                        rec.color = 'bg-yellow-50 border-l-4 border-yellow-500'
                        newStats.telat++ 
                    } else {
                        rec.status = '2 Shift (2 Telat)'
                        rec.statusCode = '2T²'
                        rec.color = 'bg-yellow-100 border-l-4 border-yellow-600'
                        newStats.telat++ 
                    }
                } else {
                    if (totalLateCount > 0) {
                        rec.status = 'Terlambat (T)'
                        rec.statusCode = 'T'
                        rec.color = 'bg-yellow-50 border-l-4 border-yellow-400'
                        newStats.telat++ 
                    } else {
                        rec.status = 'Hadir (H)'
                        rec.statusCode = 'H'
                        rec.color = 'bg-green-50 border-l-4 border-green-400'
                        newStats.tepatWaktu++ 
                    }
                }

            // --- LOGIC CUTI ---
            } else if (leaveData?.some(l => {
                const s = parseISO(l.start_date); const e = parseISO(l.end_date);
                return l.user_id === profile.id && (isAfter(day, s) || isSameDay(day, s)) && (isBefore(day, e) || isSameDay(day, e))
            })) {
                const l = leaveData.find(l => {
                    const s = parseISO(l.start_date); const e = parseISO(l.end_date);
                    return l.user_id === profile.id && (isAfter(day, s) || isSameDay(day, s)) && (isBefore(day, e) || isSameDay(day, e))
                })
                
                if (l?.half_day) {
                    rec.status = 'Setengah Hari'
                    rec.statusCode = '½'
                    rec.color = 'bg-purple-50 border-l-4 border-purple-400'
                } else if (l?.leave_type.toLowerCase().includes('sakit')) {
                    rec.status = 'Sakit'
                    rec.statusCode = 'S'
                    rec.color = 'bg-orange-50 border-l-4 border-orange-400'
                    newStats.cuti++
                } else {
                    rec.status = 'Cuti'
                    rec.statusCode = 'C'
                    rec.color = 'bg-blue-50 border-l-4 border-blue-400'
                    newStats.cuti++
                }
                rec.notes = l?.leave_type || ''

            // --- LOGIC IZIN ---
            } else if (permitData?.some(p => {
                const s = parseISO(p.tanggal_mulai); const e = parseISO(p.tanggal_selesai);
                return p.user_id === profile.id && (isAfter(day, s) || isSameDay(day, s)) && (isBefore(day, e) || isSameDay(day, e))
            })) {
                rec.status = 'Izin'
                rec.statusCode = 'I'
                rec.color = 'bg-orange-50 border-l-4 border-orange-400'
                newStats.izin++

            // --- LOGIC ALPHA ---
            } else if (!isWeekend && isAfter(today, day)) {
                rec.status = 'Alpha'
                rec.statusCode = 'A'
                rec.color = 'bg-red-50 border-l-4 border-red-500'
                newStats.alpha++
            }

            records.push(rec)
        }
      }

      setDailyRecords(records)
      setStats(newStats)

    } catch (err) {
      console.error(err)
      toast.error("Gagal memuat data")
    } finally {
      setLoading(false)
    }
  }

  // Effect: Jalankan fetchData setiap filter berubah
  useEffect(() => {
    if (profiles.length > 0) {
        fetchData()
    }
  }, [profiles, selectedProfileId, month, year, startDate, endDate, filterType, selectedDate])


  // --- 3. EXPORT EXCEL ---
  const exportExcel = () => {
    if (dailyRecords.length === 0) return toast.error("Data kosong")

    const periodStr = filterType === 'daily' 
        ? format(new Date(selectedDate), 'dd MMMM yyyy', { locale: idLocale }) 
        : filterType === 'monthly'
        ? format(new Date(year, month), 'MMMM yyyy', { locale: idLocale })
        : `${format(new Date(startDate), 'dd MMM')} - ${format(new Date(endDate), 'dd MMM yyyy')}`

    const title = selectedProfileId 
        ? `DETAIL_${dailyRecords[0]?.profileName || 'PEGAWAI'}_${periodStr}`
        : `REKAP_SEMUA_PEGAWAI_${periodStr}`

    // -- STYLES --
    const borderStyle = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    
    const headerStyle = {
        fill: { fgColor: { rgb: "2F3E46" } }, 
        font: { color: { rgb: "FFFFFF" }, bold: true, sz: 11 },
        alignment: { horizontal: "center", vertical: "center" },
        border: borderStyle
    }
    
    const cellCenter = { alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: borderStyle }
    const cellLeft = { alignment: { horizontal: "left", vertical: "center", wrapText: true }, border: borderStyle }

    // Mapping warna status
    const statusStyles: Record<string, any> = {
        'H': { fill: { fgColor: { rgb: "C6EFCE" } }, font: { color: { rgb: "006100" }, bold: true } }, 
        '2x': { fill: { fgColor: { rgb: "C6EFCE" } }, font: { color: { rgb: "006100" }, bold: true } },
        'T': { fill: { fgColor: { rgb: "FFEB9C" } }, font: { color: { rgb: "9C5700" }, bold: true } }, 
        'A': { fill: { fgColor: { rgb: "FFC7CE" } }, font: { color: { rgb: "9C0006" }, bold: true } }, 
        'S': { fill: { fgColor: { rgb: "FFD9B3" } }, font: { color: { rgb: "804000" }, bold: true } }, 
        'C': { fill: { fgColor: { rgb: "BDD7EE" } }, font: { color: { rgb: "1F4E78" }, bold: true } }, 
        'I': { fill: { fgColor: { rgb: "FFE699" } }, font: { color: { rgb: "806000" }, bold: true } },
    }

    const ws_data: any[][] = []
    
    // Header Row
    ws_data.push([
        { v: "No", s: headerStyle },
        { v: "Tanggal", s: headerStyle },
        { v: "Nama Pegawai", s: headerStyle },
        { v: "Jabatan", s: headerStyle },
        { v: "Kode", s: headerStyle },
        { v: "Status", s: headerStyle },
        { v: "Shift", s: headerStyle },
        { v: "Masuk", s: headerStyle },
        { v: "Pulang", s: headerStyle },
        { v: "Keterangan", s: headerStyle }
    ])

    // Data Rows
    dailyRecords.forEach((rec, idx) => {
        const shiftNames = rec.shifts.map(s => s.shiftName).join('\n')
        const checkIns = rec.shifts.map(s => s.checkIn ? format(new Date(s.checkIn), 'HH:mm') : '-').join('\n')
        const checkOuts = rec.shifts.map(s => s.checkOut ? format(new Date(s.checkOut), 'HH:mm') : '-').join('\n')
        
        const ketStr = rec.shifts.map(s => s.isLate ? 'Terlambat' : (s.checkIn ? 'Tepat Waktu' : '-')).join('\n')
        
        let codeStyle: any = cellCenter
        if (statusStyles[rec.statusCode]) {
            codeStyle = { ...cellCenter, ...statusStyles[rec.statusCode] }
        } else if (rec.status === 'Libur' || rec.dateStr.includes('Sabtu') || rec.dateStr.includes('Minggu')) {
             codeStyle = { ...cellCenter, fill: { fgColor: { rgb: "EEEEEE" } } }
        }

        ws_data.push([
            { v: idx + 1, s: cellCenter },
            { v: rec.dateStr, s: cellCenter },
            { v: rec.profileName, s: cellLeft },
            { v: rec.profilePosition, s: cellLeft },
            { v: rec.statusCode, s: codeStyle }, 
            { v: rec.status, s: cellLeft },     
            { v: shiftNames, s: cellCenter },
            { v: checkIns, s: cellCenter },
            { v: checkOuts, s: cellCenter },
            { v: rec.notes || ketStr, s: cellLeft }
        ])
    })
    
    // Judul
    const finalData = [
        [{ v: "REKAPITULASI ABSENSI PPNPN DAN CS ", s: { font: { bold: true, sz: 14 } } }],
        [{ v: `PERIODE: ${periodStr}`, s: { font: { bold: true } } }],
        [], 
        ...ws_data
    ]

    const ws = XLSX.utils.aoa_to_sheet([])
    XLSX.utils.sheet_add_aoa(ws, finalData, { origin: "A1" })

    ws['!cols'] = [
        {wch: 5}, {wch: 12}, {wch: 25}, {wch: 20}, {wch: 8}, {wch: 20}, {wch: 10}, {wch: 10}, {wch: 10}, {wch: 30}
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Data")
    XLSX.writeFile(wb, `${title}.xlsx`)
    toast.success("Excel Berhasil Diunduh")
  }

  // --- 4. EXPORT PDF ---
  const exportPDF = () => {
    if (dailyRecords.length === 0) return toast.error("Data kosong")

    const periodStr = filterType === 'daily' 
        ? format(new Date(selectedDate), 'dd MMMM yyyy', { locale: idLocale }) 
        : filterType === 'monthly'
        ? format(new Date(year, month), 'MMMM yyyy', { locale: idLocale })
        : `${format(new Date(startDate), 'dd MMM')} - ${format(new Date(endDate), 'dd MMM yyyy')}`

    const doc = new jsPDF('landscape')

    doc.setFontSize(14)
    doc.text("REKAPITULASI ABSENSI PPNPN DAN CS", 14, 15)
    doc.setFontSize(10)
    doc.text(`PERIODE: ${periodStr}`, 14, 22)

    const tableHead = [
        ["No", "Tanggal", "Nama", "Jabatan", "Shift", "Masuk", "Pulang", "Status", "Ket."]
    ]

    const tableBody = dailyRecords.map((rec, idx) => {
        const shiftNames = rec.shifts.map(s => s.shiftName).join('\n')
        const checkIns = rec.shifts.map(s => s.checkIn ? format(new Date(s.checkIn), 'HH:mm') : '-').join('\n')
        const checkOuts = rec.shifts.map(s => s.checkOut ? format(new Date(s.checkOut), 'HH:mm') : '-').join('\n')
        const ketStr = rec.notes || rec.shifts.map(s => s.isLate ? 'Terlambat' : (s.checkIn ? 'Tepat Waktu' : '-')).join('\n')

        return [
            idx + 1,
            rec.dateStr,
            rec.profileName,
            rec.profilePosition,
            shiftNames || '-',
            checkIns || '-',
            checkOuts || '-',
            rec.status,
            ketStr
        ]
    })

    autoTable(doc, {
        startY: 28,
        head: tableHead,
        body: tableBody,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [47, 62, 70] },
        columnStyles: {
            2: { cellWidth: 40 }, // Nama
            3: { cellWidth: 25 }, // Jabatan
            7: { cellWidth: 20, fontStyle: 'bold' }
        },
        // Warnai baris berdasarkan status
        didParseCell: function(data: any) {
            if (data.section === 'body') {
                const status = data.row.raw[7]
                if (status === 'Alpha') data.cell.styles.fillColor = [255, 200, 200]
                else if (status.includes('Terlambat')) data.cell.styles.fillColor = [255, 250, 200]
                else if (status.includes('Hadir')) data.cell.styles.fillColor = [220, 255, 220]
            }
        }
    })

    doc.save(`Rekap_${periodStr}.pdf`)
    toast.success("PDF Berhasil Diunduh")
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans text-xs sm:text-sm">
      <Toaster position="top-center" />
      
      {/* --- HEADER --- */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4 w-full">
            <button 
                onClick={() => router.push('/dashboardadmin')}
                className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
            >
              <ArrowLeft className="w-5 h-5"/>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Detail Absensi PPNPN DAN CS</h1>
              <p className="text-gray-500 text-xs">Monitoring Individu & Harian</p>
            </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
            <button 
                onClick={exportPDF} 
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition flex-1 md:flex-none justify-center"
            >
                <FileIcon className="w-4 h-4"/> Export PDF
            </button>
            <button 
                onClick={exportExcel} 
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition flex-1 md:flex-none justify-center"
            >
                <FileSpreadsheet className="w-4 h-4"/> Export Excel
            </button>
        </div>
      </div>

      {/* --- FILTER CONTROL --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        
        {/* Pilih Pegawai (Opsional) */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100" ref={dropdownRef}>
            <label className="text-xs font-bold text-blue-800 flex items-center gap-2 mb-2">
                <User className="w-4 h-4"/> PEGAWAI (Opsional)
            </label>
            <div className="relative">
                <div 
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium flex items-center justify-between cursor-pointer focus-within:ring-2 focus-within:ring-blue-500"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                    <input 
                        type="text"
                        placeholder="Semua Pegawai"
                        className="bg-transparent outline-none w-full cursor-pointer placeholder:text-gray-500 font-semibold"
                        value={selectedProfileId ? searchTerm : "Semua Pegawai"}
                        // Logic untuk memungkinkan typing search
                        onChange={(e) => {
                            setSearchTerm(e.target.value)
                            if (selectedProfileId) setSelectedProfileId('') // Reset selection jika mulai mengetik
                            setIsDropdownOpen(true)
                        }}
                        onClick={() => {
                            if (!isDropdownOpen) setIsDropdownOpen(true)
                        }}
                        onFocus={() => {
                            // Saat fokus, jika "Semua Pegawai", kosongkan agar user bisa ketik
                            if (!selectedProfileId) setSearchTerm('')
                            setIsDropdownOpen(true)
                        }}
                    />
                    <ChevronDown className="w-4 h-4 text-gray-400"/>
                </div>

                {isDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                        <div 
                            className={`p-2.5 text-xs hover:bg-blue-50 cursor-pointer font-bold text-blue-700`}
                            onClick={() => {
                                setSelectedProfileId('')
                                setSearchTerm('')
                                setIsDropdownOpen(false)
                            }}
                        >
                            Semua Pegawai
                        </div>
                        {filteredProfiles.map(p => (
                            <div 
                                key={p.id} 
                                className={`p-2.5 text-xs hover:bg-blue-50 cursor-pointer ${p.id === selectedProfileId ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700'}`}
                                onClick={() => {
                                    setSelectedProfileId(p.id)
                                    setSearchTerm(p.full_name)
                                    setIsDropdownOpen(false)
                                }}
                            >
                                {p.full_name}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* Tipe Filter */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100">
            <label className="text-xs font-bold text-blue-800 flex items-center gap-2 mb-3">
                <Filter className="w-4 h-4"/> TIPE PERIODE
            </label>
            <div className="flex bg-gray-100 p-1 rounded-lg gap-1">
                <button 
                    onClick={() => setFilterType('daily')}
                    className={`flex-1 py-1.5 text-[10px] sm:text-xs font-bold rounded-md transition ${filterType === 'daily' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Harian
                </button>
                <button 
                    onClick={() => setFilterType('monthly')}
                    className={`flex-1 py-1.5 text-[10px] sm:text-xs font-bold rounded-md transition ${filterType === 'monthly' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Bulanan
                </button>
                <button 
                    onClick={() => setFilterType('custom')}
                    className={`flex-1 py-1.5 text-[10px] sm:text-xs font-bold rounded-md transition ${filterType === 'custom' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Custom
                </button>
            </div>
        </div>

        {/* Tanggal */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100">
            <label className="text-xs font-bold text-blue-800 flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4"/> ATUR TANGGAL
            </label>
            {filterType === 'daily' ? (
                <input 
                    type="date" 
                    value={selectedDate} 
                    onChange={(e) => setSelectedDate(e.target.value)} 
                    className="w-full p-2.5 bg-gray-50 border rounded-lg text-xs" 
                />
            ) : filterType === 'monthly' ? (
                <div className="flex gap-2">
                    <div className="relative w-full">
                        <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="w-full p-2.5 bg-gray-50 border rounded-lg appearance-none cursor-pointer">
                            {Array.from({length: 12}, (_, i) => <option key={i} value={i}>{format(new Date(2023, i), 'MMMM', { locale: idLocale })}</option>)}
                        </select>
                        <div className="absolute right-3 top-3 pointer-events-none text-gray-400 text-xs">▼</div>
                    </div>
                    <div className="relative w-24">
                        <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="w-full p-2.5 bg-gray-50 border rounded-lg appearance-none cursor-pointer">
                            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <div className="absolute right-2 top-3 pointer-events-none text-gray-400 text-xs">▼</div>
                    </div>
                </div>
            ) : (
                <div className="flex gap-2 items-center">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 bg-gray-50 border rounded-lg text-xs" />
                    <span className="text-gray-400 font-bold">-</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 bg-gray-50 border rounded-lg text-xs" />
                </div>
            )}
        </div>
      </div>

      {/* --- STATS SUMMARY --- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {/* Card Total */}
        <div className="bg-blue-700 p-4 rounded-xl border border-blue-800 text-white shadow-md relative overflow-hidden group">
            <div className="absolute right-[-10px] top-[-10px] opacity-10"><Briefcase className="w-16 h-16" /></div>
            <p className="text-[10px] font-bold opacity-80 mb-1 tracking-wider uppercase">Total Kehadiran</p>
            <span className="text-3xl font-extrabold">{stats.tepatWaktu + stats.telat}</span>
            <span className="text-[10px] block opacity-80 mt-1">Hari Masuk Kerja</span>
        </div>
        {/* Card Tepat Waktu */}
        <div className="bg-green-100 p-4 rounded-xl border border-green-300 text-green-800 relative overflow-hidden">
           <div className="absolute right-2 top-2 opacity-20"><UserCheck className="w-8 h-8" /></div>
           <p className="text-[10px] font-bold opacity-70 mb-1 tracking-wider uppercase">Tepat Waktu</p>
           <span className="text-2xl font-bold">{stats.tepatWaktu}</span>
        </div>
        {/* Card Terlambat */}
        <div className="bg-yellow-100 p-4 rounded-xl border border-yellow-300 text-yellow-800 relative overflow-hidden">
           <div className="absolute right-2 top-2 opacity-20"><Clock className="w-8 h-8" /></div>
           <p className="text-[10px] font-bold opacity-70 mb-1 tracking-wider uppercase">Terlambat</p>
           <span className="text-2xl font-bold">{stats.telat}</span>
        </div>
        {/* Card Alpha */}
        <div className="bg-red-100 p-4 rounded-xl border border-red-200 text-red-800 relative overflow-hidden">
           <div className="absolute right-2 top-2 opacity-20"><XCircle className="w-8 h-8" /></div>
           <p className="text-[10px] font-bold opacity-70 mb-1 tracking-wider uppercase">Alpha</p>
           <span className="text-2xl font-bold">{stats.alpha}</span>
        </div>
        {/* Card Cuti/Sakit */}
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-blue-800 relative overflow-hidden">
           <div className="absolute right-2 top-2 opacity-20"><FileText className="w-8 h-8" /></div>
           <p className="text-[10px] font-bold opacity-70 mb-1 tracking-wider uppercase">Cuti / Sakit</p>
           <span className="text-2xl font-bold">{stats.cuti}</span>
        </div>
        {/* Card Izin */}
        <div className="bg-orange-100 p-4 rounded-xl border border-orange-200 text-orange-800 relative overflow-hidden">
           <div className="absolute right-2 top-2 opacity-20"><AlertCircle className="w-8 h-8" /></div>
           <p className="text-[10px] font-bold opacity-70 mb-1 tracking-wider uppercase">Izin</p>
           <span className="text-2xl font-bold">{stats.izin}</span>
        </div>
      </div>

      {/* --- TABLE DETAIL --- */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center bg-white rounded-xl shadow-sm">
            <Loader2 className="animate-spin w-10 h-10 text-blue-600 mb-2"/>
            <p className="text-gray-500">Memuat data absensi...</p>
        </div>
      ) : dailyRecords.length === 0 ? (
        <div className="py-20 text-center text-gray-500 border rounded-xl bg-white shadow-sm">
            <Search className="w-10 h-10 mx-auto text-gray-300 mb-2"/>
            <p>Tidak ada data untuk ditampilkan pada periode ini.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs md:text-sm">
                    <thead className="bg-slate-800 text-white">
                        <tr>
                            <th className="p-4 font-semibold w-28">Tanggal</th>
                            <th className="p-4 font-semibold">Nama Pegawai</th> 
                            <th className="p-4 font-semibold">Jabatan</th>
                            <th className="p-4 font-semibold w-24">Status</th>
                            <th className="p-4 font-semibold w-24">Shift</th>
                            <th className="p-4 font-semibold bg-slate-900 border-l border-slate-700 text-center">Masuk</th>
                            <th className="p-4 font-semibold border-l border-slate-700 text-center">Pulang</th>
                            <th className="p-4 font-semibold border-l border-slate-700">Ket.</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {dailyRecords.map((rec, idx) => (
                            <tr key={`${rec.profileId}-${idx}`} className={`hover:bg-gray-50 transition-colors ${rec.color}`}>
                                {/* Tanggal */}
                                <td className="p-4 whitespace-nowrap align-top">
                                    <div className="font-bold text-gray-800">{format(rec.date, 'dd MMM yyyy', { locale: idLocale })}</div>
                                    <div className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">{rec.dayName}</div>
                                </td>

                                {/* Nama & Jabatan (KOLOM BARU) */}
                                <td className="p-4 align-top font-medium text-gray-900">{rec.profileName}</td>
                                <td className="p-4 align-top text-gray-600">{rec.profilePosition}</td>
                                
                                {/* Status Badge */}
                                <td className="p-4 align-top">
                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border shadow-sm block w-fit
                                        ${rec.statusCode.includes('H') || rec.statusCode === '2x' ? 'bg-green-100 text-green-700 border-green-200' : 
                                          rec.statusCode.includes('T') ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                          rec.statusCode === 'A' ? 'bg-red-100 text-red-700 border-red-200' : 
                                          rec.statusCode === 'C' || rec.statusCode === 'S' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                          rec.statusCode === 'I' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                          'bg-white text-gray-500 border-gray-200'}
                                    `}>
                                        {rec.statusCode}
                                    </span>
                                    <span className="text-[10px] text-gray-400 mt-1 block">{rec.status}</span>
                                </td>

                                {/* Detail Shift (DIPISAH BARIS) */}
                                <td colSpan={4} className="p-0 align-top">
                                    {rec.shifts.length > 0 ? (
                                        <div className="divide-y divide-gray-100">
                                            {rec.shifts.map((s, i) => (
                                                <div key={i} className="grid grid-cols-4">
                                                    {/* Shift Name */}
                                                    <div className="p-4 text-gray-600 font-medium col-span-1">{s.shiftName}</div>
                                                    
                                                    {/* Masuk */}
                                                    <div className="p-4 bg-gray-50/80 border-l border-gray-100 col-span-1 text-center">
                                                        <div className="font-mono text-base font-extrabold text-slate-800">
                                                            {s.checkIn ? format(new Date(s.checkIn), 'HH:mm') : '-'}
                                                        </div>
                                                        {s.isLate && (
                                                            <div className="flex items-center justify-center gap-1 text-[10px] text-red-600 font-bold mt-1 bg-red-50 px-1.5 py-0.5 rounded w-fit mx-auto">
                                                                <AlertCircle className="w-3 h-3"/> Terlambat
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Pulang */}
                                                    <div className="p-4 border-l border-gray-100 col-span-1 text-center">
                                                        <div className="font-mono text-base font-bold text-gray-600">
                                                            {s.checkOut ? format(new Date(s.checkOut), 'HH:mm') : '-'}
                                                        </div>
                                                    </div>

                                                    {/* Keterangan */}
                                                    <div className="p-4 border-l border-gray-100 col-span-1 text-xs text-gray-500 italic">
                                                        {s.isLate ? 'Terlambat' : (s.checkIn ? 'Tepat Waktu' : '-')}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-4 text-gray-400 italic text-xs">
                                            {rec.notes || '-'}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}
    </div>
  )
}