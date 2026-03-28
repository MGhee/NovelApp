import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { bookEmitter } from '@/lib/events'
import { normalizeUrl } from '@/lib/utils'
import { invalidateCache } from '@/lib/bookListCache'
import { getUserId } from '@/lib/getUserId'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const book = await prisma.book.findFirst({
    where: { id: parseInt(id), userId },
    include: {
      characters: true,
      customFields: true,
      chapters: { orderBy: { number: 'asc' } },
    },
  })
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(book)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const bookId = parseInt(id)

  // Verify ownership
  const existingBook = await prisma.book.findFirst({
    where: { id: bookId, userId },
  })
  if (!existingBook) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { customFields, characters, ...fields } = body

  // Normalize siteUrl if provided
  if (fields.siteUrl) fields.siteUrl = normalizeUrl(fields.siteUrl)

  // Bulk-replace customFields if provided
  if (customFields !== undefined) {
    await prisma.customField.deleteMany({ where: { bookId } })
    if (customFields.length > 0) {
      await prisma.customField.createMany({
        data: customFields.map((f: { key: string; value: string }) => ({
          key: f.key,
          value: f.value,
          bookId,
        })),
      })
    }
  }

  const book = await prisma.book.update({
    where: { id: bookId },
    data: fields,
    include: {
      characters: true,
      customFields: true,
      chapters: { orderBy: { number: 'asc' } },
    },
  })

  invalidateCache()
  bookEmitter.emit(`book_updated:${userId}`, {
    id: book.id,
    title: book.title,
    author: book.author,
    coverUrl: book.coverUrl,
    status: book.status,
    type: book.type,
    currentChapter: book.currentChapter,
    currentChapterUrl: book.currentChapterUrl,
    totalChapters: book.totalChapters,
    siteUrl: book.siteUrl,
    genre: book.genre,
    isFavorite: book.isFavorite,
    yearRead: book.yearRead,
    updatedAt: book.updatedAt.toISOString(),
  })

  return NextResponse.json(book)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const bookId = parseInt(id)

  // Verify ownership
  const book = await prisma.book.findFirst({
    where: { id: bookId, userId },
  })
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.book.delete({ where: { id: bookId } })
  invalidateCache()
  bookEmitter.emit(`book_deleted:${userId}`, { id: bookId })
  return NextResponse.json({ ok: true })
}
