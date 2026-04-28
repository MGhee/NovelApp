import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { bookEmitter } from '@/lib/events'
import { scrapeBook } from '@/lib/scraper'
import type { ScrapeResult } from '@/lib/types'
import { getUserId } from '@/lib/getUserId'

const VALID_BOOK_TYPES = new Set(['WEB_NOVEL', 'LIGHT_NOVEL', 'MANGA', 'MANHWA', 'PDF_DOWNLOAD'])
function normalizeBookType(raw: unknown): 'WEB_NOVEL' | 'LIGHT_NOVEL' | 'MANGA' | 'MANHWA' | 'PDF_DOWNLOAD' {
  return typeof raw === 'string' && VALID_BOOK_TYPES.has(raw)
    ? (raw as 'WEB_NOVEL' | 'LIGHT_NOVEL' | 'MANGA' | 'MANHWA' | 'PDF_DOWNLOAD')
    : 'WEB_NOVEL'
}

/**
 * POST /api/sync/push
 * Android app pushes its local state; server merges and returns resolved conflicts.
 * Conflict resolution: max chapter wins (progress never decreases), last-writer-wins for other fields.
 */
export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { books: androidBooks } = await req.json()

    if (!Array.isArray(androidBooks)) {
      return NextResponse.json({ error: 'Invalid request: books must be an array' }, { status: 400 })
    }

    const syncTime = new Date()
    console.log(`[Sync] POST /api/sync/push - Received ${androidBooks.length} books`)

    const result = {
      merged: [] as typeof androidBooks,
      errors: [] as string[],
    }

    for (const androidBook of androidBooks) {
      const { siteUrl, title, status, currentChapter, updatedAt, chapters: rawAndroidChapters, coverUrl, description, type: rawType } = androidBook
      const normalizedType = normalizeBookType(rawType)

      // Normalize chapters: convert number from string to int
      const androidChapters = rawAndroidChapters?.map((ch: any) => ({
        number: typeof ch.number === 'string' ? parseInt(ch.number, 10) : ch.number,
        title: ch.title || '',
        url: ch.url,
      })) || undefined

      console.log(`[Sync] Processing book: title=${title}, siteUrl=${siteUrl}, chapter=${currentChapter}, chapters=${androidChapters?.length || 0}, cover=${coverUrl ? 'yes' : 'no'}`)

      if (!siteUrl) {
        result.errors.push(`Book missing siteUrl: ${title}`)
        continue
      }

      try {
        // Find existing book by userId + siteUrl (compound unique)
        const existing = await prisma.book.findFirst({
          where: { userId, siteUrl },
          select: {
            id: true,
            status: true,
            currentChapter: true,
            title: true,
            updatedAt: true,
          },
        })

        if (existing) {
          // Book exists: merge based on conflict resolution rules
          // Chapters: last-writer-wins by timestamp. Status: server wins (Android only knows COMPLETED/READING).
          // Android sends updatedAt as milliseconds since epoch (string), convert to number
          const androidTime = updatedAt ? parseInt(updatedAt, 10) : 0
          const existingTime = existing.updatedAt.getTime()
          const androidIsNewer = androidTime > existingTime

          // Convert currentChapter to number (Android sends as string)
          const androidChapterNum = typeof currentChapter === 'string' ? parseInt(currentChapter, 10) : currentChapter
          const mergedChapter = androidIsNewer ? androidChapterNum : existing.currentChapter
          // Android can only send "COMPLETED" or "READING" (it lacks ON_HOLD, DROPPED, etc.).
          // Always preserve the server's status unless Android reports a genuine completion.
          const mergedStatus =
            status === 'COMPLETED' && existing.status !== 'COMPLETED'
              ? 'COMPLETED'
              : existing.status

          console.log(`[Sync] ${title}: android=${currentChapter} (time=${androidTime}), existing=${existing.currentChapter} (time=${existingTime}), androidNewer=${androidIsNewer}, merged=${mergedChapter}`)

          // Update with merged data and chapters if provided
          const updated = await prisma.book.update({
            where: { id: existing.id },
            data: {
              currentChapter: mergedChapter,
              status: mergedStatus,
              ...(coverUrl && { coverUrl }),
              ...(description && { description }),
              updatedAt: syncTime,
              ...(androidChapters?.length && {
                chapters: {
                  deleteMany: {},
                  createMany: { data: androidChapters },
                },
              }),
            },
            select: {
              id: true,
              title: true,
              author: true,
              coverUrl: true,
              status: true,
              type: true,
              currentChapter: true,
              currentChapterUrl: true,
              totalChapters: true,
              siteUrl: true,
              genre: true,
              isFavorite: true,
              yearRead: true,
              updatedAt: true,
            },
          })

          console.log(`[Sync] Updated ${title} to chapter ${mergedChapter}${androidChapters?.length ? ` with ${androidChapters.length} chapters` : ''}`)

          // Emit SSE event so connected clients update immediately
          try {
            bookEmitter.emit(`book_updated:${userId}`, { ...updated, updatedAt: updated.updatedAt.toISOString() })
          } catch (err) {
            console.warn('[Sync] Failed to emit book_updated event', err)
          }

          result.merged.push({
            siteUrl,
            title: existing.title,
            status: mergedStatus,
            currentChapter: mergedChapter,
            resolved: true,
          })
        } else {
          // Book doesn't exist on server: create it
          // Map Android status (inLibrary=true means keep it, inLibrary=false means PLAN_TO_READ)
          const chapterNum = typeof currentChapter === 'string' ? parseInt(currentChapter, 10) : currentChapter
          const totalChapterNum = typeof androidBook.totalChapters === 'string' ? parseInt(androidBook.totalChapters, 10) : (androidBook.totalChapters || 0)

          // Prefer chapters from Android; if not available, scrape
          let scrapedData: ScrapeResult | null = null
          if (!androidChapters?.length) {
            try {
              scrapedData = await scrapeBook(siteUrl)
              console.log(`[Sync] Scraped ${title}: got ${scrapedData.chapters?.length || 0} chapters`)
            } catch (scrapeErr) {
              console.warn(`[Sync] Failed to scrape ${title}:`, scrapeErr instanceof Error ? scrapeErr.message : 'Unknown error')
            }
          }

          const created = await prisma.book.create({
            data: {
              userId,
              title,
              siteUrl,
              type: normalizedType,
              status: status || 'READING',
              currentChapter: chapterNum || 0,
              totalChapters: androidChapters?.length ? androidChapters.length : (scrapedData?.totalChapters || totalChapterNum || 0),
              coverUrl: scrapedData?.coverUrl || coverUrl || null,
              description: scrapedData?.description || description || null,
              genre: scrapedData?.genre || null,
              author: scrapedData?.author || null,
              isFavorite: false, // Android doesn't have favorites
              yearRead: null, // Android doesn't track year read
              chapters: androidChapters?.length
                ? { createMany: { data: androidChapters } }
                : (scrapedData?.chapters?.length ? { createMany: { data: scrapedData.chapters } } : undefined),
              updatedAt: syncTime,
            },
            select: {
              id: true,
              title: true,
              author: true,
              coverUrl: true,
              status: true,
              type: true,
              currentChapter: true,
              currentChapterUrl: true,
              totalChapters: true,
              siteUrl: true,
              genre: true,
              isFavorite: true,
              yearRead: true,
              updatedAt: true,
            },
          })

          // Emit SSE event for created book
          try {
            bookEmitter.emit(`book_created:${userId}`, { ...created, updatedAt: created.updatedAt.toISOString() })
          } catch (err) {
            console.warn('[Sync] Failed to emit book_created event for created book', err)
          }

          result.merged.push({
            siteUrl,
            title,
            status: status || 'READING',
            currentChapter: currentChapter || 0,
            resolved: true,
            created: true,
          })
        }
      } catch (error) {
        console.error(`[Sync] Error syncing ${title}:`, error)
        result.errors.push(`Failed to sync book ${siteUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('Sync POST error:', error)
    return NextResponse.json({ error: 'Failed to sync books' }, { status: 500 })
  }
}
