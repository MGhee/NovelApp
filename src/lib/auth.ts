import crypto from 'crypto'
import { NextRequest } from 'next/server'

const SECRET = process.env.AUTH_SECRET || ''
const COOKIE_NAME = 'novelapp_session'

function hmacFor(value: string) {
  return crypto.createHmac('sha256', SECRET).update(value).digest('hex')
}

export function createSessionCookie() {
  const ts = Math.floor(Date.now() / 1000).toString()
  const sig = hmacFor(ts)
  return `${ts}.${sig}`
}

export function verifyBearer(header: string | null | undefined) {
  if (!header || !SECRET) return false
  const m = header.match(/^Bearer\s+(.+)$/i)
  if (!m) return false
  const token = m[1]
  try {
    const a = Buffer.from(token)
    const b = Buffer.from(SECRET)
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function verifyCookie(value: string | null | undefined) {
  if (!value || !SECRET) return false
  const parts = value.split('.')
  if (parts.length !== 2) return false
  const [ts, sig] = parts
  if (!/^[0-9]+$/.test(ts)) return false
  const expected = hmacFor(ts)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function isAuthenticated(req: NextRequest) {
  // Bearer header takes precedence
  const auth = req.headers.get('authorization')
  if (verifyBearer(auth)) return true

  const cookie = req.cookies.get(COOKIE_NAME)?.value
  if (verifyCookie(cookie)) return true

  return false
}

export { COOKIE_NAME }
