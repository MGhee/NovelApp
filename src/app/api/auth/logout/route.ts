import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { COOKIE_NAME } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/login', req.nextUrl.origin))
  res.cookies.set({ name: COOKIE_NAME, value: '', path: '/', maxAge: 0 })
  return res
}
