import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeUrl } from '@/lib/utils'
import { getCache, invalidateCache } from '@/lib/bookListCache'
import { bookEmitter } from '@/lib/events'
import { getUserId } from '@/lib/getUserId'

const CACHE_TTL = 5000 // ms

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const favorites = searchParams.get('favorites') === 'true'
  const limit = Math.min(200, parseInt(searchParams.get('limit') || '50', 10) || 50)
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0)

  // Build where clause - allow books owned by user or with no owner (legacy books)
  const where: any = {}

  // Match books by userId (owned by user or legacy with null userId)
  where.OR = [
    { userId: userId },
    { userId: null }
  ]

  if (status) where.status = status
  if (favorites) where.isFavorite = true
  if (search) where.title = { contains: search }

  const cacheKey = JSON.stringify({ userId, where, limit, offset })
  const now = Date.now()
  const cache = getCache()
  const existing = cache.get(cacheKey)
  if (existing && existing.expires > now) {
    const res = NextResponse.json(existing.books)
    res.headers.set('X-Total-Count', String(existing.total))
    res.headers.set('X-Cache', 'HIT')
    return res
  }

  const start = Date.now()

  const total = await prisma.book.count({ where })

  const books = await prisma.book.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: limit,
    skip: offset,
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

  const duration = Date.now() - start
  cache.set(cacheKey, { expires: now + CACHE_TTL, books, total })

  const res = NextResponse.json(books)
  res.headers.set('X-Total-Count', String(total))
  res.headers.set('X-Limit', String(limit))
  res.headers.set('X-Offset', String(offset))
  res.headers.set('X-Query-Duration-ms', String(duration))
  res.headers.set('X-Cache', 'MISS')
  return res
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { title, author, coverUrl, description, genre, status, type, siteUrl,
    currentChapter, totalChapters, isFavorite, yearRead, chapters, characters, customFields } = body

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const book = await prisma.book.create({
    data: {
      userId,
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

  invalidateCache()
  bookEmitter.emit(`book_created:${userId}`, {
    id: book.id,
    title: book.title,
    author: book.author,
    coverUrl: book.coverUrl,
    status: book.status,
    type: book.type,
    currentChapter: book.currentChapter,
    totalChapters: book.totalChapters,
    siteUrl: book.siteUrl,
    genre: book.genre,
    isFavorite: book.isFavorite,
    yearRead: book.yearRead,
    updatedAt: book.updatedAt.toISOString(),
  })

  return NextResponse.json(book, { status: 201 })
}
