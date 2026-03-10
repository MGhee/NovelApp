'use client'

import { useState, useEffect, useCallback } from 'react'
import type { BookSummary, BookDetail } from '@/lib/types'

function useBookEvents(setBooks: React.Dispatch<React.SetStateAction<BookSummary[]>>) {
  useEffect(() => {
    const es = new EventSource('/api/books/events')
    es.addEventListener('book_updated', (e) => {
      const updated: BookSummary = JSON.parse(e.data)
      setBooks(prev => prev.map(b => b.id === updated.id ? updated : b))
    })
    return () => es.close()
  }, [setBooks])
}

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
  useBookEvents(setBooks)

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
