'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import toast, { Toaster } from 'react-hot-toast'
import dayjs from 'dayjs'
import { 
  format, 
  startOfMonth, 
  endOfMonth 
} from 'date-fns'
import { id as idLocale } from 'date-fns/locale'
import { ArrowLeft, Calendar, Filter, Search } from 'lucide-react'

const StatusBadge = ({ status }: { status: string }) => {
  const styles =
    status === 'Tepat Waktu'
      ? 'bg-green-100 text-green-800'
      : status === 'Terlambat'
      ? 'bg-yellow-100 text-yellow-800'
      : 'bg-red-100 text-red-800'

  return (
    <div className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-md ${styles}`}>
      {status}
    </div>
  )
}

export default function RekapAbsensiPage() {
  const router = useRouter()
  const [attendances, setAttendances] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [userPos, setUserPos] = useState<string>('')

  // --- FILTER STATE ---
  const [filterType, setFilterType] = useState<'monthly' | 'custom'>('monthly')
  const [month, setMonth] = useState<number>(new Date().getMonth()) 
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  // FETCH DATA
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('User tidak ditemukan')
        setLoading(false)
        return
      }

      // --- 1. AMBIL DATA PROFILE ---
      const { data: profile } = await supabase
        .from('profiles')
        .select('position')
        .eq('id', user.id)
        .single()

      const currentPos = (profile?.position || '').toUpperCase()
      setUserPos(currentPos) 

      // --- 2. TENTUKAN RANGE TANGGAL ---
      let startStr = ''
      let endStr = ''

      if (filterType === 'monthly') {
        const start = startOfMonth(new Date(year, month))
        const end = endOfMonth(new Date(year, month))
        startStr = format(start, 'yyyy-MM-dd')
        endStr = format(end, 'yyyy-MM-dd')
      } else {
        if (!startDate || !endDate) {
          const start = startOfMonth(new Date())
          const end = endOfMonth(new Date())
          startStr = format(start, 'yyyy-MM-dd')
          endStr = format(end, 'yyyy-MM-dd')
        } else {
          startStr = startDate
          endStr = endDate
        }
      }

      // --- 3. QUERY DATA ABSEN ---
      let query = supabase
        .from('attendances')
        .select('*')
        .eq('user_id', user.id)
        .gte('attendance_date', startStr)
        .lte('attendance_date', endStr)
        .order('attendance_date', { ascending: false })
        .order('shift', { ascending: true })

      const { data, error } = await query
      if (error) {
        toast.error('Gagal mengambil data absensi')
        setLoading(false)
        return
      }

      // --- 4. HITUNG STATUS BERDASARKAN ATURAN JABATAN ---
      const processed = (data || []).map((att) => {
        if (!att.check_in) return { ...att, computedStatus: 'Tidak Hadir' }

        const checkInTime = dayjs(att.check_in)
        const totalMinutes = checkInTime.hour() * 60 + checkInTime.minute()

        let limitHour, limitMin

        if ((att.shift || '').toLowerCase().includes('pagi')) {
          if (currentPos.includes('SATPAM')) {
            [limitHour, limitMin] = [7, 5] // 07:05
          } else if (currentPos.includes('CS')) {
            [limitHour, limitMin] = [7, 30] // 07:30
          } else {
            [limitHour, limitMin] = [8, 0] // Umum/PPNP
          }
        } else {
          // Shift Malam
          if (currentPos.includes('SATPAM')) {
            [limitHour, limitMin] = [18, 5] // 18:05
          } else {
            [limitHour, limitMin] = [19, 0] // Malam Umum
          }
        }

        const limitInMinutes = limitHour * 60 + limitMin
        const computedStatus = totalMinutes > limitInMinutes ? 'Terlambat' : 'Tepat Waktu'

        return { ...att, computedStatus }
      })

      setAttendances(processed)
      setLoading(false)
    }

    fetchData()
  }, [filterType, month, year, startDate, endDate])

  // Statistik Kehadiran
  const stats = useMemo(() => {
    const uniqueDates = new Set(attendances.map((a) => a.attendance_date))
    const counts = { TepatWaktu: 0, Terlambat: 0, TidakHadir: 0 }

    attendances.forEach((a) => {
      if (a.computedStatus === 'Tepat Waktu') counts.TepatWaktu++
      else if (a.computedStatus === 'Terlambat') counts.Terlambat++
      else counts.TidakHadir++
    })

    return { ...counts, totalHari: uniqueDates.size }
  }, [attendances])

  const formatDateUI = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-'
    const date = new Date(timeStr)
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  const formatCoord = (lat: number | null, lon: number | null) => {
    return lat !== null && lon !== null ? `${lat.toFixed(6)}, ${lon.toFixed(6)}` : '-'
  }

  const formatDistance = (dist: number | null) => (dist !== null ? `${dist.toFixed(1)} m` : '-')

  return (
    <div className="min-h-screen bg-gray-100 font-sans pb-10">
      <Toaster position="top-center" />

      <header className="bg-blue-800 text-white p-4 shadow-md flex items-center sticky top-0 z-10">
        {mounted && (
          <button onClick={() => router.back()} className="p-2 mr-2 rounded-full hover:bg-blue-700 transition">
            <ArrowLeft className="w-6 h-6" />
          </button>
        )}
        <h1 className="text-xl font-bold">Rekap Absensi Saya</h1>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        
        {/* --- FILTER SECTION --- */}
        <section className="bg-white rounded-xl shadow-sm border border-blue-100 p-5 mb-5">
          <h2 className="text-blue-800 font-bold mb-4 text-sm flex items-center gap-2">
            <Filter className="w-4 h-4"/> FILTER PERIODE
          </h2>

          <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
             <button 
                onClick={() => setFilterType('monthly')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${filterType === 'monthly' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}
             >
                Per Bulan
             </button>
             <button 
                onClick={() => setFilterType('custom')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${filterType === 'custom' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}
             >
                Custom Tanggal
             </button>
          </div>

          {filterType === 'monthly' ? (
             <div className="flex gap-2">
                <div className="relative w-full">
                    <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg appearance-none text-sm cursor-pointer">
                        {Array.from({length: 12}, (_, i) => <option key={i} value={i}>{format(new Date(2023, i), 'MMMM', { locale: idLocale })}</option>)}
                    </select>
                    <div className="absolute right-3 top-3 pointer-events-none text-gray-400 text-xs">▼</div>
                </div>
                <div className="relative w-28">
                    <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg appearance-none text-sm cursor-pointer">
                        {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <div className="absolute right-3 top-3 pointer-events-none text-gray-400 text-xs">▼</div>
                </div>
             </div>
          ) : (
             <div className="grid grid-cols-2 gap-3">
                 <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Dari</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} 
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs" />
                 </div>
                 <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Sampai</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} 
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs" />
                 </div>
             </div>
          )}
        </section>

        {/* Statistik Kehadiran */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-4 border-b pb-2">RINGKASAN KEHADIRAN</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <span className="text-xs text-blue-600 font-semibold block">Total Hari</span>
                <span className="text-2xl font-bold text-blue-900">{stats.totalHari}</span>
            </div>
            <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                <span className="text-xs text-green-600 font-semibold block">Tepat Waktu</span>
                <span className="text-2xl font-bold text-green-900">{stats.TepatWaktu}</span>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                <span className="text-xs text-yellow-600 font-semibold block">Terlambat</span>
                <span className="text-2xl font-bold text-yellow-900">{stats.Terlambat}</span>
            </div>
            <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                <span className="text-xs text-red-600 font-semibold block">Tidak Hadir</span>
                <span className="text-2xl font-bold text-red-900">{stats.TidakHadir}</span>
            </div>
          </div>
        </section>

        {/* Riwayat Absensi */}
        <section>
          <div className="flex justify-between items-center mb-4">
             <h2 className="text-lg font-bold text-gray-800">Riwayat Harian</h2>
             <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded shadow-sm">{attendances.length} Data</span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="text-xs text-gray-500 mt-2">Memuat data...</p>
            </div>
          ) : attendances.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-xl shadow-sm border border-dashed border-gray-300">
              <Search className="w-10 h-10 text-gray-300 mx-auto mb-2"/>
              <p className="text-gray-500 text-sm">Tidak ada data absensi.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {attendances.map((att) => (
                <div key={`${att.attendance_date}-${att.shift}`} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-3 border-b border-gray-100 pb-2">
                    <div>
                        <p className="font-bold text-gray-800 text-base">{formatDateUI(att.attendance_date)}</p>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded mt-1 inline-block uppercase font-semibold">
                          Shift: {att.shift} 
                          {att.shift.toLowerCase().includes('pagi') 
                            ? ` (Batas: ${userPos.includes('SATPAM') ? '07:05' : userPos.includes('CS') ? '07:30' : '08:00'})`
                            : ` (Batas: ${userPos.includes('SATPAM') ? '18:05' : '19:00'})`
                          }
                        </span>
                    </div>
                    <StatusBadge status={att.computedStatus} />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {/* Masuk */}
                    <div className="bg-blue-50/50 p-2 rounded-lg">
                      <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Absen Masuk</p>
                      <p className="font-mono font-bold text-gray-800 text-lg">
                        {att.check_in ? formatTime(att.check_in) : '--:--'}
                      </p>
                      <div className="mt-2 text-[10px] text-gray-500 space-y-0.5">
                          <p className="line-clamp-1">{att.check_in_location || '-'}</p>
                          <p className="font-mono text-gray-400">{formatCoord(att.check_in_latitude, att.check_in_longitude)}</p>
                          <p className="font-semibold text-blue-700">Jarak: {formatDistance(att.check_in_distance_m)}</p>
                      </div>
                    </div>
                    
                    {/* Pulang */}
                    <div className="bg-orange-50/50 p-2 rounded-lg">
                      <p className="text-[10px] font-bold text-orange-600 uppercase mb-1">Absen Pulang</p>
                      <p className="font-mono font-bold text-gray-800 text-lg">
                        {att.check_out ? formatTime(att.check_out) : '--:--'}
                      </p>
                      <div className="mt-2 text-[10px] text-gray-500 space-y-0.5">
                          <p className="line-clamp-1">{att.check_out_location || '-'}</p>
                          <p className="font-mono text-gray-400">{formatCoord(att.check_out_latitude, att.check_out_longitude)}</p>
                          <p className="font-semibold text-orange-700">Jarak: {formatDistance(att.check_out_distance_m)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {mounted && (
          <div className="mt-8 pb-4">
            <button onClick={() => router.push('/dashboard')}
              className="w-full bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-transform transform hover:scale-[1.02]">
              Kembali ke Dashboard
            </button>
          </div>
        )}
      </main>
    </div>
  )
}