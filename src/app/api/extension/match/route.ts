import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractBookUrl } from '@/lib/utils'

function isConnReset(err: any) {
  return err && (err.code === 'ECONNRESET' || /aborted/i.test(String(err.message || '')))
}

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get('url')
    if (!url) return NextResponse.json({ match: null })

    const bookBaseUrl = extractBookUrl(url) || url

    const book = await prisma.book.findFirst({
      where: { siteUrl: bookBaseUrl },
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

    return NextResponse.json({ match: book || null })
  } catch (err: any) {
    // Log and return a controlled error instead of allowing an uncaught exception
    // ECONNRESET / aborted may originate from client disconnects — return 499-like response
    // Note: NextResponse doesn't support custom 499 status name, so use 499 numeric
    if (isConnReset(err)) {
      console.warn('Request aborted (ECONNRESET) in /api/extension/match', err?.stack || err)
      return NextResponse.json({ error: 'Request aborted' }, { status: 499 })
    }

    console.error('Error in /api/extension/match', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
