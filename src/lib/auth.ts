import { NextRequest } from 'next/server'

const SECRET = process.env.AUTH_SECRET || ''
const COOKIE_NAME = 'novelapp_session'

async function getKey() {
  return globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
}

async function hmacFor(value: string): Promise<string> {
  const key = await getKey()
  const sig = await globalThis.crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const ab = enc.encode(a)
  const bb = enc.encode(b)
  if (ab.length !== bb.length) return false
  let diff = 0
  for (let i = 0; i < ab.length; i++) {
    diff |= ab[i] ^ bb[i]
  }
  return diff === 0
}

/**
 * Create a session token embedding the user ID.
 * Format: {userId}:{timestamp}.{hmac(userId:timestamp)}
 */
export async function createSessionCookie(userId: string): Promise<string> {
  const ts = Math.floor(Date.now() / 1000).toString()
  const payload = `${userId}:${ts}`
  const sig = await hmacFor(payload)
  return `${payload}.${sig}`
}

/**
 * Verify a session token and extract the user ID.
 * Returns userId or null if invalid.
 */
export async function verifyCookie(value: string | null | undefined): Promise<string | null> {
  if (!value || !SECRET) return null
  const parts = value.split('.')
  if (parts.length !== 2) return null

  const [payload, sig] = parts
  const payloadParts = payload.split(':')
  if (payloadParts.length !== 2) return null

  const [userId, ts] = payloadParts
  if (!/^[0-9]+$/.test(ts) || !userId) return null

  const expected = await hmacFor(payload)
  if (!timingSafeEqual(sig, expected)) return null

  return userId
}

export async function verifyBearer(header: string | null | undefined): Promise<boolean> {
  if (!header || !SECRET) return false
  const m = header.match(/^Bearer\s+(.+)$/i)
  if (!m) return false
  return timingSafeEqual(m[1], SECRET)
}

export async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization')
  if (await verifyBearer(auth)) return true
  const cookie = req.cookies.get(COOKIE_NAME)?.value
  if (await verifyCookie(cookie)) return true
  return false
}

export { COOKIE_NAME }
