import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractBookUrl } from '@/lib/utils'

export async function GET(req: NextRequest) {
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
}
