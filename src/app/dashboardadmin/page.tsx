'use client'

import {
  User,
  LogOut,
  FileText,
  Briefcase,
  ClipboardCheck,
  BarChart2,
  BookOpenCheck,
  AlertTriangle,
  RefreshCw,
  Settings,
  CalendarPlus,
  CheckCircle2,
  Info,
  Calendar,
  KeyRound,
  ChevronRight,
  Search // <-- Icon baru untuk Detail
} from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Toaster, toast } from 'react-hot-toast'

// --- SUB-COMPONENT: GENERATE KUOTA (MANUAL BACKUP) ---
function GenerateQuotaButton() {
  const [loading, setLoading] = useState(false)
  const [targetYear, setTargetYear] = useState(new Date().getFullYear() + 1)

  const handleGenerate = async () => {
    const confirm = window.confirm(
        `KONFIRMASI MANUAL:\n\n` +
        `Anda akan membuat kuota cuti (12 hari) untuk SELURUH PEGAWAI di tahun ${targetYear}.\n\n` +
        `Lanjutkan?`
    )
    if (!confirm) return

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('generate_annual_quota', { 
        target_year: targetYear 
      })

      if (error) throw error
      toast.success(data || `Berhasil generate kuota tahun ${targetYear}`)
    } catch (err: any) {
      console.error(err)
      toast.error('Gagal: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition duration-200">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
          <CalendarPlus size={24} />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-800">Generate Kuota Cuti (Backup)</h3>
          <p className="text-xs text-gray-500 mt-1 mb-3 leading-relaxed">
            Gunakan fitur ini <b>hanya jika</b> sistem otomatis gagal mengisi kuota tahunan, atau untuk persiapan manual tahun depan.
          </p>
          
          <div className="flex flex-wrap gap-2 items-center">
             <div className="relative w-32">
                <Calendar className="absolute left-2.5 top-2 text-gray-400 w-4 h-4" />
                <input 
                    type="number" 
                    min="2024" 
                    max="2050"
                    value={targetYear}
                    onChange={(e) => setTargetYear(Number(e.target.value))}
                    className="w-full pl-9 pr-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                />
            </div>
            <button 
                onClick={handleGenerate} 
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-4 rounded flex items-center gap-2 transition disabled:opacity-50"
            >
                {loading ? <RefreshCw className="animate-spin w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                Generate
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- MAIN DASHBOARD ---
export default function DashboardAdmin() {
  const router = useRouter()
  const [userData, setUserData] = useState({ fullName: 'Loading...', email: 'loading@kppn.go.id' })
  const [totalPegawai, setTotalPegawai] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // Fetch Profile & Total Pegawai
 useEffect(() => {
  const init = async () => {
    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { 
        router.replace('/login')
        return 
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name,email,role')
        .eq('id', user.id)
        .single()

      // 🔥 RBAC CHECK
      const allowedRoles = ['admin', 'kepala_kantor', 'kasubbag']
      if (!allowedRoles.includes(profile?.role)) {
        router.replace('/dashboard')
        return
      }

      // ✅ lanjut kalau lolos
      setUserData({ 
        fullName: profile?.full_name || 'Admin', 
        email: user.email || 'N/A' 
      })

      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'pegawai')

      if (count !== null) setTotalPegawai(count)

    } catch (err) { 
      console.error(err) 
    } finally { 
      setIsLoading(false) 
    }
  }

  init()
}, [router])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (isLoading || isLoggingOut) return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-700" />
        <p className="mt-4 text-gray-600 font-semibold">{isLoggingOut ? 'Sampai Jumpa...' : 'Memuat Dashboard Admin...'}</p>
      </div>
    </div>
  )

  // Reusable Menu Card
  const MenuCard = ({ icon: Icon, title, description, href, colorClass = "text-blue-700 bg-blue-50" }: any) => (
    <div 
      onClick={() => router.push(href)}
      className="flex items-center p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition duration-200 cursor-pointer group"
    >
      <div className={`p-3 rounded-lg mr-4 ${colorClass} group-hover:scale-105 transition-transform`}>
        <Icon size={24} />
      </div>
      <div className="flex-1">
        <h3 className="font-bold text-gray-800 group-hover:text-blue-700 transition">{title}</h3>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <ChevronRight className="text-gray-300 group-hover:text-blue-500 transition" size={20} />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-10">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="bg-blue-900 text-white p-6 pb-20 shadow-xl rounded-b-3xl">
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
              <User size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-wide">{userData.fullName}</h1>
              <p className="text-xs text-blue-200 font-medium opacity-90">{userData.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="bg-red-500/20 hover:bg-red-500 p-2.5 rounded-xl text-white transition border border-white/10">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="px-5 -mt-12 flex flex-col gap-8 max-w-4xl mx-auto">
        
        {/* Stats Card */}
        <div className="bg-white p-5 rounded-2xl shadow-lg border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Pegawai Aktif</p>
            <p className="text-3xl font-extrabold text-blue-900 mt-1">{totalPegawai} <span className="text-base font-normal text-gray-400">Orang</span></p>
          </div>
          <div className="h-12 w-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
            <User size={24} />
          </div>
        </div>

        {/* Menu Operasional */}
        <div>
          <h2 className="text-lg font-bold mb-4 text-gray-800 pl-1 border-l-4 border-blue-600">Menu Operasional</h2>
          <div className="flex flex-col gap-3">
            <MenuCard icon={FileText} title="Data Pegawai" description="Kelola data seluruh pegawai" href="/datapegawai" />
            <MenuCard icon={Briefcase} title="Approval Cuti" description="Persetujuan pengajuan cuti" href="/approvalcuti" />
            <MenuCard icon={ClipboardCheck} title="Approval Izin" description="Persetujuan pengajuan izin" href="/approvalizin" />
            
            {/* Menu Rekap */}
            <MenuCard icon={BarChart2} title="Rekap Absensi Matrix" description="Laporan absensi bulanan (Semua)" href="/rekapabsensiadmin" />
            <MenuCard icon={BarChart2} title="Rekap Lembur Matrix" description="Laporan Lembur bulanan (Semua)" href="/rekaplemburadmin" />
            
            {/* --- MENU BARU: Detail Absensi Individu --- */}
            <MenuCard 
                icon={Search} 
                title="Detail Absensi PPNPN & CS " 
                description="Cek riwayat detail, lokasi & jam per orang" 
                href="/detailabsensipegawai" 
                // Menggunakan default colorClass (Biru)
            />

            <MenuCard icon={BookOpenCheck} title="Logbook Pegawai" description="Monitoring aktivitas harian" href="/logbookpegawaiadmin" />
          </div>
        </div>

        {/* Pengaturan Sistem */}
        <div>
          <h2 className="text-lg font-bold mb-4 text-gray-800 pl-1 border-l-4 border-gray-600 flex items-center gap-2">
            Pengaturan Sistem
          </h2>
          <div className="flex flex-col gap-4">
            
            {/* 1. Menu Ganti Password */}
            <MenuCard 
              icon={KeyRound} 
              title="Ganti Password Akun" 
              description="Ubah password login Anda demi keamanan." 
              href="/changepassword" 
              colorClass="text-yellow-600 bg-yellow-50"
            />

            {/* 2. Fitur Generate Kuota */}
            <GenerateQuotaButton />
            
          </div>
        </div>

        {/* Footer Alert */}
        <div className="text-center pb-6">
            <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
                <AlertTriangle size={12}/> Aplikasi Logbook & Absensi 
            </p>
        </div>

      </main>
    </div>
  )
}