type CacheEntry = { expires: number; books: any[]; total: number }

const cache = new Map<string, CacheEntry>()

export function getCache() {
  return cache
}

export function invalidateCache() {
  cache.clear()
}
