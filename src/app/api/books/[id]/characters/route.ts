import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { name, description, role } = await req.json()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const character = await prisma.character.create({
    data: { name, description: description || null, role: role || null, bookId: parseInt(id) },
  })
  return NextResponse.json(character, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { characterId } = await req.json()
  await prisma.character.delete({ where: { id: characterId, bookId: parseInt(id) } })
  return NextResponse.json({ ok: true })
}
