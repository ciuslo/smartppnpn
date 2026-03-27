import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. Siapkan response awal
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 2. Buat client Supabase dengan Cookie Handler yang benar
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        // FIX: Tambahkan tipe eksplisit { name, value, options } untuk mengatasi error TypeScript
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          // Loop cookie satu per satu agar Next.js 16 senang
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({ name, value, ...options })
          })

          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({ name, value, ...options })
          })
        },
      },
    }
  )

  // 🔐 Ambil user
  const { data: { user } } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()

  // 📌 Protected routes
  const protectedPaths = [
    '/dashboard',
    '/dashboardadmin',
    '/logbook',
    '/rekapabsensi',
    '/pengajuancuti'
  ]

  const isProtected = protectedPaths.some((path) =>
    url.pathname.startsWith(path)
  )

  // 🚫 Belum login
  if (isProtected && !user) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ==============================
  // 🔥 AMBIL ROLE
  // ==============================
  let role: string | null = null

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    role = profile?.role ?? null
  }

  // ==============================
  // 🎯 ROLE MAPPING
  // ==============================
  const adminRoles = ['admin', 'kepala_kantor', 'kasubag']
  const userRoles = ['pegawai']

  const isAdmin = adminRoles.includes(role || '')
  const isUser = userRoles.includes(role || '')

  // ==============================
  // 🔁 REDIRECT SETELAH LOGIN
  // ==============================
  if (url.pathname === '/login' && user) {
    if (isAdmin) {
      url.pathname = '/dashboardadmin'
    } else {
      url.pathname = '/dashboard'
    }
    return NextResponse.redirect(url)
  }

  // ==============================
  // 🔒 PROTEKSI DASHBOARD ADMIN
  // ==============================
  if (url.pathname.startsWith('/dashboardadmin')) {
    if (isUser) {
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // ==============================
  // 🔒 PROTEKSI DASHBOARD USER
  // ==============================
  if (url.pathname.startsWith('/dashboard')) {
    if (isAdmin) {
      url.pathname = '/dashboardadmin'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  // Middleware jalan di semua route KECUALI file statis (gambar, css, dll)
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}