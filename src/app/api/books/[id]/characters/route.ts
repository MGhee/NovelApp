import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const bookId = parseInt(id)
  const { name, description, role } = await req.json()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  // Verify book ownership
  const book = await prisma.book.findFirst({
    where: { id: bookId, userId },
  })
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const character = await prisma.character.create({
    data: { name, description: description || null, role: role || null, bookId },
  })
  return NextResponse.json(character, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const bookId = parseInt(id)
  const { characterId } = await req.json()

  // Verify book ownership
  const book = await prisma.book.findFirst({
    where: { id: bookId, userId },
  })
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.character.delete({ where: { id: characterId, bookId } })
  return NextResponse.json({ ok: true })
}
