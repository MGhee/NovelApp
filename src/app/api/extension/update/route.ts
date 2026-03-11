import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { bookEmitter } from '@/lib/events'
import { extractBookUrl, normalizeUrl } from '@/lib/utils'

function buildUrlCandidates(inputUrl: string): string[] {
  const candidates = new Set<string>()

  const addForms = (raw: string) => {
    if (!raw) return
    const trimmed = raw.trim()
    if (!trimmed) return

    candidates.add(trimmed)
    const normalized = normalizeUrl(trimmed)
    candidates.add(normalized)
    candidates.add(`${normalized}/`)
    candidates.add(normalized.replace(/\/$/, ''))

    try {
      const u = new URL(normalized)
      const noWwwHost = u.hostname.replace(/^www\./, '')
      const withNoWww = `${u.protocol}//${noWwwHost}${u.pathname}`.replace(/\/$/, '')
      candidates.add(withNoWww)
      candidates.add(`${withNoWww}/`)
    } catch {
      // Ignore malformed URL candidates.
    }
  }

  addForms(inputUrl)
  const extracted = extractBookUrl(inputUrl)
  if (extracted) addForms(extracted)

  return [...candidates]
}

export async function POST(req: NextRequest) {
  const { siteUrl, chapterNumber, chapterUrl } = await req.json()
  if (!siteUrl || typeof chapterNumber !== 'number') {
    return NextResponse.json({ error: 'siteUrl and chapterNumber are required' }, { status: 400 })
  }

  // The extension sends chapter URL; build robust variants to match stored siteUrl.
  const urlCandidates = buildUrlCandidates(siteUrl)

  const book = await prisma.book.findFirst({
    where: { siteUrl: { in: urlCandidates } },
    select: { id: true, currentChapter: true, status: true },
  })

  if (!book) {
    return NextResponse.json({ updated: false, book: null })
  }

  const updated = await prisma.book.update({
    where: { id: book.id },
    data: {
      currentChapter: chapterNumber,
      currentChapterUrl: chapterUrl || null,
      // Auto-promote to READING if was Plan To Read
      status: book.status === 'PLAN_TO_READ' ? 'READING' : undefined,
    },
    select: {
      id: true,
      title: true,
      author: true,
      coverUrl: true,
      status: true,
      type: true,
      currentChapter: true,
      currentChapterUrl: true,
      totalChapters: true,
      siteUrl: true,
      genre: true,
      isFavorite: true,
      yearRead: true,
      updatedAt: true,
    },
  })

  bookEmitter.emit('book_updated', {
    ...updated,
    updatedAt: updated.updatedAt.toISOString(),
  })

  return NextResponse.json({ updated: true, book: updated })
}
