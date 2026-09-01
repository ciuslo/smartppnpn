'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  FileSpreadsheet,
  FileText,
  Search,
  Filter,
  RefreshCw,
  MapPin,
  Clock,
  Image as ImageIcon,
  X
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import XLSX from 'xlsx-js-style'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

type Profile = {
  id: string
  full_name: string
  position: string
}

type BusinessTrip = {
  id: string
  user_id: string
  trip_date: string
  destination: string | null
  purpose: string | null

  start_at: string | null
  start_latitude: number | null
  start_longitude: number | null
  start_photo_url: string | null

  clock_in_at: string | null
  clock_in_latitude: number | null
  clock_in_longitude: number | null
  clock_in_photo_url: string | null

  clock_out_at: string | null
  clock_out_latitude: number | null
  clock_out_longitude: number | null
  clock_out_photo_url: string | null

  end_at: string | null
  end_latitude: number | null
  end_longitude: number | null
  end_photo_url: string | null

  status: 'ongoing' | 'completed' | 'cancelled'

  created_at: string
  updated_at: string
}

type TripRow = BusinessTrip & {
  profile?: Profile
}

export default function RekapPerjalananDinasAdmin() {
  const [loading, setLoading] = useState(true)

  const [month, setMonth] = useState<number>(new Date().getMonth())
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [searchName, setSearchName] = useState('')

  const [trips, setTrips] = useState<TripRow[]>([])
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // =========================================================
  // FORMAT WAKTU
  // =========================================================

  const formatDate = (value?: string | null) => {
    if (!value) return '-'

    try {
      return format(new Date(value), 'dd-MM-yyyy')
    } catch {
      return '-'
    }
  }

  const formatDateTime = (value?: string | null) => {
    if (!value) return '-'

    try {
      return format(new Date(value), 'dd-MM-yyyy HH:mm')
    } catch {
      return '-'
    }
  }

  const formatTime = (value?: string | null) => {
    if (!value) return '-'

    try {
      return format(new Date(value), 'HH:mm')
    } catch {
      return '-'
    }
  }

  // =========================================================
  // STATUS
  // =========================================================

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ongoing':
        return 'Sedang Berjalan'

      case 'completed':
        return 'Selesai'

      case 'cancelled':
        return 'Dibatalkan'

      default:
        return status
    }
  }

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'ongoing':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'

      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'

      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200'

      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // =========================================================
  // FETCH DATA
  // =========================================================

  const fetchData = async () => {
    setLoading(true)

    try {
      const selectedDate = new Date(year, month)

      const startDate = format(
        startOfMonth(selectedDate),
        'yyyy-MM-dd'
      )

      const endDate = format(
        endOfMonth(selectedDate),
        'yyyy-MM-dd'
      )

      console.log(
        `Fetching perjalanan dinas: ${startDate} s/d ${endDate}`
      )

      // -----------------------------------------------------
      // 1. Ambil data perjalanan dinas
      // -----------------------------------------------------

      const {
        data: tripData,
        error: tripError
      } = await supabase
        .from('business_trip_attendances')
        .select(`
          id,
          user_id,
          trip_date,
          destination,
          purpose,

          start_at,
          start_latitude,
          start_longitude,
          start_photo_url,

          clock_in_at,
          clock_in_latitude,
          clock_in_longitude,
          clock_in_photo_url,

          clock_out_at,
          clock_out_latitude,
          clock_out_longitude,
          clock_out_photo_url,

          end_at,
          end_latitude,
          end_longitude,
          end_photo_url,

          status,
          created_at,
          updated_at
        `)
        .gte('trip_date', startDate)
        .lte('trip_date', endDate)
        .order('trip_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (tripError) {
        throw tripError
      }

      // -----------------------------------------------------
      // 2. Ambil profile pegawai
      // -----------------------------------------------------

      const userIds = [
        ...new Set(
          (tripData || []).map((trip: any) => trip.user_id)
        )
      ]

      let profileMap = new Map<string, Profile>()

      if (userIds.length > 0) {
        const {
          data: profileData,
          error: profileError
        } = await supabase
          .from('profiles')
          .select('id, full_name, position')
          .in('id', userIds)

        if (profileError) {
          throw profileError
        }

        profileData?.forEach((profile: Profile) => {
          profileMap.set(profile.id, profile)
        })
      }

      // -----------------------------------------------------
      // 3. Gabungkan perjalanan + profile
      // -----------------------------------------------------

      const combinedData: TripRow[] = (tripData || []).map(
        (trip: BusinessTrip) => ({
          ...trip,
          profile: profileMap.get(trip.user_id)
        })
      )

      setTrips(combinedData)

    } catch (error: any) {
      console.error('Error fetch perjalanan dinas:', error)

      toast.error(
        'Gagal mengambil data: ' +
        (error?.message || 'Unknown error')
      )

      setTrips([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [month, year])

  // =========================================================
  // SEARCH
  // =========================================================

  const filteredTrips = useMemo(() => {
    if (!searchName.trim()) {
      return trips
    }

    const keyword = searchName.toLowerCase()

    return trips.filter((trip) => {
      const name =
        trip.profile?.full_name?.toLowerCase() || ''

      const destination =
        trip.destination?.toLowerCase() || ''

      const purpose =
        trip.purpose?.toLowerCase() || ''

      return (
        name.includes(keyword) ||
        destination.includes(keyword) ||
        purpose.includes(keyword)
      )
    })
  }, [trips, searchName])

  // =========================================================
  // EXPORT EXCEL
  // =========================================================

  const exportToExcel = () => {
    if (filteredTrips.length === 0) {
      toast.error('Tidak ada data untuk diekspor.')
      return
    }

    const monthName = format(
      new Date(year, month),
      'MMMM yyyy',
      { locale: idLocale }
    )

    const header = [
      'No',
      'Tanggal',
      'Nama Pegawai',
      'Jabatan',
      'Tujuan',
      'Keperluan',
      'Start',
      'Clock In',
      'Clock Out',
      'End',
      'Status'
    ]

    const rows = filteredTrips.map((trip, index) => [
      index + 1,
      formatDate(trip.trip_date),
      trip.profile?.full_name || '-',
      trip.profile?.position || '-',
      trip.destination || '-',
      trip.purpose || '-',
      formatDateTime(trip.start_at),
      formatDateTime(trip.clock_in_at),
      formatDateTime(trip.clock_out_at),
      formatDateTime(trip.end_at),
      getStatusLabel(trip.status)
    ])

    const data = [
      ['REKAP PERJALANAN DINAS'],
      [`PERIODE: ${monthName.toUpperCase()}`],
      [],
      header,
      ...rows
    ]

    const ws = XLSX.utils.aoa_to_sheet(data)

    ws['!merges'] = [
      {
        s: { r: 0, c: 0 },
        e: { r: 0, c: header.length - 1 }
      },
      {
        s: { r: 1, c: 0 },
        e: { r: 1, c: header.length - 1 }
      }
    ]

    ws['A1'].s = {
      font: {
        bold: true,
        sz: 14
      },
      alignment: {
        horizontal: 'center'
      }
    }

    ws['A2'].s = {
      font: {
        bold: true,
        sz: 11
      },
      alignment: {
        horizontal: 'center'
      }
    }

    const headerStyle = {
      fill: {
        fgColor: {
          rgb: '1F2937'
        }
      },
      font: {
        color: {
          rgb: 'FFFFFF'
        },
        bold: true
      },
      alignment: {
        horizontal: 'center',
        vertical: 'center'
      },
      border: {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
      }
    }

    for (let col = 0; col < header.length; col++) {
      const cellAddress =
        XLSX.utils.encode_cell({
          r: 3,
          c: col
        })

      if (ws[cellAddress]) {
        ws[cellAddress].s = headerStyle
      }
    }

    ws['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 28 },
      { wch: 22 },
      { wch: 25 },
      { wch: 35 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 18 }
    ]

    const wb = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(
      wb,
      ws,
      'Perjalanan Dinas'
    )

    XLSX.writeFile(
      wb,
      `Rekap_Perjalanan_Dinas_${format(
        new Date(year, month),
        'MMMM_yyyy',
        { locale: idLocale }
      )}.xlsx`
    )

    toast.success('Excel berhasil didownload!')
  }

  // =========================================================
  // EXPORT PDF
  // =========================================================

  const exportToPDF = () => {
    if (filteredTrips.length === 0) {
      toast.error('Tidak ada data untuk diekspor.')
      return
    }

    const doc = new jsPDF(
      'landscape',
      'mm',
      'a4'
    )

    const monthName = format(
      new Date(year, month),
      'MMMM yyyy',
      { locale: idLocale }
    )

    doc.setFontSize(14)

    doc.text(
      'REKAP PERJALANAN DINAS',
      14,
      15
    )

    doc.setFontSize(10)

    doc.text(
      `PERIODE: ${monthName.toUpperCase()}`,
      14,
      22
    )

    const head = [
      [
        'No',
        'Tanggal',
        'Nama',
        'Jabatan',
        'Tujuan',
        'Keperluan',
        'Start',
        'Clock In',
        'Clock Out',
        'End',
        'Status'
      ]
    ]

    const body = filteredTrips.map(
      (trip, index) => [
        index + 1,
        formatDate(trip.trip_date),
        trip.profile?.full_name || '-',
        trip.profile?.position || '-',
        trip.destination || '-',
        trip.purpose || '-',
        formatDateTime(trip.start_at),
        formatDateTime(trip.clock_in_at),
        formatDateTime(trip.clock_out_at),
        formatDateTime(trip.end_at),
        getStatusLabel(trip.status)
      ]
    )

    autoTable(doc, {
      startY: 28,
      head,
      body,
      theme: 'grid',

      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        valign: 'middle'
      },

      headStyles: {
        fillColor: [31, 41, 55],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center'
      },

      columnStyles: {
        0: {
          cellWidth: 8,
          halign: 'center'
        },
        1: {
          cellWidth: 18,
          halign: 'center'
        },
        2: {
          cellWidth: 30
        },
        3: {
          cellWidth: 25
        },
        4: {
          cellWidth: 25
        },
        5: {
          cellWidth: 35
        },
        6: {
          cellWidth: 24,
          halign: 'center'
        },
        7: {
          cellWidth: 24,
          halign: 'center'
        },
        8: {
          cellWidth: 24,
          halign: 'center'
        },
        9: {
          cellWidth: 24,
          halign: 'center'
        },
        10: {
          cellWidth: 22,
          halign: 'center'
        }
      },

      didParseCell: (data: any) => {
        if (
          data.section === 'body' &&
          data.column.index === 10
        ) {
          const status =
            filteredTrips[data.row.index]?.status

          if (status === 'completed') {
            data.cell.styles.fillColor = [
              220,
              252,
              231
            ]

            data.cell.styles.textColor = [
              22,
              101,
              52
            ]
          }

          if (status === 'ongoing') {
            data.cell.styles.fillColor = [
              254,
              249,
              195
            ]

            data.cell.styles.textColor = [
              133,
              77,
              14
            ]
          }

          if (status === 'cancelled') {
            data.cell.styles.fillColor = [
              254,
              226,
              226
            ]

            data.cell.styles.textColor = [
              153,
              27,
              27
            ]
          }
        }
      }
    })

    doc.save(
      `Rekap_Perjalanan_Dinas_${format(
        new Date(year, month),
        'MMMM_yyyy',
        { locale: idLocale }
      )}.pdf`
    )

    toast.success('PDF berhasil didownload!')
  }

  // =========================================================
  // RENDER
  // =========================================================

  const monthName = format(
    new Date(year, month),
    'MMMM yyyy',
    { locale: idLocale }
  )

  const PhotoButton = ({
  photoUrl,
  title,
  color = 'text-blue-600'
}: {
  photoUrl?: string | null
  title: string
  color?: string
}) => {
  if (!photoUrl) return null

  return (
    <button
      onClick={() => setPreviewImage(photoUrl)}
      className={`mt-1 flex items-center justify-center mx-auto ${color} hover:opacity-70 transition`}
      title={title}
    >
      <ImageIcon className="w-5 h-5" />
    </button>
  )
}

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans text-xs sm:text-sm">

      <Toaster position="top-center" />

      {/* HEADER */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4 space-y-4">

        <div className="flex flex-col md:flex-row justify-between items-center gap-4">

          <div className="flex items-center gap-3 w-full md:w-auto">

            <div className="bg-blue-100 p-2 rounded-lg">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>

            <div>
              <h1 className="text-lg font-bold uppercase text-gray-800">
                Rekap Perjalanan Dinas
              </h1>

              <p className="text-gray-500 text-xs">
                Periode: {monthName}
              </p>
            </div>

          </div>

          <div className="flex gap-2 w-full md:w-auto">

            <Button
              onClick={exportToPDF}
              className="bg-red-600 hover:bg-red-700 text-white w-full md:w-auto gap-2"
            >
              <FileText className="w-4 h-4" />
              PDF
            </Button>

            <Button
              onClick={exportToExcel}
              className="bg-green-600 hover:bg-green-700 text-white w-full md:w-auto gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </Button>

          </div>

        </div>

        {/* FILTER */}
        <div className="flex flex-wrap gap-3 items-center bg-gray-50 p-3 rounded-md border border-gray-100">

          <div className="relative">

            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

            <input
              type="text"
              placeholder="Cari pegawai, tujuan, keperluan..."
              value={searchName}
              onChange={(e) =>
                setSearchName(e.target.value)
              }
              className="pl-9 pr-3 py-2 border rounded-md text-sm w-full md:w-80 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />

          </div>

          <div className="flex gap-2">

            <select
              value={month}
              onChange={(e) =>
                setMonth(parseInt(e.target.value))
              }
              className="border p-2 rounded-md text-sm bg-white cursor-pointer"
            >
              {Array.from(
                { length: 12 },
                (_, i) => (
                  <option key={i} value={i}>
                    {format(
                      new Date(year, i),
                      'MMMM',
                      { locale: idLocale }
                    )}
                  </option>
                )
              )}
            </select>

            <select
              value={year}
              onChange={(e) =>
                setYear(parseInt(e.target.value))
              }
              className="border p-2 rounded-md text-sm bg-white cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map(
                (y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                )
              )}
            </select>

          </div>

          <Button
            size="sm"
            onClick={fetchData}
            variant="secondary"
            className="border gap-2"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </Button>

          <div className="ml-auto text-xs text-gray-500">
            Total perjalanan: <b>{filteredTrips.length}</b>
          </div>

        </div>

      </div>

      {/* CONTENT */}
      {loading ? (

        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg shadow-sm h-64">

          <Loader2 className="animate-spin text-blue-600 w-8 h-8 mb-2" />

          <p className="text-gray-500">
            Memuat data perjalanan dinas...
          </p>

        </div>

      ) : filteredTrips.length === 0 ? (

        <div className="text-center py-20 bg-white rounded-lg shadow-sm text-gray-500">

          Tidak ada data perjalanan dinas pada periode ini.

        </div>

      ) : (

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto pb-2">

          <table className="w-full border-collapse text-center text-[11px] md:text-xs min-w-[1400px]">

            <thead>

              <tr className="bg-gray-800 text-white font-semibold">

                <th className="border border-gray-600 p-2 w-[50px]">
                  No
                </th>

                <th className="border border-gray-600 p-2 min-w-[120px]">
                  Tanggal
                </th>

                <th className="border border-gray-600 p-2 min-w-[200px] text-left">
                  Nama Pegawai
                </th>

                <th className="border border-gray-600 p-2 min-w-[150px]">
                  Jabatan
                </th>

                <th className="border border-gray-600 p-2 min-w-[180px]">
                  Tujuan
                </th>

                <th className="border border-gray-600 p-2 min-w-[250px]">
                  Keperluan
                </th>

                <th className="border border-gray-600 p-2 min-w-[130px]">
                  START
                </th>

                <th className="border border-gray-600 p-2 min-w-[130px]">
                  CLOCK IN
                </th>

                <th className="border border-gray-600 p-2 min-w-[130px]">
                  CLOCK OUT
                </th>

                <th className="border border-gray-600 p-2 min-w-[130px]">
                  END
                </th>

                <th className="border border-gray-600 p-2 min-w-[130px]">
                  STATUS
                </th>

                <th className="border border-gray-600 p-2 min-w-[130px]">
                  AKSI
                </th>

              </tr>

            </thead>

            <tbody>

              {filteredTrips.map(
                (trip, index) => (

                  <tr
                    key={trip.id}
                    className="hover:bg-gray-50 transition-colors"
                  >

                    <td className="border border-gray-300 p-2">
                      {index + 1}
                    </td>

                    <td className="border border-gray-300 p-2">
                      {formatDate(trip.trip_date)}
                    </td>

                    <td className="border border-gray-300 px-3 py-2 text-left font-medium">
                      {trip.profile?.full_name || '-'}
                    </td>

                    <td className="border border-gray-300 p-2 text-gray-500">
                      {trip.profile?.position || '-'}
                    </td>

                    <td className="border border-gray-300 p-2 text-left">
                      {trip.destination || '-'}
                    </td>

                    <td className="border border-gray-300 p-2 text-left">
                      {trip.purpose || '-'}
                    </td>

                    <td className="border border-gray-300 p-2">
                        <div className="flex flex-col items-center">
                            <Clock className="w-3 h-3 text-blue-500 mb-1" />
                            
                            <span>
                                {formatDateTime(trip.start_at)}
                                </span>
                                
                                <PhotoButton
                                photoUrl={trip.start_photo_url}
                                title="Lihat Foto Start"
                                color="text-blue-600"
                                />
                                </div>
                                </td>

                    <td className="border border-gray-300 p-2">
                        <div className="flex flex-col items-center">
                            <Clock className="w-3 h-3 text-blue-500 mb-1" />
                            
                            <span>
                                {formatDateTime(trip.clock_in_at)}
                                </span>
                                
                                <PhotoButton
                                photoUrl={trip.clock_in_photo_url}
                                title="Lihat Foto Clock In"
                                color="text-blue-600"
                                />
                                </div>
                                </td>

                    <td className="border border-gray-300 p-2">
                        <div className="flex flex-col items-center">
                            <Clock className="w-3 h-3 text-green-500 mb-1" />
                            
                            <span>
                                {formatDateTime(trip.clock_out_at)}
                                </span>
                                
                                <PhotoButton
                                photoUrl={trip.clock_out_photo_url}
                                title="Lihat Foto Clock Out"
                                color="text-green-600"
                                />
                                </div>
                                </td>

                    <td className="border border-gray-300 p-2">
                        <div className="flex flex-col items-center">
                            <Clock className="w-3 h-3 text-green-500 mb-1" />
                            
                            <span>
                                {formatDateTime(trip.end_at)}
                                </span>
                                
                                <PhotoButton
                                photoUrl={trip.end_photo_url}
                                title="Lihat Foto End"
                                color="text-green-600"
                                />
                                </div>
                                </td>

                    <td className="border border-gray-300 p-2">

                      <span
                        className={`inline-flex px-2 py-1 rounded-full border text-[10px] font-semibold ${getStatusClass(
                          trip.status
                        )}`}
                      >
                        {getStatusLabel(
                          trip.status
                        )}
                      </span>

                    </td>

                    <td className="border border-gray-300 p-2">
                        <button
                        onClick={() =>
                            window.open(
                                `/verifikasi/perjalanan-dinas/${trip.id}`,
                                '_blank'
                            )
                        }
                        className="inline-flex items-center justify-center px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition text-xs font-semibold"
                        title="Lihat Dokumen Validasi"
                        >
                            Lihat
                            </button>
                            </td>

                  </tr>

                )
              )}

            </tbody>

          </table>

        </div>

      )}

      {/* LEGEND */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs bg-white p-3 rounded border border-gray-200 shadow-sm">

        <span className="font-bold text-gray-700">
          Status:
        </span>

        <div className="flex items-center gap-1.5">

          <span className="w-4 h-4 rounded bg-yellow-100 border border-yellow-200 inline-block" />

          Sedang Berjalan

        </div>

        <div className="flex items-center gap-1.5">

          <span className="w-4 h-4 rounded bg-green-100 border border-green-200 inline-block" />

          Selesai

        </div>

        <div className="flex items-center gap-1.5">

          <span className="w-4 h-4 rounded bg-red-100 border border-red-200 inline-block" />

          Dibatalkan

        </div>

      </div>

      {/* PHOTO PREVIEW MODAL */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
            <div className="relative">
                
                <button
                onClick={() => setPreviewImage(null)}
                className="absolute -top-3 -right-3 bg-white rounded-full p-1 shadow-md hover:bg-gray-100"
                title="Tutup"
                >
                    <X className="w-5 h-5 text-gray-700" />
                    </button>
                    
                    <img
                    src={previewImage}
                    alt="Preview foto perjalanan dinas"
                    className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-xl object-contain"
                    />
                    
            </div>
        </div>
        )}

    </div>
  )
}