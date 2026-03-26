import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { bookEmitter } from '@/lib/events'
import { normalizeUrl } from '@/lib/utils'
import { invalidateCache } from '@/lib/bookListCache'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const book = await prisma.book.findUnique({
    where: { id: parseInt(id) },
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
  const { id } = await params
  const body = await req.json()
  const bookId = parseInt(id)

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
  bookEmitter.emit('book_updated', {
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

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const bookId = parseInt(id)
  await prisma.book.delete({ where: { id: bookId } })
  invalidateCache()
  bookEmitter.emit('book_deleted', { id: bookId })
  return NextResponse.json({ ok: true })
}
