import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { COOKIE_NAME, createSessionCookie, verifyBearer } from '@/lib/auth'
import { isAllowed } from '@/lib/rateLimiter'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const password = body?.password || ''

  // Basic rate limiting by IP / forwarded-for header
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || 'unknown'
  if (!isAllowed(`login:${ip}`, 8, 60)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  // Allow direct bearer header as alternative to password field
  const header = req.headers.get('authorization')
  if (!process.env.AUTH_SECRET) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const ok = verifyBearer(`Bearer ${password}`) || verifyBearer(header)
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cookieValue = createSessionCookie()
  const res = NextResponse.json({ ok: true })
  const secure = process.env.NODE_ENV === 'production'
  res.cookies.set({ name: COOKIE_NAME, value: cookieValue, httpOnly: true, path: '/', sameSite: 'lax', secure, maxAge: 7 * 24 * 60 * 60 })
  return res
}
