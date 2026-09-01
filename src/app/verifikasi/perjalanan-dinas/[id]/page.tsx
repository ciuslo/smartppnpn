'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Download, Loader2, FileText } from 'lucide-react'

type Trip = {
  id: string
  user_id: string
  trip_date: string
  destination: string | null
  purpose: string | null

  start_at: string | null
  start_latitude: number | null
  start_longitude: number | null
  start_address?: string | null
  start_photo_url: string | null

  clock_in_at: string | null
  clock_in_latitude: number | null
  clock_in_longitude: number | null
  clock_in_address?: string | null
  clock_in_photo_url: string | null

  clock_out_at: string | null
  clock_out_latitude: number | null
  clock_out_longitude: number | null
  clock_out_address?: string | null
  clock_out_photo_url: string | null

  end_at: string | null
  end_latitude: number | null
  end_longitude: number | null
  end_address?: string | null
  end_photo_url: string | null

  status: string
}

type Profile = {
  full_name: string
  position: string
}

export default function VerifikasiPerjalananDinas() {
  const params = useParams()
  const id = params?.id as string

  const [trip, setTrip] = useState<Trip | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [printDate, setPrintDate] = useState<string>('')

  useEffect(() => {
    const now = new Date()
    const formattedDate = now.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    setPrintDate(formattedDate)

    if (!id) return

    const fetchData = async () => {
      try {
        setLoading(true)
        setError('')

        const { data: tripData, error: tripError } = await supabase
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
            start_address,
            start_photo_url,
            clock_in_at,
            clock_in_latitude,
            clock_in_longitude,
            clock_in_address,
            clock_in_photo_url,
            clock_out_at,
            clock_out_latitude,
            clock_out_longitude,
            clock_out_address,
            clock_out_photo_url,
            end_at,
            end_latitude,
            end_longitude,
            end_address,
            end_photo_url,
            status
          `)
          .eq('id', id)
          .single()

        if (tripError) throw tripError
        if (!tripData) throw new Error('Data perjalanan dinas tidak ditemukan.')

        setTrip(tripData)

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, position')
          .eq('id', tripData.user_id)
          .single()

        if (profileError) console.error('Gagal mengambil profile:', profileError)

        setProfile(profileData)
      } catch (err: any) {
        console.error('Error:', err)
        setError(err?.message || 'Terjadi kesalahan saat mengambil data.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id])

  const formatDate = (value?: string | null) => {
    if (!value) return '-'
    const date = new Date(value)
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const formatDateTime = (value?: string | null) => {
    if (!value) return { date: '-', time: '-', dateShort: '-' }
    const date = new Date(value)
    return {
      date: date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      dateShort: `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`,
      time: date.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).replace(/\./g, ':') + ' WIB',
    }
  }

  const formatCoord = (lat?: number | null, lng?: number | null) => {
    if (lat === null || lat === undefined || lng === null || lng === undefined) return '-'
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  }

  const handleDownload = () => window.print()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-gray-700" />
          <p className="text-gray-600 text-sm">Memuat dokumen...</p>
        </div>
      </div>
    )
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-sans">
        <div className="bg-white p-8 text-center max-w-md border border-gray-200">
          <FileText className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-800 mb-2">Dokumen Tidak Ditemukan</h1>
          <p className="text-gray-600 text-sm">{error || 'Data tidak tersedia.'}</p>
        </div>
      </div>
    )
  }

  const verificationUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/verifikasi/perjalanan-dinas/${trip.id}`
      : ''

  const photos = [
    {
      number: '1',
      title: 'Start',
      dateTime: formatDateTime(trip.start_at),
      lat: trip.start_latitude,
      lng: trip.start_longitude,
      address: trip.start_address || trip.destination || '-',
      photo: trip.start_photo_url,
    },
    {
      number: '2',
      title: 'Clock In',
      dateTime: formatDateTime(trip.clock_in_at),
      lat: trip.clock_in_latitude,
      lng: trip.clock_in_longitude,
      address: trip.clock_in_address || trip.destination || '-',
      photo: trip.clock_in_photo_url,
    },
    {
      number: '3',
      title: 'Clock Out',
      dateTime: formatDateTime(trip.clock_out_at),
      lat: trip.clock_out_latitude,
      lng: trip.clock_out_longitude,
      address: trip.clock_out_address || trip.destination || '-',
      photo: trip.clock_out_photo_url,
    },
    {
      number: '4',
      title: 'End',
      dateTime: formatDateTime(trip.end_at),
      lat: trip.end_latitude,
      lng: trip.end_longitude,
      address: trip.end_address || trip.destination || '-',
      photo: trip.end_photo_url,
    },
  ]

  return (
    <>
      {/* Tombol Unduh */}
      <div className="print:hidden fixed top-5 right-5 z-50">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-4 py-2 rounded text-sm font-medium transition shadow-md"
        >
          <Download size={16} />
          Cetak / Unduh PDF
        </button>
      </div>

      <main className="min-h-screen bg-gray-100 py-10 px-4 font-sans text-gray-900">
        <div
          id="verification-document"
          className="max-w-2xl mx-auto bg-white p-10 md:p-14 border border-gray-200 shadow-sm"
        >
          {/* HEADER DOKUMEN */}
          <div className="text-center mb-8">
            <h1 className="text-base font-bold uppercase tracking-wide leading-tight">
              KEMENTERIAN KEUANGAN RI
            </h1>
            <h2 className="text-base font-bold uppercase tracking-wide leading-tight">
              DIREKTORAT JENDERAL PERBENDAHARAAN
            </h2>
            <h3 className="text-base font-bold uppercase tracking-wide leading-tight">
              KPPN LHOKSEUMAWE
            </h3>

            <h4 className="text-xl font-bold uppercase tracking-wide mt-8 mb-6">
              DOKUMEN VALIDASI PERJALANAN DINAS
            </h4>

            <div className="border-b border-gray-300 w-full"></div>
          </div>

          {/* INFORMASI PERJALANAN */}
          <div className="mb-8">
            <table className="w-full text-sm text-gray-900 border-collapse">
              <tbody>
                <tr>
                  <td className="py-2 w-44 font-medium">Nama</td>
                  <td className="py-2 w-6 text-center">:</td>
                  <td className="py-2 font-medium">{profile?.full_name || '-'}</td>
                </tr>
                <tr>
                  <td className="py-2 font-medium">Jabatan</td>
                  <td className="py-2 text-center">:</td>
                  <td className="py-2">{profile?.position || '-'}</td>
                </tr>
                <tr>
                  <td className="py-2 font-medium">Tanggal Perjalanan</td>
                  <td className="py-2 text-center">:</td>
                  <td className="py-2">{formatDate(trip.trip_date)}</td>
                </tr>
                <tr>
                  <td className="py-2 font-medium">Tujuan</td>
                  <td className="py-2 text-center">:</td>
                  <td className="py-2">{trip.destination || '-'}</td>
                </tr>
                <tr>
                  <td className="py-2 font-medium">Keperluan</td>
                  <td className="py-2 text-center">:</td>
                  <td className="py-2">{trip.purpose || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* DOKUMENTASI FOTO */}
          <div className="mb-12">
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-300">
                  <th className="py-2.5 px-4 text-left font-bold w-1/2 border-r border-gray-300">
                    Tahapan Presensi
                  </th>
                  <th className="py-2.5 px-4 text-center font-bold">
                    Bukti Foto
                  </th>
                </tr>
              </thead>
              <tbody>
                {photos.map((item) => (
                  <tr key={item.number} className="border-b border-gray-300">
                    {/* Kolom Teks Informasi Tahapan */}
                    <td className="p-4 align-top border-r border-gray-300">
                      <p className="font-bold mb-1">{item.number}. {item.title}</p>
                      <p className="text-xs text-gray-600 mt-2">
                        <strong>Tanggal:</strong> {item.dateTime.date}
                      </p>
                      <p className="text-xs text-gray-600">
                        <strong>Waktu:</strong> {item.dateTime.time}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        <strong>Koordinat:</strong> {formatCoord(item.lat, item.lng)}
                      </p>
                      <p className="text-xs text-gray-600">
                        <strong>Lokasi:</strong> {item.address}
                      </p>
                    </td>

                    {/* Kolom Bukti Foto dengan Watermark Ringkas */}
                    <td className="p-3 text-center align-middle">
                      {item.photo ? (
                        <div className="relative w-full max-w-[210px] mx-auto border border-gray-300 rounded overflow-hidden shadow-sm">
                          <img
                            src={item.photo}
                            alt={item.title}
                            className="w-full h-36 object-cover block"
                          />
                          {/* Watermark Overlay Ringkas */}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/65 text-white p-1 px-2 text-left leading-tight print-watermark">
                            <p className="font-bold text-[9px] tracking-wider uppercase">
                              SMART PPNPN
                            </p>
                            <p className="text-[8px] text-gray-200">
                              {item.dateTime.dateShort !== '-' ? `${item.dateTime.dateShort}, ${item.dateTime.time}` : '-'}
                            </p>
                            <p className="text-[8px] text-gray-200">
                              {formatCoord(item.lat, item.lng)}
                            </p>
                            <p className="text-[8px] text-gray-300 truncate">
                              {item.address}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full max-w-[210px] h-36 bg-gray-50 border border-gray-200 mx-auto flex items-center justify-center text-xs text-gray-400">
                          Foto Tidak Tersedia
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* FOOTER */}
          <div className="mt-10 text-center text-sm text-gray-800">
            {verificationUrl && (
              <div className="mb-4">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(
                    verificationUrl
                  )}`}
                  alt="QR Code Verifikasi"
                  className="w-20 h-20 mx-auto border border-gray-200 p-1 mb-1"
                />
              </div>
            )}
            <p className="text-xs text-gray-600">
              Dicetak pada {printDate}
            </p>
          </div>
        </div>
      </main>

      {/* PRINT STYLES */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          html, body {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #verification-document {
            border: none !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: none !important;
            padding: 0 !important;
          }
          .print-watermark {
            background-color: rgba(0, 0, 0, 0.7) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </>
  )
}
