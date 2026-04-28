'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { BookSummary } from '@/lib/types'
import { deleteBook, updateBook } from '@/hooks/useBooks'

const STATUS_COLORS: Record<string, string> = {
  READING: 'var(--status-reading)',
  COMPLETED: 'var(--status-completed)',
  PLAN_TO_READ: 'var(--status-plan)',
  DROPPED: 'var(--status-dropped)',
}

const STATUS_LABELS: Record<string, string> = {
  READING: 'Reading',
  COMPLETED: 'Done',
  PLAN_TO_READ: 'Plan',
  DROPPED: 'Waiting',
}

const TYPE_BADGE_LABELS: Record<string, string> = {
  MANGA: 'Manga',
  MANHWA: 'Manhwa',
}

interface BookCardProps {
  book: BookSummary
  onDeleted: () => void
  onUpdated: () => void
}

function BookCard({ book, onDeleted, onUpdated }: BookCardProps) {
  const [deleting, setDeleting] = useState(false)
  const [hover, setHover] = useState(false)

  const progress = book.totalChapters > 0
    ? Math.min((book.currentChapter / book.totalChapters) * 100, 100)
    : 0

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Remove "${book.title}" from your list?`)) return
    setDeleting(true)
    await deleteBook(book.id)
    onDeleted()
  }

  async function toggleFavorite(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    await updateBook(book.id, { isFavorite: !book.isFavorite } as any)
    onUpdated()
  }

  return (
    <Link href={`/books/${book.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <motion.div
        className="relative group"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        whileHover={{
          y: -4,
          boxShadow: '0 8px 30px rgba(0,0,0,0.4), 0 0 20px rgba(6,182,212,0.15)',
          borderColor: 'rgba(6,182,212,0.3)',
        }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          overflow: 'hidden',
          cursor: 'pointer',
          width: '210px',
        }}
      >
        {/* Cover */}
        <div style={{ position: 'relative', width: '100%', height: '280px', backgroundColor: '#1a1a2e' }}>
          {book.coverUrl ? (
            <Image
              src={book.coverUrl}
              alt={book.title}
              fill
              style={{ objectFit: 'cover' }}
              sizes="160px"
              unoptimized
            />
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', fontSize: '40px', color: 'var(--text-dim)',
            }}>
              📖
            </div>
          )}

          {/* Status badge */}
          <div style={{
            position: 'absolute', top: '6px', left: '6px',
            backgroundColor: STATUS_COLORS[book.status],
            color: '#fff', fontSize: '10px', fontWeight: 700,
            padding: '2px 6px', borderRadius: '4px',
          }}>
            {STATUS_LABELS[book.status]}
          </div>

          {/* Type badge (manga/manhwa only) */}
          {TYPE_BADGE_LABELS[book.type] && (
            <div style={{
              position: 'absolute', bottom: '6px', left: '6px',
              backgroundColor: 'rgba(0,0,0,0.65)',
              color: '#fff', fontSize: '10px', fontWeight: 700,
              padding: '2px 6px', borderRadius: '4px',
              letterSpacing: '0.3px',
            }}>
              {TYPE_BADGE_LABELS[book.type]}
            </div>
          )}

          {/* Favorite star */}
          <button
            onClick={toggleFavorite}
            title={book.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            style={{
              position: 'absolute', top: '4px', right: '4px',
              background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%',
              width: '24px', height: '24px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px',
            }}
          >
            {book.isFavorite ? '⭐' : '☆'}
          </button>

          {/* Delete button on hover */}
          <AnimatePresence>
            {hover && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                onClick={handleDelete}
                disabled={deleting}
                title="Remove book"
                style={{
                  position: 'absolute', bottom: '6px', right: '6px',
                  background: 'rgba(239,68,68,0.85)', border: 'none', borderRadius: '4px',
                  color: '#fff', fontSize: '11px', padding: '2px 6px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Info */}
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div className="line-clamp-2" style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px', lineHeight: 1.3 }}>
            {book.title}
          </div>
          <div style={{ marginBottom: '4px' }}>
            {book.author && (
              <div className="line-clamp-1" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {book.author}
              </div>
            )}
          </div>

          {/* Genre tags */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
            {book.genre && (
              <>
                {book.genre.split(',').slice(0, 2).map((g) => (
                  <span key={g.trim()} style={{
                    fontSize: '9px',
                    padding: '1px 6px',
                    borderRadius: '3px',
                    backgroundColor: 'var(--genre-bg)',
                    color: 'var(--genre-text)',
                    whiteSpace: 'nowrap',
                    border: '1px solid rgba(6,182,212,0.15)',
                  }}>
                    {g.trim()}
                  </span>
                ))}
              </>
            )}
          </div>

          {/* Chapter progress text */}
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
            {book.totalChapters > 0
              ? `Ch. ${book.currentChapter} / ${book.totalChapters}`
              : book.currentChapter > 0
                ? `Ch. ${book.currentChapter}`
                : '—'}
          </div>

          {/* Progress bar */}
          {book.totalChapters > 0 && (
            <div style={{ height: '4px', backgroundColor: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                backgroundColor: STATUS_COLORS[book.status],
                borderRadius: '3px',
                transition: 'width 0.3s',
                boxShadow: `0 0 8px ${STATUS_COLORS[book.status]}80`,
                animation: 'progress-fill 0.6s ease-out forwards',
              }} />
            </div>
          )}
        </div>
      </motion.div>
    </Link>
  )
}

const arePropsEqual = (prev: BookCardProps, next: BookCardProps) => {
  return (
    prev.book.id === next.book.id &&
    prev.book.currentChapter === next.book.currentChapter &&
    prev.book.totalChapters === next.book.totalChapters &&
    prev.book.status === next.book.status &&
    prev.book.isFavorite === next.book.isFavorite &&
    prev.book.coverUrl === next.book.coverUrl &&
    prev.book.updatedAt === next.book.updatedAt &&
    prev.book.title === next.book.title &&
    prev.book.type === next.book.type
  )
}

export default (React as any).memo(BookCard, arePropsEqual)
