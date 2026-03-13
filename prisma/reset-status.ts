/**
 * One-time script: Reset all READING books to PLAN_TO_READ status.
 * COMPLETED and DROPPED books are not modified.
 *
 * Usage:
 *   npx tsx prisma/reset-status.ts              — reset all READING → PLAN_TO_READ
 *   npx tsx prisma/reset-status.ts --dry-run    — print what would change, no writes
 */
import path from 'path'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const dbPath = path.resolve(process.cwd(), 'dev.db')
const adapter = new PrismaBetterSqlite3({ url: dbPath })
const prisma = new PrismaClient({ adapter } as any)

const dryRun = process.argv.includes('--dry-run')

async function main() {
  try {
    // Find all READING books
    const readingBooks = await prisma.book.findMany({
      where: { status: 'READING' },
      select: { id: true, title: true, status: true },
    })

    if (readingBooks.length === 0) {
      console.log('No READING books found. Nothing to reset.')
      return
    }

    console.log(`Found ${readingBooks.length} READING book(s):`)
    readingBooks.forEach(b => console.log(`  - [${b.id}] ${b.title}`))

    if (dryRun) {
      console.log('\n[DRY RUN] Would reset these books to PLAN_TO_READ. Run without --dry-run to apply.')
      return
    }

    // Reset READING → PLAN_TO_READ
    const result = await prisma.book.updateMany({
      where: { status: 'READING' },
      data: { status: 'PLAN_TO_READ' },
    })

    console.log(`\n✓ Reset ${result.count} book(s) to PLAN_TO_READ status.`)
    console.log('\nNext: Set your 1-2 actively-reading books back to READING via the web UI or database.')
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
