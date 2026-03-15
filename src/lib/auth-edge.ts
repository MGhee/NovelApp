import type { NextRequest } from 'next/server'

const SECRET = process.env.AUTH_SECRET || ''
const COOKIE_NAME = 'novelapp_session'
const SESSION_MAX_AGE = Number(process.env.AUTH_SESSION_MAX_AGE_SECONDS || String(7 * 24 * 60 * 60))
const encoder = new TextEncoder()

function bufToHex(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

async function hmacHex(message: string) {
  if (!globalThis.crypto || !globalThis.crypto.subtle) throw new Error('Web Crypto not available')
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return bufToHex(sig)
}

export async function verifyBearer(header: string | null | undefined) {
  if (!header || !SECRET) return false
  const m = header.match(/^Bearer\s+(.+)$/i)
  if (!m) return false
  const token = m[1]
  return constantTimeEqual(token, SECRET)
}

export async function verifyCookie(value: string | null | undefined) {
  if (!value || !SECRET) return false
  const parts = value.split('.')
  if (parts.length !== 2) return false
  const [ts, sig] = parts
  if (!/^[0-9]+$/.test(ts)) return false
  try {
    // Enforce server-side session age to mitigate replayed cookies
    const now = Math.floor(Date.now() / 1000)
    const tsNum = parseInt(ts, 10)
    if (Number.isNaN(tsNum)) return false
    if (now - tsNum > SESSION_MAX_AGE) return false

    const expected = await hmacHex(ts)
    return constantTimeEqual(sig, expected)
  } catch {
    return false
  }
}

export async function isAuthenticated(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (await verifyBearer(auth)) return true

  const cookie = req.cookies.get(COOKIE_NAME)?.value
  if (await verifyCookie(cookie)) return true

  return false
}

export { COOKIE_NAME }
