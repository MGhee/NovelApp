'use client'

import { useState, useEffect, use } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import type { BookDetail, BookEvent, Character, CustomField } from '@/lib/types'
import { updateBook, deleteBook } from '@/hooks/useBooks'
import { useRouter } from 'next/navigation'
import { useRef } from 'react'

const STATUS_COLORS: Record<string, string> = {
  READING: 'var(--status-reading)',
  COMPLETED: 'var(--status-completed)',
  PLAN_TO_READ: 'var(--status-plan)',
  DROPPED: 'var(--status-dropped)',
}

const STATUS_LABELS: Record<string, string> = {
  READING: 'Now Reading',
  COMPLETED: 'Completed',
  PLAN_TO_READ: 'Watchlist',
  DROPPED: 'On Hold',
}

const TYPE_LABELS: Record<string, string> = {
  WEB_NOVEL: 'Web Novel',
  LIGHT_NOVEL: 'Light Novel',
  MANGA: 'Manga',
  MANHWA: 'Manhwa',
}

function RefreshButton({ bookId, onRefreshed }: { bookId: number; onRefreshed: (book: BookDetail) => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRefresh() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/books/${bookId}/refresh`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Refresh failed')
      }
      const updated: BookDetail = await res.json()
      onRefreshed(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <button
        onClick={handleRefresh}
        disabled={loading}
        title="Refresh metadata from site"
        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-muted)', fontSize: '11px', padding: '2px 8px', cursor: 'pointer' }}
      >
        {loading ? '…' : '↻ Refresh'}
      </button>
      {error && <span style={{ fontSize: '11px', color: 'var(--status-dropped)' }}>{error}</span>}
    </span>
  )
}

export default function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [book, setBook] = useState<BookDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<'info' | 'chapters' | 'characters' | 'fields'>('info')

  // Edit state
  const [editingChapter, setEditingChapter] = useState(false)
  const [chapterInput, setChapterInput] = useState(0)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState('')

  // Custom fields state
  const [fields, setFields] = useState<{ key: string; value: string }[]>([])
  const [savingFields, setSavingFields] = useState(false)

  // Character form
  const [charName, setCharName] = useState('')
  const [charRole, setCharRole] = useState('')
  const [charDesc, setCharDesc] = useState('')
  const [addingChar, setAddingChar] = useState(false)

  // Chapter groups state
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())

  // Scroll state for header shadow
  const [scrolled, setScrolled] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  async function loadBook() {
    setLoading(true)
    const res = await fetch(`/api/books/${id}`)
    if (res.ok) {
      const data = await res.json()
      setBook(data)
      setChapterInput(data.currentChapter)
      setTitleInput(data.title)
      setFields(data.customFields.map((f: CustomField) => ({ key: f.key, value: f.value })))
    }
    setLoading(false)
  }

  useEffect(() => {
    loadBook()
  }, [id])

  useEffect(() => {
    // Auto-expand the group containing current chapter
    if (book && book.chapters.length > 0) {
      const groupIndex = Math.floor((book.currentChapter - 1) / 50)
      setExpandedGroups(new Set([groupIndex]))
    }
  }, [book?.id])

  useEffect(() => {
    const es = new EventSource('/api/books/events')
    es.addEventListener('book_updated', (e) => {
      const updated: BookEvent = JSON.parse(e.data)
      if (updated.id !== parseInt(id)) return
      setBook(prev => prev ? { ...prev, ...updated } : prev)
      setChapterInput(updated.currentChapter)
    })
    return () => es.close()
  }, [id])

  async function updateChapter() {
    await updateBook(parseInt(id), { currentChapter: chapterInput } as any)
    setEditingChapter(false)
    loadBook()
  }

  async function toggleFavorite() {
    if (!book) return
    await updateBook(parseInt(id), { isFavorite: !book.isFavorite } as any)
    loadBook()
  }

  async function updateStatus(status: string) {
    await updateBook(parseInt(id), { status } as any)
    loadBook()
  }

  async function saveFields() {
    setSavingFields(true)
    await updateBook(parseInt(id), { customFields: fields } as any)
    setSavingFields(false)
    loadBook()
  }

  async function addCharacter() {
    if (!charName.trim()) return
    setAddingChar(true)
    await fetch(`/api/books/${id}/characters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: charName.trim(), role: charRole.trim() || null, description: charDesc.trim() || null }),
    })
    setCharName(''); setCharRole(''); setCharDesc('')
    setAddingChar(false)
    loadBook()
  }

  async function removeCharacter(charId: number) {
    await fetch(`/api/books/${id}/characters`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: charId }),
    })
    loadBook()
  }

  async function handleDelete() {
    if (!book) return
    if (!confirm(`Delete "${book.title}"? This cannot be undone.`)) return
    await deleteBook(parseInt(id))
    router.push('/')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      <div style={{ height: '56px' }} />
      <div style={{ display: 'flex', gap: '24px', padding: '40px 24px' }}>
        <div className="skeleton" style={{ width: '160px', height: '230px', borderRadius: '10px', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ height: '24px', width: '60%', marginBottom: '12px' }} />
          <div className="skeleton" style={{ height: '14px', width: '30%', marginBottom: '16px' }} />
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
            {[80, 60, 70].map((w, i) => (
              <div key={i} className="skeleton" style={{ height: '22px', width: `${w}px`, borderRadius: '4px' }} />
            ))}
          </div>
          <div className="skeleton" style={{ height: '4px', width: '300px', borderRadius: '2px' }} />
        </div>
      </div>
    </div>
  )

  if (!book) return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--status-dropped)' }}>
      Book not found. <Link href="/" style={{ color: 'var(--accent)', marginLeft: '8px' }}>Go back</Link>
    </div>
  )

  const progress = book.totalChapters > 0 ? Math.min((book.currentChapter / book.totalChapters) * 100, 100) : 0

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
        {/* Header */}
        <header
          suppressHydrationWarning
          style={{
          padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center',
          gap: '12px', borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, zIndex: 30,
          backgroundColor: 'rgba(13,13,13,0.95)', backdropFilter: 'blur(8px)',
          boxShadow: scrolled ? '0 1px 12px rgba(0,0,0,0.5)' : 'none',
          transition: 'box-shadow 0.2s',
        }}>
          <button
            onClick={() => router.back()}
            style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}
          >
            ← Back
          </button>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }} className="line-clamp-1">{book.title}</span>
      </header>

      {/* Hero Banner */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Blurred background cover */}
        {book.coverUrl && (
          <div style={{
            position: 'absolute',
            inset: '-20px',
            backgroundImage: `url(${book.coverUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(30px) brightness(0.3)',
            transform: 'scale(1.1)',
          }} />
        )}

        {/* Gradient overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: book.coverUrl
            ? 'linear-gradient(to bottom, rgba(13,13,13,0.4) 0%, rgba(13,13,13,0.95) 100%)'
            : 'linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(13,13,13,0.85) 100%)',
        }} />

        {/* Content */}
        <motion.div
          suppressHydrationWarning
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{
          position: 'relative',
          padding: '40px 24px 32px',
          display: 'flex',
          gap: '24px',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
        }}>
          {/* Cover image */}
          <div style={{
            position: 'relative',
            width: '160px',
            height: '230px',
            borderRadius: '10px',
            overflow: 'hidden',
            flexShrink: 0,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            border: '2px solid rgba(255,255,255,0.1)',
          }}>
            {book.coverUrl ? (
              <Image src={book.coverUrl} alt={book.title} fill style={{ objectFit: 'cover' }} sizes="160px" />
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                fontSize: '60px',
                backgroundColor: '#1a1a2e',
              }}>
                📖
              </div>
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: '260px' }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '6px' }}>
            {editingTitle ? (
              <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                <input
                  style={inlineInputStyle}
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { updateBook(parseInt(id), { title: titleInput } as any).then(loadBook); setEditingTitle(false) }
                    if (e.key === 'Escape') setEditingTitle(false)
                  }}
                  autoFocus
                />
                <button onClick={() => { updateBook(parseInt(id), { title: titleInput } as any).then(loadBook); setEditingTitle(false) }} style={smallBtnStyle}>✓</button>
                <button onClick={() => setEditingTitle(false)} style={{ ...smallBtnStyle, backgroundColor: 'transparent' }}>✕</button>
              </div>
            ) : (
              <h1 onClick={() => setEditingTitle(true)} style={{ margin: 0, fontSize: '22px', fontWeight: 800, lineHeight: 1.2, cursor: 'text', flex: 1 }}>
                {book.title}
              </h1>
            )}
            <button
              onClick={toggleFavorite}
              title={book.isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
              style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
            >
              {book.isFavorite ? '⭐' : '☆'}
            </button>
          </div>

          {book.author && <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px' }}>{book.author}</div>}

          {/* Badges */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, backgroundColor: STATUS_COLORS[book.status], color: '#fff' }}>
              {STATUS_LABELS[book.status]}
            </span>
            <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              {TYPE_LABELS[book.type]}
            </span>
            {book.genre && book.genre.split(',').slice(0, 2).map((g) => (
              <span key={g} style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                {g.trim()}
              </span>
            ))}
            {book.yearRead && <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              {book.yearRead}
            </span>}
          </div>

          {/* Chapter progress */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <button
                onClick={async () => {
                  const newCh = Math.max(0, book.currentChapter - 1)
                  setChapterInput(newCh)
                  await updateBook(parseInt(id), { currentChapter: newCh } as any)
                  loadBook()
                }}
                title="Previous chapter"
                style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}
              >
                −
              </button>
              {editingChapter ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Ch.</span>
                  <input
                    type="number" min={0} max={book.totalChapters || 99999}
                    style={{ ...inlineInputStyle, width: '80px' }}
                    value={chapterInput}
                    onChange={(e) => setChapterInput(parseInt(e.target.value) || 0)}
                    onKeyDown={(e) => { if (e.key === 'Enter') updateChapter(); if (e.key === 'Escape') setEditingChapter(false) }}
                    autoFocus
                  />
                  <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>/ {book.totalChapters}</span>
                  <button onClick={updateChapter} style={smallBtnStyle}>✓</button>
                  <button onClick={() => setEditingChapter(false)} style={{ ...smallBtnStyle, backgroundColor: 'transparent' }}>✕</button>
                </div>
              ) : (
                <span style={{ fontSize: '15px', fontWeight: 600, cursor: 'pointer', minWidth: '120px' }} onClick={() => setEditingChapter(true)}>
                  Ch. {book.currentChapter}
                  {book.totalChapters > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> / {book.totalChapters}</span>}
                </span>
              )}
              <button
                onClick={async () => {
                  const newCh = Math.min(book.totalChapters || book.currentChapter + 1, book.currentChapter + 1)
                  setChapterInput(newCh)
                  await updateBook(parseInt(id), { currentChapter: newCh } as any)
                  loadBook()
                }}
                title="Next chapter"
                style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}
              >
                +
              </button>
              {book.currentChapterUrl && (
                <a href={book.currentChapterUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: 'var(--accent)' }}>
                  ↗ Open chapter
                </a>
              )}
            </div>
            {book.totalChapters > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ height: '4px', backgroundColor: 'var(--border)', borderRadius: '2px', maxWidth: '300px', flex: 1 }}>
                  <div style={{
                    height: '100%',
                    width: `${progress}%`,
                    backgroundColor: STATUS_COLORS[book.status],
                    borderRadius: '2px',
                    animation: 'progress-fill 0.6s ease-out forwards',
                  }} />
                </div>
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ fontSize: '12px', color: 'var(--text-muted)' }}
                >
                  {progress.toFixed(0)}%
                </motion.span>
              </div>
            )}
          </div>

          {/* Quick status change */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['READING', 'COMPLETED', 'PLAN_TO_READ', 'DROPPED'].map((s) => (
              <button
                key={s}
                onClick={() => updateStatus(s)}
                style={{
                  padding: '3px 10px', fontSize: '11px', cursor: 'pointer',
                  backgroundColor: book.status === s ? STATUS_COLORS[s] : 'transparent',
                  border: `1px solid ${book.status === s ? STATUS_COLORS[s] : 'var(--border)'}`,
                  borderRadius: '4px', color: book.status === s ? '#fff' : 'var(--text-muted)',
                }}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          {book.siteUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
              <a href={book.siteUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--accent)' }}>
                ↗ View on site
              </a>
              <RefreshButton bookId={book.id} onRefreshed={setBook} />
            </div>
          )}
        </div>

        </motion.div>
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: '0', padding: '20px 24px 0', borderBottom: '1px solid var(--border)', marginTop: '16px' }}>
        {[
          { id: 'info', label: 'Info' },
          { id: 'chapters', label: `Chapters (${book.chapters.length})` },
          { id: 'characters', label: `Characters (${book.characters.length})` },
          { id: 'fields', label: `Custom Fields (${book.customFields.length})` },
        ].map((s) => {
          const isActive = activeSection === s.id as any
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id as any)}
              style={{
                padding: '10px 16px', border: 'none', cursor: 'pointer',
                backgroundColor: 'transparent', color: isActive ? '#fff' : 'var(--text-muted)',
                fontWeight: isActive ? 600 : 400, fontSize: '13px',
                position: 'relative',
              }}
            >
              {s.label}
              {isActive && (
                <motion.div
                  layoutId="section-indicator"
                  style={{
                    position: 'absolute',
                    bottom: -20,
                    left: 0,
                    right: 0,
                    height: '2px',
                    backgroundColor: 'var(--accent)',
                    borderRadius: '1px',
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Section content */}
      <div
        ref={contentRef}
        suppressHydrationWarning
        onScroll={(e) => {
          const el = e.currentTarget as HTMLDivElement
          setScrolled(el.scrollTop > 0)
        }}
        style={{ padding: '20px 24px', maxWidth: '900px', flex: 1, overflow: 'auto' }}>
        {/* Info section */}
        {activeSection === 'info' && (
          <div>
            {book.description ? (
              <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--text-muted)', whiteSpace: 'pre-line', maxWidth: '700px' }}>
                {book.description}
              </p>
            ) : (
              <p style={{ color: 'var(--text-dim)', fontSize: '14px' }}>No description available.</p>
            )}
          </div>
        )}

        {/* Chapters section */}
        {activeSection === 'chapters' && (
          <div>
            {book.chapters.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', fontSize: '14px' }}>No chapter list available. Add this book with a URL to scrape chapters.</p>
            ) : (
              <div>
                {(() => {
                  // Group chapters into 50-chapter batches
                  const groups: { start: number; end: number; chapters: typeof book.chapters }[] = []
                  for (let i = 0; i < book.chapters.length; i += 50) {
                    const batch = book.chapters.slice(i, i + 50)
                    const start = batch[0].number
                    const end = batch[batch.length - 1].number
                    groups.push({ start, end, chapters: batch })
                  }

                  return groups.map((group, groupIdx) => {
                    const isExpanded = expandedGroups.has(groupIdx)
                    const groupContainsCurrent = book.currentChapter >= group.start && book.currentChapter <= group.end

                    return (
                      <div key={groupIdx} style={{ marginBottom: '4px' }}>
                        {/* Group header */}
                        <button
                          onClick={() => {
                            setExpandedGroups(prev => {
                              const next = new Set(prev)
                              if (next.has(groupIdx)) next.delete(groupIdx)
                              else next.add(groupIdx)
                              return next
                            })
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            backgroundColor: groupContainsCurrent ? 'var(--accent-bg)' : 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            color: groupContainsCurrent ? 'var(--accent)' : 'var(--text)',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            marginBottom: isExpanded ? '4px' : 0,
                          }}
                        >
                          <span>Chapters {group.start}–{group.end}</span>
                          <motion.span
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            style={{ fontSize: '12px', display: 'inline-block' }}
                          >
                            ▼
                          </motion.span>
                        </button>

                        {/* Expanded content */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              style={{ overflow: 'hidden' }}
                            >
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '4px' }}>
                                <tbody>
                                  {group.chapters.map((ch) => {
                                    const isCurrent = ch.number === book.currentChapter
                                    const isRead = ch.number < book.currentChapter
                                    return (
                                      <tr key={ch.id} style={{
                                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                                        backgroundColor: isCurrent ? 'var(--accent-bg)' : 'transparent',
                                        opacity: isRead && !isCurrent ? 0.5 : 1,
                                      }}>
                                        <td style={{ padding: '6px 12px', width: '50px' }}>
                                          <span style={{ color: 'var(--status-reading)', marginRight: '4px', fontSize: '10px' }}>
                                            {isRead ? '✓' : ' '}
                                          </span>
                                          <a href={ch.url} target="_blank" rel="noreferrer" style={{ color: isCurrent ? 'var(--accent)' : 'var(--text-dim)', textDecoration: 'none', cursor: 'pointer' }}>
                                            {ch.number}
                                          </a>
                                        </td>
                                        <td style={{ padding: '6px 12px' }}>
                                          <a href={ch.url} target="_blank" rel="noreferrer" style={{ color: isCurrent ? 'var(--accent)' : 'var(--text)', textDecoration: 'none', cursor: 'pointer' }}>
                                            {ch.title || `Chapter ${ch.number}`}
                                          </a>
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )
                  })
                })()}
              </div>
            )}
          </div>
        )}

        {/* Characters section */}
        {activeSection === 'characters' && (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
              {book.characters.map((char: Character) => (
                <div key={char.id} style={{
                  backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '10px 12px', minWidth: '140px', maxWidth: '200px',
                  position: 'relative',
                }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '2px' }}>{char.name}</div>
                  {char.role && <div style={{ fontSize: '11px', color: 'var(--accent)', marginBottom: '4px' }}>{char.role}</div>}
                  {char.description && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }} className="line-clamp-2">{char.description}</div>}
                  <button
                    onClick={() => removeCharacter(char.id)}
                    style={{
                      position: 'absolute', top: '4px', right: '4px',
                      background: 'none', border: 'none', color: 'var(--text-dim)',
                      fontSize: '12px', cursor: 'pointer', padding: '2px 4px',
                    }}
                  >✕</button>
                </div>
              ))}
            </div>

            {/* Add character form */}
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', maxWidth: '400px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-muted)' }}>Add Character</div>
              <input style={formInputStyle} placeholder="Name *" value={charName} onChange={(e) => setCharName(e.target.value)} />
              <input style={formInputStyle} placeholder="Role (e.g. Protagonist)" value={charRole} onChange={(e) => setCharRole(e.target.value)} />
              <input style={formInputStyle} placeholder="Description (optional)" value={charDesc} onChange={(e) => setCharDesc(e.target.value)} />
              <button onClick={addCharacter} disabled={addingChar || !charName.trim()} style={smallPrimaryBtn}>
                {addingChar ? 'Adding…' : '+ Add'}
              </button>
            </div>
          </div>
        )}

        {/* Custom Fields section */}
        {activeSection === 'fields' && (
          <div style={{ maxWidth: '500px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Add custom key-value pairs like "Power Level", "Rank", "Harem Count", etc.
            </p>
            {fields.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  style={{ ...formInputStyle, flex: 1 }}
                  placeholder="Key (e.g. Power Level)"
                  value={f.key}
                  onChange={(e) => setFields(fields.map((x, j) => j === i ? { ...x, key: e.target.value } : x))}
                />
                <input
                  style={{ ...formInputStyle, flex: 1 }}
                  placeholder="Value"
                  value={f.value}
                  onChange={(e) => setFields(fields.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                />
                <button
                  onClick={() => setFields(fields.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-dim)', fontSize: '13px', padding: '0 8px', cursor: 'pointer' }}
                >✕</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button onClick={() => setFields([...fields, { key: '', value: '' }])} style={secondarySmallBtn}>
                + Add Field
              </button>
              <button onClick={saveFields} disabled={savingFields} style={smallPrimaryBtn}>
                {savingFields ? 'Saving…' : 'Save Fields'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const inlineInputStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)', border: '1px solid var(--accent)',
  borderRadius: '4px', color: 'var(--text)', padding: '4px 8px', fontSize: '14px',
  outline: 'none', flex: 1, boxSizing: 'border-box',
}

const formInputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', marginBottom: '8px',
  backgroundColor: '#111', border: '1px solid var(--border)',
  borderRadius: '6px', color: 'var(--text)', fontSize: '13px', outline: 'none',
}

const smallBtnStyle: React.CSSProperties = {
  padding: '4px 10px', backgroundColor: 'var(--accent)',
  border: 'none', borderRadius: '4px', color: '#fff',
  fontSize: '12px', cursor: 'pointer',
}

const smallPrimaryBtn: React.CSSProperties = {
  padding: '7px 16px', backgroundColor: 'var(--accent)',
  border: 'none', borderRadius: '6px', color: '#fff',
  fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'transform var(--duration-fast) var(--ease-out-expo)',
}

const secondarySmallBtn: React.CSSProperties = {
  padding: '7px 12px', backgroundColor: 'transparent',
  border: '1px solid var(--border)', borderRadius: '6px',
  color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer',
}
