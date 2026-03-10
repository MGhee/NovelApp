'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import BookCard from '@/components/books/BookCard'
import AddBookModal from '@/components/books/AddBookModal'
import { useBooks } from '@/hooks/useBooks'

const TABS = [
  { id: 'READING',      label: '📖 Reading',     color: 'var(--status-reading)' },
  { id: 'PLAN_TO_READ', label: '🕐 Plan to Read', color: 'var(--status-plan)' },
  { id: 'COMPLETED',    label: '✓ Completed',     color: 'var(--status-completed)' },
  { id: 'DROPPED',      label: '✕ Dropped',       color: 'var(--status-dropped)' },
  { id: 'FAVORITES',    label: '⭐ Favorites',     color: 'var(--star)' },
]

export default function HomePage() {
  return (
    <Suspense>
      <HomePageInner />
    </Suspense>
  )
}

function HomePageInner() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState('READING')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const addUrl = searchParams.get('add') || ''
  const [showAddModal, setShowAddModal] = useState(() => !!searchParams.get('add'))
  const [yearFilter, setYearFilter] = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const isFavorites = activeTab === 'FAVORITES'
  const { books, loading, error, refetch } = useBooks({
    status: isFavorites ? undefined : activeTab,
    search: debouncedSearch || undefined,
    favorites: isFavorites ? true : undefined,
  })

  const years = (activeTab === 'COMPLETED' || isFavorites)
    ? [...new Set(books.map((b) => b.yearRead).filter((y): y is number => y !== null))].sort((a, b) => b - a)
    : []

  const filtered = yearFilter ? books.filter((b) => b.yearRead === yearFilter) : books

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '60px', position: 'sticky', top: 0, zIndex: 30,
        backgroundColor: 'rgba(13,13,13,0.95)', backdropFilter: 'blur(8px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '22px' }}>📚</span>
          <span style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.5px' }}>NovelApp</span>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)', backgroundColor: 'var(--border)', padding: '2px 6px', borderRadius: '4px' }}>
            Reading Tracker
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            style={{
              padding: '7px 12px', backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)', borderRadius: '6px',
              color: 'var(--text)', fontSize: '13px', width: '220px', outline: 'none',
            }}
            placeholder="Search books…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '7px 16px', backgroundColor: 'var(--accent)',
              border: 'none', borderRadius: '6px', color: '#fff',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            + Add Book
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '0', padding: '0 24px',
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setYearFilter(null) }}
              style={{
                padding: '14px 18px', border: 'none', cursor: 'pointer',
                backgroundColor: 'transparent', color: isActive ? tab.color : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 400, fontSize: '13px',
                borderBottom: isActive ? `2px solid ${tab.color}` : '2px solid transparent',
                whiteSpace: 'nowrap', transition: 'color 0.15s',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Year filter (Completed / Favorites tabs) */}
      {years.length > 0 && (
        <div style={{ padding: '12px 24px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: '4px' }}>Year read:</span>
          <button onClick={() => setYearFilter(null)} style={yearBtnStyle(!yearFilter)}>All</button>
          {years.map((y) => (
            <button key={y} onClick={() => setYearFilter(y)} style={yearBtnStyle(yearFilter === y)}>{y}</button>
          ))}
        </div>
      )}

      {/* Stats bar */}
      {!loading && filtered.length > 0 && (
        <div style={{ padding: '8px 24px', fontSize: '12px', color: 'var(--text-dim)' }}>
          {filtered.length} {filtered.length === 1 ? 'book' : 'books'}
        </div>
      )}

      {/* Book grid */}
      <main style={{ padding: '12px 24px 40px' }}>
        {loading && (
          <div style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '60px', textAlign: 'center' }}>
            Loading…
          </div>
        )}
        {error && (
          <div style={{ color: 'var(--status-dropped)', fontSize: '14px', padding: '60px', textAlign: 'center' }}>
            {error}
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>
              {activeTab === 'READING' ? '📖' : activeTab === 'COMPLETED' ? '✅' : activeTab === 'FAVORITES' ? '⭐' : '📚'}
            </div>
            <p style={{ fontSize: '15px', marginBottom: '6px' }}>
              {debouncedSearch ? `No books found for "${debouncedSearch}"` : 'No books here yet'}
            </p>
            {!debouncedSearch && (
              <button
                onClick={() => setShowAddModal(true)}
                style={{
                  marginTop: '12px', padding: '8px 20px',
                  backgroundColor: 'var(--accent)', border: 'none', borderRadius: '6px',
                  color: '#fff', fontSize: '13px', cursor: 'pointer',
                }}
              >
                + Add your first book
              </button>
            )}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {filtered.map((book) => (
              <BookCard key={book.id} book={book} onDeleted={refetch} onUpdated={refetch} />
            ))}
          </div>
        )}
      </main>

      {showAddModal && (
        <AddBookModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => { setShowAddModal(false); refetch() }}
          initialUrl={addUrl}
        />
      )}
    </div>
  )
}

function yearBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '3px 10px', fontSize: '12px', cursor: 'pointer',
    backgroundColor: active ? 'var(--accent)' : 'var(--bg-card)',
    border: '1px solid var(--border)', borderRadius: '4px',
    color: active ? '#fff' : 'var(--text-muted)',
  }
}
