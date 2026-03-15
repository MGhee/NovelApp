'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import BookCard from '@/components/books/BookCard'
import AddBookModal from '@/components/books/AddBookModal'
import PageTransition from '@/components/PageTransition'
import { useBooks } from '@/hooks/useBooks'

const TABS = [
  { id: 'READING',      label: 'Now Reading',  icon: '📖', color: 'var(--status-reading)' },
  { id: 'PLAN_TO_READ', label: 'Watchlist',     icon: '🕐', color: 'var(--status-plan)' },
  { id: 'COMPLETED',    label: 'Completed',     icon: '✓',  color: 'var(--status-completed)' },
  { id: 'DROPPED',      label: 'On Hold',       icon: '⏸',  color: 'var(--status-dropped)' },
  { id: 'FAVORITES',    label: 'Favorites',     icon: '⭐', color: 'var(--star)' },
]

const gridVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
    },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

export default function HomePage() {
  return (
    <Suspense>
      <HomePageInner />
    </Suspense>
  )
}

function HomePageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'READING')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const LIMIT = 30
  const addUrl = searchParams.get('add') || ''
  const [showAddModal, setShowAddModal] = useState(() => !!searchParams.get('add'))
  const [yearFilter, setYearFilter] = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])


  const isFavorites = activeTab === 'FAVORITES'
  // reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [activeTab, debouncedSearch, isFavorites])
  const { books, loading, error, refetch } = useBooks({
    status: isFavorites ? undefined : activeTab,
    search: debouncedSearch || undefined,
    favorites: isFavorites ? true : undefined,
    page,
    limit: LIMIT,
  })

  const years = (activeTab === 'COMPLETED' || isFavorites)
    ? [...new Set(books.map((b) => b.yearRead).filter((y): y is number => y !== null))].sort((a, b) => b - a)
    : []

  const filtered = yearFilter ? books.filter((b) => b.yearRead === yearFilter) : books

  return (
    <PageTransition>
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
        {/* Sidebar */}
        <aside style={{
          width: 'var(--sidebar-width)',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          backgroundColor: 'var(--bg-card)',
          borderRight: '1px solid var(--border)',
          padding: '20px 0',
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Logo */}
          <div style={{ padding: '0 16px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '20px' }}>📚</span>
              <span style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '-0.5px' }}>NovelShelf</span>
            </div>
          </div>

          {/* Tab buttons */}
          <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '8px', paddingRight: '8px' }}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id)
                    setYearFilter(null)
                    const params = new URLSearchParams(window.location.search)
                    params.set('tab', tab.id)
                    router.replace(`/?${params.toString()}`, { scroll: false })
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 16px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: isActive ? `rgba(${tab.color.match(/\d+/g)?.join(', ')}, 0.08)` : 'transparent',
                    color: isActive ? tab.color : 'var(--text-muted)',
                    fontWeight: isActive ? 600 : 400,
                    fontSize: '13px',
                    borderLeft: isActive ? `3px solid ${tab.color}` : '3px solid transparent',
                    transition: 'all 0.15s',
                    borderRadius: '0 6px 6px 0',
                    position: 'relative',
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>

          {/* Add button at bottom */}
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 16px',
              margin: '0 8px',
              backgroundColor: 'var(--accent)',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Add
          </button>
        </aside>

        {/* Main content */}
        <main style={{ marginLeft: 'var(--sidebar-width)', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <header style={{
            borderBottom: '1px solid var(--border)',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            height: '60px',
            position: 'sticky',
            top: 0,
            zIndex: 30,
            backgroundColor: 'rgba(13,13,13,0.95)',
            backdropFilter: 'blur(8px)',
            gap: '12px',
          }}>
            <input
              style={{
                padding: '7px 12px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text)',
                fontSize: '13px',
                width: '220px',
                outline: 'none',
              }}
              placeholder="Search books…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </header>

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
          <div
            style={{ padding: '12px 24px 40px', flex: 1, overflow: 'auto' }}
            onScroll={(e) => {
              const el = e.currentTarget as HTMLDivElement
              if (loading) return
              if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) {
                setPage(p => p + 1)
              }
            }}
          >
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
              <motion.div
                key={activeTab}
                variants={gridVariants}
                initial="hidden"
                animate="visible"
                style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}
              >
                {filtered.map((book) => (
                  <motion.div key={book.id} variants={cardVariants}>
                    <BookCard book={book} onDeleted={refetch} onUpdated={refetch} />
                  </motion.div>
                ))}
              </motion.div>
            )}
            {/* loading more indicator */}
            {loading && page > 1 && (
              <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)' }}>Loading more…</div>
            )}
          </div>

          {showAddModal && (
            <AddBookModal
              onClose={() => setShowAddModal(false)}
              onAdded={() => { setShowAddModal(false); refetch() }}
              initialUrl={addUrl}
            />
          )}
        </main>
      </div>
    </PageTransition>
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
