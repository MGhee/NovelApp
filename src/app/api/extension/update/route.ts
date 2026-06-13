import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { bookEmitter } from '@/lib/events'
import { buildBookUrlCandidates } from '@/lib/utils'
import { isAllowed } from '@/lib/rateLimiter'
import { invalidateCache } from '@/lib/bookListCache'
import { getUserId } from '@/lib/getUserId'

function isConnReset(err: unknown) {
  if (!(err instanceof Error)) return false
  const errorWithCode = err as Error & { code?: string }
  return errorWithCode.code === 'ECONNRESET' || /aborted/i.test(err.message)
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
    const urlCandidates = buildBookUrlCandidates(siteUrl)

    let book = await prisma.book.findFirst({
      where: { userId, siteUrl: { in: urlCandidates } },
      select: { id: true, title: true, currentChapter: true, currentChapterUrl: true, status: true, totalChapters: true },
    })

    if (!book) {
      book = await prisma.book.findFirst({
        where: {
          userId,
          chapters: {
            some: {
              url: { in: urlCandidates },
            },
          },
        },
        select: { id: true, title: true, currentChapter: true, currentChapterUrl: true, status: true, totalChapters: true },
      })
    }

    if (!book) {
      console.debug('/api/extension/update: no matching book for candidates', urlCandidates)
      // Include candidates in response for easier local debugging
      return NextResponse.json({ updated: false, book: null, candidates: urlCandidates })
    }

    // Reconcile chapter numbering: the extension parses the chapter number from the URL,
    // but the Chapter table may use a different sequential index (e.g. Android syncs
    // sequential indices). Look up the incoming URL in the Chapter table to resolve.
    let resolvedChapter = chapterNumber
    if (chapterUrl) {
      const matchedChapter = await prisma.chapter.findFirst({
        where: { bookId: book.id, url: chapterUrl },
        select: { number: true },
      })
      if (matchedChapter) {
        resolvedChapter = matchedChapter.number
        console.debug('/api/extension/update: resolved chapter from URL', {
          urlParsed: chapterNumber,
          tableNumber: resolvedChapter,
        })
      }
    }

    console.debug('/api/extension/update: found book', { id: book.id, currentChapter: book.currentChapter, incomingChapter: resolvedChapter, totalChapters: book.totalChapters })

    // Reject chapter numbers that exceed totalChapters (prevents decimal chapters like 917.1 being parsed as 9171)
    if (book.totalChapters > 0 && resolvedChapter > book.totalChapters) {
      console.debug('/api/extension/update: chapter exceeds totalChapters, rejecting', {
        id: book.id,
        incomingChapter: resolvedChapter,
        totalChapters: book.totalChapters,
      })
      return NextResponse.json({
        updated: false,
        book: { id: book.id, title: book.title, currentChapter: book.currentChapter },
        error: `Chapter ${resolvedChapter} exceeds total chapters (${book.totalChapters})`,
        maxChapter: book.totalChapters,
      })
    }

    // Enforce progress-only-increases invariant
    if (resolvedChapter < book.currentChapter) {
      // User is behind; don't regress progress but offer redirect to latest chapter
      // Always look up from Chapter table first (it's authoritative)
      const chapter = await prisma.chapter.findFirst({
        where: { bookId: book.id, number: book.currentChapter },
        select: { url: true },
      })
      const redirectUrl = chapter?.url || book.currentChapterUrl || null

      console.debug('/api/extension/update: chapter behind current, offering redirect', {
        id: book.id,
        incomingChapter: resolvedChapter,
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

    // Chapter >= current, update normally.
    // Status policy: preserve whatever the user set. Only auto-promote to COMPLETED
    // when they reach the final chapter (and totalChapters is known).
    const totalKnown = book.totalChapters > 0
    const reachedEnd = totalKnown && resolvedChapter >= book.totalChapters
    const nextStatus =
      reachedEnd && book.status !== 'COMPLETED' ? 'COMPLETED' : undefined

    const updated = await prisma.book.update({
      where: { id: book.id },
      data: {
        currentChapter: resolvedChapter,
        currentChapterUrl: chapterUrl || null,
        status: nextStatus,
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
    bookEmitter.emit(`book_updated:${userId}`, {
      ...updated,
      updatedAt: updated.updatedAt.toISOString(),
    })

    return NextResponse.json({ updated: true, book: updated, redirectUrl: null })
  } catch (err: unknown) {
    if (isConnReset(err)) {
      console.warn('Request aborted (ECONNRESET) in /api/extension/update', err instanceof Error ? err.stack || err.message : err)
      return NextResponse.json({ error: 'Request aborted' }, { status: 499 })
    }
    console.error('Error in /api/extension/update', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
