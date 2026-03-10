import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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
    select: { id: true, title: true, currentChapter: true, totalChapters: true, status: true },
  })

  if (!book) {
    return NextResponse.json({ updated: false, book: null })
  }

  // Only update if progress moved forward
  if (chapterNumber <= book.currentChapter) {
    return NextResponse.json({ updated: false, book })
  }

  const updated = await prisma.book.update({
    where: { id: book.id },
    data: {
      currentChapter: chapterNumber,
      currentChapterUrl: chapterUrl || null,
      // Auto-promote to READING if was Plan To Read
      status: book.status === 'PLAN_TO_READ' ? 'READING' : undefined,
    },
    select: { id: true, title: true, currentChapter: true, totalChapters: true, status: true },
  })

  return NextResponse.json({ updated: true, book: updated })
}
