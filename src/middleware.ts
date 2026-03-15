import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isAuthenticated } from './lib/auth-edge'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout']

function parseAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGIN || ''
  if (!raw) return []
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

function originAllowed(origin: string | null, allowList: string[]) {
  if (!origin) return false
  if (allowList.length === 0) return true // no list -> allow any (legacy)
  if (allowList.includes('*')) return true
  // Exact match
  if (allowList.includes(origin)) return true
  // Also allow host-only matches, e.g. allowList entry 'https://novelapp.viktorbarzin.me'
  try {
    const o = new URL(origin)
    return allowList.some((a) => {
      try {
        const aa = new URL(a)
        return aa.host === o.host && aa.protocol === o.protocol
      } catch {
        return a === origin
      }
    })
  } catch {
    return false
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const origin = req.headers.get('origin')
  const allowList = parseAllowedOrigins()

  // Handle CORS preflight for API routes
  if (pathname.startsWith('/api/') && req.method === 'OPTIONS') {
    const res = NextResponse.json({})
    if (origin && originAllowed(origin, allowList)) {
      res.headers.set('Access-Control-Allow-Origin', origin)
      res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
      res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      res.headers.set('Access-Control-Max-Age', '600')
    }
    return res
  }

  // Skip static assets handled by Next
  if (pathname.startsWith('/_next/static') || pathname.startsWith('/_next/image') || pathname === '/favicon.ico') {
    return NextResponse.next()
  }

  // Public paths
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next()
  }

  // Auth check
  const authed = await isAuthenticated(req)
  if (authed) {
    // For API responses also set CORS if origin allowed
    if (pathname.startsWith('/api/') && origin && originAllowed(origin, allowList)) {
      const res = NextResponse.next()
      res.headers.set('Access-Control-Allow-Origin', origin)
      res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      return res
    }
    return NextResponse.next()
  }

  // API requests -> 401 JSON (with CORS headers when applicable)
  if (pathname.startsWith('/api/')) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (origin && originAllowed(origin, allowList)) {
      res.headers.set('Access-Control-Allow-Origin', origin)
      res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    }
    return res
  }

  // Page request -> redirect to login
  const loginUrl = new URL('/login', req.nextUrl.origin)
  loginUrl.searchParams.set('from', pathname + req.nextUrl.search)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}
