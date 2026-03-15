type Entry = { count: number; start: number }

const globalKey = '__novelapp_rate_limiter__'
if (!(globalThis as any)[globalKey]) (globalThis as any)[globalKey] = new Map<string, Entry>()
const store: Map<string, Entry> = (globalThis as any)[globalKey]

/**
 * Simple in-memory rate limiter.
 * Returns true when request is allowed, false when limit exceeded.
 */
export function isAllowed(key: string, limit = 5, windowSec = 60): boolean {
  const now = Date.now()
  const windowMs = windowSec * 1000
  const e = store.get(key)
  if (!e || now - e.start > windowMs) {
    store.set(key, { count: 1, start: now })
    return true
  }

  if (e.count >= limit) return false
  e.count += 1
  return true
}

export function resetKey(key: string) {
  store.delete(key)
}
