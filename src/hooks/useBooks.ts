'use client'

import { useState, useEffect, useCallback } from 'react'
import type { BookSummary, BookDetail } from '@/lib/types'

type BooksFilter = {
  status?: string
  search?: string
  favorites?: boolean
}

export function useBooks(filter: BooksFilter = {}) {
  const [books, setBooks] = useState<BookSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBooks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filter.status) params.set('status', filter.status)
      if (filter.search) params.set('search', filter.search)
      if (filter.favorites) params.set('favorites', 'true')
      const res = await fetch(`/api/books?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      setBooks(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [filter.status, filter.search, filter.favorites])

  useEffect(() => { fetchBooks() }, [fetchBooks])

  return { books, loading, error, refetch: fetchBooks }
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
