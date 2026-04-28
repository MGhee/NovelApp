import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'

/**
 * GET /api/sync/library
 * Returns all books in the user's library with their current state for syncing.
 * Android app calls this to fetch the full state and merge with local data.
 */
export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const books = await prisma.book.findMany({
      where: {
        userId,
        siteUrl: { not: null }, // Only sync books with a site URL (web-sourced)
        status: 'READING', // Only sync currently-reading books
      },
      select: {
        id: true,
        title: true,
        siteUrl: true,
        status: true,
        type: true,
        currentChapter: true,
        currentChapterUrl: true,
        totalChapters: true,
        coverUrl: true,
        description: true,
        isFavorite: true,
        yearRead: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json({
      books: books.map((b) => ({
        ...b,
        // Normalize status for sync: Android uses completed (bool) + inLibrary (bool)
        // We send the raw status, Android maps: READING/COMPLETED/PLAN_TO_READ/DROPPED all map to inLibrary=true
        status: b.status,
      })),
      serverTime: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Sync GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch library' }, { status: 500 })
  }
}
