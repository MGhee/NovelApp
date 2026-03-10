import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { bookEmitter } from '@/lib/events'
import { extractBookUrl } from '@/lib/utils'

export async function POST(req: NextRequest) {
  const { siteUrl, chapterNumber, chapterUrl } = await req.json()
  if (!siteUrl || typeof chapterNumber !== 'number') {
    return NextResponse.json({ error: 'siteUrl and chapterNumber are required' }, { status: 400 })
  }

  // The extension sends the chapter URL — derive the book base URL from it
  const bookBaseUrl = extractBookUrl(siteUrl) || siteUrl

  const book = await prisma.book.findFirst({
    where: { siteUrl: bookBaseUrl },
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
