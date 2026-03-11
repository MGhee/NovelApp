/**
 * Bulk metadata + chapter refresh script.
 * Iterates all books with a siteUrl, scrapes each, and updates:
 *   - metadata: cover, author, description, genre, totalChapters
 *   - chapters:  deletes existing Chapter rows, inserts freshly scraped list
 *
 * If scraping fails or returns 0 chapters, automatically tries fallback sites
 * (novelpub.com, wuxiaworld.com) and updates siteUrl if a fallback succeeds.
 *
 * Usage:
 *   npx tsx prisma/refresh.ts              — refresh all books
 *   npx tsx prisma/refresh.ts --dry-run    — print what would change, no writes
 *   npx tsx prisma/refresh.ts --id=42      — refresh one book by ID
 */
import path from 'path'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { scrapeBook } from '../src/lib/scraper'
import { closeBrowser } from '../src/lib/scraper/browser'
import type { ScrapeResult } from '../src/lib/types'

const dbPath = path.resolve(process.cwd(), 'dev.db')
const adapter = new PrismaBetterSqlite3({ url: dbPath })
const prisma = new PrismaClient({ adapter } as any)

const dryRun = process.argv.includes('--dry-run')
const idArg  = process.argv.find(a => a.startsWith('--id='))
const targetId = idArg ? parseInt(idArg.split('=')[1], 10) : null

/** Convert a book title to a URL slug */
function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, '')          // strip apostrophes
    .replace(/[^a-z0-9\s-]/g, '') // strip special chars
    .trim()
    .replace(/\s+/g, '-')
}

const FALLBACK_TEMPLATES = [
  (slug: string) => `https://readnovelfull.com/${slug}.html`,
  (slug: string) => `https://www.wuxiaworld.com/novel/${slug}`,
]

/** Try to scrape a URL; return null on error */
async function tryScrape(url: string): Promise<ScrapeResult | null> {
  try {
    return await scrapeBook(url)
  } catch {
    return null
  }
}

async function main() {
  const where = targetId
    ? { id: targetId, siteUrl: { not: null } }
    : { siteUrl: { not: null } }

  const books = await prisma.book.findMany({
    where,
    select: { id: true, title: true, siteUrl: true, coverUrl: true },
    orderBy: { id: 'asc' },
  })

  console.log(`Found ${books.length} book(s) with siteUrl${dryRun ? ' (dry-run)' : ''}\n`)

  let updated = 0
  let failed  = 0

  for (const book of books) {
    process.stdout.write(`[${book.id}] ${book.title} … `)

    // ── 1. Try primary siteUrl ───────────────────────────────────────────────
    let scraped = await tryScrape(book.siteUrl!)
    let usedUrl = book.siteUrl!

    // ── 2. Fallback if primary failed or returned no chapters ────────────────
    if (!scraped || scraped.chapters.length === 0) {
      const reason = !scraped ? 'scrape error' : '0 chapters'
      const slug = toSlug(book.title)

      let fallbackFound = false
      for (const template of FALLBACK_TEMPLATES) {
        const fallbackUrl = template(slug)
        if (fallbackUrl === book.siteUrl) continue // already tried
        process.stdout.write(`\n    → ${reason}, trying ${new URL(fallbackUrl).hostname} … `)
        const fb = await tryScrape(fallbackUrl)
        if (fb && fb.chapters.length > 0) {
          scraped  = fb
          usedUrl  = fallbackUrl
          fallbackFound = true
          process.stdout.write(`OK (${fb.chapters.length} chapters)\n    `)
          break
        }
      }

      if (!fallbackFound) {
        console.log(`FAILED — ${reason}, no fallback worked`)
        failed++
        continue
      }
    }

    if (!scraped) continue // TypeScript narrowing guard (unreachable at runtime)

    // ── 3. Build metadata patch ──────────────────────────────────────────────
    const patch: Record<string, string | number> = {}
    if (usedUrl !== book.siteUrl)                                   patch.siteUrl      = usedUrl
    if (scraped.coverUrl && scraped.coverUrl !== book.coverUrl)     patch.coverUrl     = scraped.coverUrl
    if (scraped.author)                                             patch.author       = scraped.author
    if (scraped.description)                                        patch.description  = scraped.description
    if (scraped.genre)                                              patch.genre        = scraped.genre
    if (scraped.totalChapters > 0)                                  patch.totalChapters = scraped.totalChapters

    const chapterCount = scraped.chapters.length
    const metaKeys     = Object.keys(patch).filter(k => k !== 'siteUrl')
    const parts: string[] = []
    if (patch.siteUrl)    parts.push(`siteUrl → ${new URL(usedUrl).hostname}`)
    if (metaKeys.length)  parts.push(metaKeys.join(', '))
    if (chapterCount > 0) parts.push(`${chapterCount} chapters`)

    if (parts.length === 0) {
      console.log('no changes')
      continue
    }

    if (dryRun) {
      console.log(`would update: ${parts.join(' | ')}`)
      continue
    }

    // ── 4. Write to DB ───────────────────────────────────────────────────────
    try {
      if (Object.keys(patch).length > 0) {
        await prisma.book.update({ where: { id: book.id }, data: patch })
      }

      if (chapterCount > 0) {
        await prisma.chapter.deleteMany({ where: { bookId: book.id } })
        await prisma.chapter.createMany({
          data: scraped.chapters.map(c => ({
            number:  c.number,
            title:   c.title ?? null,
            url:     c.url,
            bookId:  book.id,
          })),
        })
      }

      console.log(`updated: ${parts.join(' | ')}`)
      updated++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`DB ERROR — ${msg}`)
      failed++
    }
  }

  console.log(`\nDone. ${updated} updated, ${failed} failed.`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => {
    await closeBrowser()
    await prisma.$disconnect()
  })
