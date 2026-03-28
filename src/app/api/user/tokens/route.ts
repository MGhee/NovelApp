import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'
import crypto from 'crypto'

/**
 * GET /api/user/tokens
 * List all API tokens for the authenticated user.
 */
export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tokens = await prisma.apiToken.findMany({
    where: { userId },
    select: {
      id: true,
      label: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ tokens })
}

/**
 * POST /api/user/tokens
 * Generate a new API token for the authenticated user.
 */
export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { label } = body

  // Generate a random 64-character hex token
  const token = crypto.randomBytes(32).toString('hex')

  const apiToken = await prisma.apiToken.create({
    data: {
      token,
      label: label || 'Default',
      userId,
    },
  })

  return NextResponse.json({
    id: apiToken.id,
    token: apiToken.token,
    label: apiToken.label,
    createdAt: apiToken.createdAt,
  }, { status: 201 })
}

/**
 * DELETE /api/user/tokens/[id]
 * Revoke an API token.
 */
export async function DELETE(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  // Verify ownership
  const token = await prisma.apiToken.findFirst({
    where: { id: parseInt(id), userId },
  })
  if (!token) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.apiToken.delete({ where: { id: parseInt(id) } })

  return NextResponse.json({ ok: true })
}
