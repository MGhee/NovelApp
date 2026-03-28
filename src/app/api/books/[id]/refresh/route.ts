import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { scrapeBook } from '@/lib/scraper'
import { getUserId } from '@/lib/getUserId'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const book = await prisma.book.findFirst({
    where: { id: parseInt(id), userId },
    select: { id: true, siteUrl: true },
  })
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!book.siteUrl) return NextResponse.json({ error: 'No siteUrl to refresh from' }, { status: 400 })

  try {
    const scraped = await scrapeBook(book.siteUrl)

    // Update metadata
    await prisma.book.update({
      where: { id: book.id },
      data: {
        ...(scraped.coverUrl ? { coverUrl: scraped.coverUrl } : {}),
        ...(scraped.author ? { author: scraped.author } : {}),
        ...(scraped.description ? { description: scraped.description } : {}),
        ...(scraped.genre ? { genre: scraped.genre } : {}),
        ...(scraped.totalChapters > 0 ? { totalChapters: scraped.totalChapters } : {}),
      },
    })

    // Sync chapter list (delete old, insert new)
    if (scraped.chapters.length > 0) {
      await prisma.chapter.deleteMany({ where: { bookId: book.id } })
      await prisma.chapter.createMany({
        data: scraped.chapters.map(c => ({
          number: c.number,
          title: c.title ?? null,
          url: c.url,
          bookId: book.id,
        })),
      })
    }

    // Return fully updated book
    const updated = await prisma.book.findUnique({
      where: { id: book.id },
      include: {
        characters: true,
        customFields: true,
        chapters: { orderBy: { number: 'asc' } },
      },
    })
    return NextResponse.json(updated)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Scrape failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
