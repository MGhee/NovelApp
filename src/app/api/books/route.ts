import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeUrl } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const favorites = searchParams.get('favorites') === 'true'

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (favorites) where.isFavorite = true
  if (search) {
    where.title = { contains: search }
  }

  const books = await prisma.book.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      author: true,
      coverUrl: true,
      status: true,
      type: true,
      currentChapter: true,
      totalChapters: true,
      siteUrl: true,
      genre: true,
      isFavorite: true,
      yearRead: true,
      updatedAt: true,
    },
  })

  return NextResponse.json(books)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, author, coverUrl, description, genre, status, type, siteUrl,
    currentChapter, totalChapters, isFavorite, yearRead, chapters, characters, customFields } = body

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const book = await prisma.book.create({
    data: {
      title,
      author: author || null,
      coverUrl: coverUrl || null,
      description: description || null,
      genre: genre || null,
      status: status || 'PLAN_TO_READ',
      type: type || 'WEB_NOVEL',
      siteUrl: siteUrl ? normalizeUrl(siteUrl) : null,
      currentChapter: currentChapter || 0,
      totalChapters: totalChapters || 0,
      isFavorite: isFavorite || false,
      yearRead: yearRead || null,
      chapters: chapters?.length
        ? { createMany: { data: chapters } }
        : undefined,
      characters: characters?.length
        ? { createMany: { data: characters } }
        : undefined,
      customFields: customFields?.length
        ? { createMany: { data: customFields } }
        : undefined,
    },
    include: { characters: true, customFields: true, chapters: { orderBy: { number: 'asc' } } },
  })

  return NextResponse.json(book, { status: 201 })
}
