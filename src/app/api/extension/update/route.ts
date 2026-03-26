import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { bookEmitter } from '@/lib/events'
import { extractBookUrl, normalizeUrl } from '@/lib/utils'
import { isAllowed } from '@/lib/rateLimiter'
import { invalidateCache } from '@/lib/bookListCache'

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
  // Basic rate limiting by IP for extension updates
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || 'unknown'
  if (!isAllowed(`ext-update:${ip}`, 60, 60)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
  const { siteUrl, chapterNumber, chapterUrl } = await req.json()
  if (!siteUrl || typeof chapterNumber !== 'number') {
    return NextResponse.json({ error: 'siteUrl and chapterNumber are required' }, { status: 400 })
  }

  // Log whether an Authorization header was supplied (don't log the token)
  console.debug('/api/extension/update: auth header present=', !!req.headers.get('authorization'))

  // The extension sends chapter URL; build robust variants to match stored siteUrl.
  const urlCandidates = buildUrlCandidates(siteUrl)

  const book = await prisma.book.findFirst({
    where: { siteUrl: { in: urlCandidates } },
    select: { id: true, title: true, currentChapter: true, currentChapterUrl: true, status: true },
  })

  if (!book) {
    console.debug('/api/extension/update: no matching book for candidates', urlCandidates)
    // Include candidates in response for easier local debugging
    return NextResponse.json({ updated: false, book: null, candidates: urlCandidates })
  }

  console.debug('/api/extension/update: found book', { id: book.id, currentChapter: book.currentChapter, incomingChapter: chapterNumber })

  // Enforce progress-only-increases invariant
  if (chapterNumber < book.currentChapter) {
    // User is behind; don't regress progress but offer redirect to latest chapter
    // Always look up from Chapter table first (it's authoritative)
    const chapter = await prisma.chapter.findFirst({
      where: { bookId: book.id, number: book.currentChapter },
      select: { url: true },
    })
    const redirectUrl = chapter?.url || book.currentChapterUrl || null

    console.debug('/api/extension/update: chapter behind current, offering redirect', {
      id: book.id,
      incomingChapter: chapterNumber,
      currentChapter: book.currentChapter,
      redirectUrl: !!redirectUrl,
    })

    return NextResponse.json({
      updated: false,
      book: { id: book.id, title: book.title, currentChapter: book.currentChapter },
      redirectUrl,
      serverChapter: book.currentChapter,
    })
  }

  // Chapter >= current, update normally
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

  invalidateCache()
  bookEmitter.emit('book_updated', {
    ...updated,
    updatedAt: updated.updatedAt.toISOString(),
  })

  return NextResponse.json({ updated: true, book: updated, redirectUrl: null })
  } catch (err: any) {
    if (err && (err.code === 'ECONNRESET' || /aborted/i.test(String(err.message || '')))) {
      console.warn('Request aborted (ECONNRESET) in /api/extension/update', err?.stack || err)
      return NextResponse.json({ error: 'Request aborted' }, { status: 499 })
    }
    console.error('Error in /api/extension/update', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
