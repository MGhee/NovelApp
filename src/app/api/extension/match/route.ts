import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildBookUrlCandidates } from '@/lib/utils'
import { getUserId } from '@/lib/getUserId'

function isConnReset(err: unknown) {
  if (!(err instanceof Error)) return false
  const errorWithCode = err as Error & { code?: string }
  return errorWithCode.code === 'ECONNRESET' || /aborted/i.test(err.message)
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = req.nextUrl.searchParams.get('url')
    if (!url) return NextResponse.json({ match: null })

    const urlCandidates = buildBookUrlCandidates(url)

    let book = await prisma.book.findFirst({
      where: { userId, siteUrl: { in: urlCandidates } },
      select: {
        id: true,
        title: true,
        coverUrl: true,
        currentChapter: true,
        totalChapters: true,
        status: true,
        isFavorite: true,
      },
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
        select: {
          id: true,
          title: true,
          coverUrl: true,
          currentChapter: true,
          totalChapters: true,
          status: true,
          isFavorite: true,
        },
      })
    }

    return NextResponse.json({ match: book || null })
  } catch (err: unknown) {
    // Log and return a controlled error instead of allowing an uncaught exception
    // ECONNRESET / aborted may originate from client disconnects — return 499-like response
    // Note: NextResponse doesn't support custom 499 status name, so use 499 numeric
    if (isConnReset(err)) {
      console.warn('Request aborted (ECONNRESET) in /api/extension/match', err instanceof Error ? err.stack || err.message : err)
      return NextResponse.json({ error: 'Request aborted' }, { status: 499 })
    }

    console.error('Error in /api/extension/match', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
