import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getUserId'

/**
 * POST /api/migration/claim
 * One-time endpoint: claim all unclaimed books (userId IS NULL) for the authenticated user.
 * This is used during the migration from single-user to multi-user.
 */
export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check if migration is enabled
  const migrationEnabled = process.env.MIGRATION_ENABLED === 'true'
  if (!migrationEnabled) {
    return NextResponse.json(
      { error: 'Migration is not enabled' },
      { status: 403 }
    )
  }

  try {
    // Update all books with null userId to be owned by this user
    const result = await prisma.book.updateMany({
      where: { userId: null },
      data: { userId },
    })

    return NextResponse.json({
      ok: true,
      claimed: result.count,
    })
  } catch (error) {
    console.error('Error claiming books:', error)
    return NextResponse.json(
      { error: 'Failed to claim books' },
      { status: 500 }
    )
  }
}
