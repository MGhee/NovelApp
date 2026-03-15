'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { BookSummary, BookDetail } from '@/lib/types'

function useBookEvents(setBooks: React.Dispatch<React.SetStateAction<BookSummary[]>>) {
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
        } catch (_) {
          // ignore malformed events
        }
      })
    } catch (_) {
      // EventSource may not be available or may fail to connect — ignore silently
    }

    return () => { if (es) try { es.close() } catch (_) {} }
  }, [setBooks])
}

type BooksFilter = {
  status?: string
  search?: string
  favorites?: boolean
  page?: number
  limit?: number
}

export function useBooks(filter: BooksFilter = {}) {
  const [books, setBooks] = useState<BookSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cacheRef = useRef<Map<string, BookSummary[]>>(new Map())
  const abortRef = useRef<AbortController | null>(null)
  const lastBaseKeyRef = useRef<string | null>(null)

  const fetchBooks = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (filter.status) params.set('status', filter.status)
    if (filter.search) params.set('search', filter.search)
    if (filter.favorites) params.set('favorites', 'true')
    const limit = typeof filter.limit === 'number' ? filter.limit : 50
    const offset = typeof filter.page === 'number' && filter.page > 0 ? (filter.page - 1) * limit : 0
    params.set('limit', String(limit))
    params.set('offset', String(offset))
    const key = params.toString()
    // base key without pagination for append/replacement logic
    const baseParams = new URLSearchParams()
    if (filter.status) baseParams.set('status', filter.status)
    if (filter.search) baseParams.set('search', filter.search)
    if (filter.favorites) baseParams.set('favorites', 'true')
    const baseKey = baseParams.toString()

    const cached = cacheRef.current.get(key)
    if (cached) {
      // decide whether to append or replace based on baseKey
      if (typeof filter.page === 'number' && filter.page > 1 && lastBaseKeyRef.current === baseKey) {
        setBooks(prev => [...prev, ...cached])
      } else {
        setBooks(cached)
      }
      lastBaseKeyRef.current = baseKey || null
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
      const total = totalHeader ? parseInt(totalHeader, 10) : undefined
      cacheRef.current.set(key, data)
      if (typeof filter.page === 'number' && filter.page > 1 && lastBaseKeyRef.current === baseKey) {
        setBooks(prev => [...prev, ...data])
      } else {
        setBooks(data)
      }
      lastBaseKeyRef.current = baseKey || null;
      // store total in a transient ref so callers can use it if needed
      (fetchBooks as any).total = total
    } catch (e) {
      // ignore aborts silently
      if ((e as any)?.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [filter.status, filter.search, filter.favorites, filter.page, filter.limit])

  useEffect(() => {
    // debounce rapid search changes to avoid flooding the server
    let t: ReturnType<typeof setTimeout> | null = null
    if (filter.search) {
      t = setTimeout(() => { fetchBooks() }, 250)
    } else {
      fetchBooks()
    }
    return () => { if (t) clearTimeout(t) }
  }, [fetchBooks, filter.search, filter.page, filter.limit])
  useBookEvents(setBooks)

  return { books, loading, error, refetch: fetchBooks, getTotal: () => (fetchBooks as any).total }
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
