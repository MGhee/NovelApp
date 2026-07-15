'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { BookSummary, BookDetail } from '@/lib/types'

function useBookEvents(setBooks: React.Dispatch<React.SetStateAction<BookSummary[]>>, clearCache?: () => void) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (typeof setBooks !== 'function') return

    let es: EventSource | null = null
    try {
      es = new EventSource('/api/books/events')

      es.addEventListener('book_updated', (e) => {
        try {
          const updated: BookSummary = JSON.parse((e as MessageEvent).data)
          if (typeof setBooks === 'function') {
            setBooks(prev => prev.map(b => b.id === updated.id ? updated : b))
          }
          clearCache?.()
        } catch (_) {
          // ignore malformed events
        }
      })

      es.addEventListener('book_deleted', (e) => {
        try {
          const data = JSON.parse((e as MessageEvent).data)
          if (typeof setBooks === 'function') {
            setBooks(prev => prev.filter(b => b.id !== data.id))
          }
          clearCache?.()
        } catch (_) {
          // ignore malformed events
        }
      })

      es.addEventListener('book_created', (e) => {
        try {
          // For new books, trigger a full refetch since we need server-side filtering
          clearCache?.()
        } catch (_) {
          // ignore malformed events
        }
      })
    } catch (_) {
      // EventSource may not be available or may fail to connect — ignore silently
    }

    return () => { if (es) try { es.close() } catch (_) {} }
  }, [setBooks, clearCache])
}

type BooksFilter = {
  status?: string
  search?: string
  favorites?: boolean
  year?: number
  page?: number
  limit?: number
}

type CacheEntry = { books: BookSummary[]; total: number; availableYears: number[] }

export function useBooks(filter: BooksFilter = {}) {
  const [books, setBooks] = useState<BookSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map())
  const abortRef = useRef<AbortController | null>(null)

  const clearCache = useCallback(() => {
    cacheRef.current.clear()
  }, [])

  const fetchBooks = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (filter.status) params.set('status', filter.status)
    if (filter.search) params.set('search', filter.search)
    if (filter.favorites) params.set('favorites', 'true')
    if (filter.year) params.set('year', String(filter.year))
    const limit = typeof filter.limit === 'number' ? filter.limit : 50
    const offset = typeof filter.page === 'number' && filter.page > 0 ? (filter.page - 1) * limit : 0
    params.set('limit', String(limit))
    params.set('offset', String(offset))
    const key = params.toString()

    const cached = cacheRef.current.get(key)
    if (cached) {
      setBooks(cached.books)
      setTotal(cached.total)
      setAvailableYears(cached.availableYears)
      setLoading(false)
      return
    }

    // cancel previous request if still pending
    if (abortRef.current) {
      try { abortRef.current.abort() } catch (_) {}
    }
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`/api/books?${params}`, { signal: controller.signal })
      if (!res.ok) throw new Error('Failed to fetch')
      const data: BookSummary[] = await res.json()
      const totalHeader = res.headers.get('X-Total-Count')
      const totalCount = totalHeader ? parseInt(totalHeader, 10) : 0
      const yearsHeader = res.headers.get('X-Available-Years')
      const years = yearsHeader ? yearsHeader.split(',').map(Number).filter(n => !isNaN(n)) : []
      cacheRef.current.set(key, { books: data, total: totalCount, availableYears: years })
      setBooks(data)
      setTotal(totalCount)
      setAvailableYears(years)
    } catch (e) {
      // ignore aborts silently
      if ((e as any)?.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [filter.status, filter.search, filter.favorites, filter.year, filter.page, filter.limit])

  useEffect(() => {
    fetchBooks()
  }, [fetchBooks])

  useBookEvents(setBooks, clearCache)

  return { books, loading, error, total, availableYears, refetch: fetchBooks }
}

export async function deleteBook(id: number) {
  await fetch(`/api/books/${id}`, { method: 'DELETE' })
}

export async function updateBook(id: number, data: Partial<BookDetail>) {
  const res = await fetch(`/api/books/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function createBook(data: Partial<BookDetail>) {
  const res = await fetch('/api/books', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json()
}
