'use client'

import { useState } from 'react'
import type { ScrapeResult } from '@/lib/types'
import { createBook } from '@/hooks/useBooks'

interface AddBookModalProps {
  onClose: () => void
  onAdded: () => void
  initialUrl?: string
}

type Step = 'url' | 'confirm' | 'success'

const TYPE_OPTIONS = [
  { value: 'WEB_NOVEL', label: 'Web Novel' },
  { value: 'LIGHT_NOVEL', label: 'Light Novel' },
  { value: 'MANGA', label: 'Manga' },
  { value: 'MANHWA', label: 'Manhwa' },
]

const STATUS_OPTIONS = [
  { value: 'READING', label: 'Reading' },
  { value: 'PLAN_TO_READ', label: 'Plan to Read' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'DROPPED', label: 'Dropped' },
]

export default function AddBookModal({ onClose, onAdded, initialUrl = '' }: AddBookModalProps) {
  const [step, setStep] = useState<Step>('url')
  const [url, setUrl] = useState(initialUrl)
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState('')
  const [scraped, setScraped] = useState<ScrapeResult | null>(null)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [description, setDescription] = useState('')
  const [genre, setGenre] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [status, setStatus] = useState('PLAN_TO_READ')
  const [type, setType] = useState('WEB_NOVEL')
  const [currentChapter, setCurrentChapter] = useState(0)

  async function handleScrape() {
    if (!url.trim()) {
      setScrapeError('Please enter a URL')
      return
    }
    setScraping(true)
    setScrapeError('')
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scrape failed')
      setScraped(data)
      setTitle(data.title || '')
      setAuthor(data.author || '')
      setDescription(data.description || '')
      setGenre(data.genre || '')
      setCoverUrl(data.coverUrl || '')
      setStep('confirm')
    } catch (e) {
      setScrapeError(e instanceof Error ? e.message : 'Failed to scrape')
    } finally {
      setScraping(false)
    }
  }

  function handleSkipScrape() {
    setScraped(null)
    setStep('confirm')
  }

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    try {
      await createBook({
        title: title.trim(),
        author: author.trim() || undefined,
        coverUrl: coverUrl.trim() || undefined,
        description: description.trim() || undefined,
        genre: genre.trim() || undefined,
        status,
        type,
        siteUrl: url.trim() || undefined,
        currentChapter,
        totalChapters: scraped?.totalChapters || 0,
        chapters: scraped?.chapters || [],
      } as any)
      setStep('success')
      onAdded()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50, padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-modal)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
            {step === 'url' ? 'Add Book' : step === 'confirm' ? 'Confirm Details' : '✓ Book Added'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>

        {step === 'url' && (
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>
              Paste a book URL to auto-fill details, or skip to enter manually.
            </p>
            <label style={labelStyle}>Book URL</label>
            <input
              style={inputStyle}
              placeholder="https://readnovelfull.com/book-title.html"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
              autoFocus
            />
            {scrapeError && <p style={{ color: 'var(--status-dropped)', fontSize: '12px', marginTop: '6px' }}>{scrapeError}</p>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={handleScrape} disabled={scraping} style={primaryBtnStyle}>
                {scraping ? 'Scraping…' : 'Scrape & Fill'}
              </button>
              <button onClick={handleSkipScrape} style={secondaryBtnStyle}>
                Skip (Manual)
              </button>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div>
            {scraped && (
              <div style={{ marginBottom: '12px', padding: '8px 12px', backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: '6px', fontSize: '12px', color: 'var(--accent)' }}>
                ✓ Scraped — {scraped.totalChapters} chapters found
              </div>
            )}

            <label style={labelStyle}>Title *</label>
            <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />

            <label style={labelStyle}>Author</label>
            <input style={inputStyle} value={author} onChange={(e) => setAuthor(e.target.value)} />

            <label style={labelStyle}>Cover URL</label>
            <input style={inputStyle} value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} />

            <label style={labelStyle}>Genre</label>
            <input style={inputStyle} value={genre} onChange={(e) => setGenre(e.target.value)} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Type</label>
                <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
                  {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <label style={labelStyle}>Current Chapter</label>
            <input
              style={inputStyle}
              type="number"
              min={0}
              value={currentChapter}
              onChange={(e) => setCurrentChapter(parseInt(e.target.value) || 0)}
            />

            <label style={labelStyle}>Description</label>
            <textarea
              style={{ ...inputStyle, height: '80px', resize: 'vertical' }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={handleSave} disabled={saving || !title.trim()} style={primaryBtnStyle}>
                {saving ? 'Saving…' : 'Add Book'}
              </button>
              <button onClick={() => setStep('url')} style={secondaryBtnStyle}>Back</button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📚</div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>"{title}" has been added to your list.</p>
            <button onClick={onClose} style={primaryBtnStyle}>Done</button>
          </div>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', color: 'var(--text-muted)',
  marginBottom: '4px', marginTop: '12px',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px',
  backgroundColor: '#111', border: '1px solid var(--border)',
  borderRadius: '6px', color: 'var(--text)', fontSize: '13px',
  outline: 'none',
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '8px 20px', backgroundColor: 'var(--accent)',
  border: 'none', borderRadius: '6px', color: '#fff',
  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
}

const secondaryBtnStyle: React.CSSProperties = {
  padding: '8px 16px', backgroundColor: 'transparent',
  border: '1px solid var(--border)', borderRadius: '6px',
  color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer',
}
