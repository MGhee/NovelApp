'use client'

import { useState, useEffect, use } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { BookDetail, Character, CustomField } from '@/lib/types'
import { updateBook, deleteBook } from '@/hooks/useBooks'
import { useRouter } from 'next/navigation'

const STATUS_COLORS: Record<string, string> = {
  READING: 'var(--status-reading)',
  COMPLETED: 'var(--status-completed)',
  PLAN_TO_READ: 'var(--status-plan)',
  DROPPED: 'var(--status-dropped)',
}

const STATUS_LABELS: Record<string, string> = {
  READING: 'Reading',
  COMPLETED: 'Completed',
  PLAN_TO_READ: 'Plan to Read',
  DROPPED: 'Dropped',
}

const TYPE_LABELS: Record<string, string> = {
  WEB_NOVEL: 'Web Novel',
  LIGHT_NOVEL: 'Light Novel',
  MANGA: 'Manga',
  MANHWA: 'Manhwa',
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

  useEffect(() => { loadBook() }, [id])

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
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      Loading…
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
      <header style={{
        padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center',
        gap: '12px', borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, zIndex: 30,
        backgroundColor: 'rgba(13,13,13,0.95)', backdropFilter: 'blur(8px)',
      }}>
        <Link href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '13px' }}>
          ← Back
        </Link>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }} className="line-clamp-1">{book.title}</span>
      </header>

      {/* Hero */}
      <div style={{ padding: '24px 24px 0', display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Cover */}
        <div style={{ position: 'relative', width: '140px', height: '200px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, backgroundColor: '#1a1a2e' }}>
          {book.coverUrl ? (
            <Image src={book.coverUrl} alt={book.title} fill style={{ objectFit: 'cover' }} sizes="140px" />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '40px' }}>📖</div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 600 }}>
                    Ch. {book.currentChapter}
                    {book.totalChapters > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> / {book.totalChapters}</span>}
                  </span>
                  <button onClick={() => setEditingChapter(true)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-muted)', fontSize: '11px', padding: '2px 8px', cursor: 'pointer' }}>
                    Edit
                  </button>
                  {book.currentChapterUrl && (
                    <a href={book.currentChapterUrl} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: 'var(--accent)' }}>
                      ↗ Open chapter
                    </a>
                  )}
                </div>
              )}
            </div>
            {book.totalChapters > 0 && (
              <div style={{ height: '4px', backgroundColor: 'var(--border)', borderRadius: '2px', maxWidth: '300px' }}>
                <div style={{ height: '100%', width: `${progress}%`, backgroundColor: STATUS_COLORS[book.status], borderRadius: '2px' }} />
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
            <a href={book.siteUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: '10px', fontSize: '12px', color: 'var(--accent)' }}>
              ↗ View on site
            </a>
          )}
        </div>

        {/* Delete button */}
        <button onClick={handleDelete} style={{ background: 'none', border: '1px solid var(--status-dropped)', borderRadius: '6px', color: 'var(--status-dropped)', fontSize: '12px', padding: '6px 12px', cursor: 'pointer', alignSelf: 'flex-start' }}>
          Delete
        </button>
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
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              {s.label}
            </button>
          )
        })}
      </div>

      {/* Section content */}
      <div style={{ padding: '20px 24px', maxWidth: '900px' }}>
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
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px 0', textAlign: 'left', fontWeight: 500, width: '60px' }}>#</th>
                      <th style={{ padding: '8px 0', textAlign: 'left', fontWeight: 500 }}>Chapter</th>
                      <th style={{ padding: '8px 0', textAlign: 'right', fontWeight: 500, width: '60px' }}>Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {book.chapters.map((ch) => {
                      const isCurrent = ch.number === book.currentChapter
                      return (
                        <tr key={ch.id} style={{
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          backgroundColor: isCurrent ? 'rgba(99,102,241,0.08)' : 'transparent',
                        }}>
                          <td style={{ padding: '6px 0', color: isCurrent ? 'var(--accent)' : 'var(--text-dim)' }}>{ch.number}</td>
                          <td style={{ padding: '6px 0' }}>{ch.title || `Chapter ${ch.number}`}</td>
                          <td style={{ padding: '6px 0', textAlign: 'right' }}>
                            <a href={ch.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', fontSize: '11px' }}>↗</a>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
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
  outline: 'none', flex: 1,
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
  fontSize: '12px', fontWeight: 600, cursor: 'pointer',
}

const secondarySmallBtn: React.CSSProperties = {
  padding: '7px 12px', backgroundColor: 'transparent',
  border: '1px solid var(--border)', borderRadius: '6px',
  color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer',
}
