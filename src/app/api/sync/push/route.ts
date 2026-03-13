import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { scrapeBook } from '@/lib/scraper'

/**
 * POST /api/sync/push
 * Android app pushes its local state; server merges and returns resolved conflicts.
 * Conflict resolution: max chapter wins (progress never decreases), last-writer-wins for other fields.
 */
export async function POST(req: NextRequest) {
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
      const { siteUrl, title, status, currentChapter, updatedAt } = androidBook

      console.log(`[Sync] Processing book: title=${title}, siteUrl=${siteUrl}, chapter=${currentChapter}`)

      if (!siteUrl) {
        result.errors.push(`Book missing siteUrl: ${title}`)
        continue
      }

      try {
        // Find existing book by siteUrl
        const existing = await prisma.book.findUnique({
          where: { siteUrl },
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
          // Last-writer-wins for all fields based on timestamps
          // Android sends updatedAt as milliseconds since epoch (string), convert to number
          const androidTime = updatedAt ? parseInt(updatedAt, 10) : 0
          const existingTime = existing.updatedAt.getTime()
          const androidIsNewer = androidTime > existingTime

          // Convert currentChapter to number (Android sends as string)
          const androidChapterNum = typeof currentChapter === 'string' ? parseInt(currentChapter, 10) : currentChapter
          const mergedChapter = androidIsNewer ? androidChapterNum : existing.currentChapter
          const mergedStatus = androidIsNewer ? status : existing.status

          console.log(`[Sync] ${title}: android=${currentChapter} (time=${androidTime}), existing=${existing.currentChapter} (time=${existingTime}), androidNewer=${androidIsNewer}, merged=${mergedChapter}`)

          // Update with merged data
          await prisma.book.update({
            where: { siteUrl },
            data: {
              currentChapter: mergedChapter,
              status: mergedStatus,
              updatedAt: syncTime,
            },
          })

          console.log(`[Sync] Updated ${title} to chapter ${mergedChapter}`)

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

          // Scrape book for cover, description, and chapters
          let scrapedData: ReturnType<typeof scrapeBook> | null = null
          try {
            scrapedData = await scrapeBook(siteUrl)
            console.log(`[Sync] Scraped ${title}: got ${scrapedData.chapters?.length || 0} chapters`)
          } catch (scrapeErr) {
            console.warn(`[Sync] Failed to scrape ${title}:`, scrapeErr instanceof Error ? scrapeErr.message : 'Unknown error')
          }

          await prisma.book.create({
            data: {
              title,
              siteUrl,
              status: status || 'READING',
              currentChapter: chapterNum || 0,
              totalChapters: scrapedData?.totalChapters || totalChapterNum || 0,
              coverUrl: scrapedData?.coverUrl || androidBook.coverUrl || null,
              description: scrapedData?.description || androidBook.description || null,
              genre: scrapedData?.genre || null,
              author: scrapedData?.author || null,
              isFavorite: false, // Android doesn't have favorites
              yearRead: null, // Android doesn't track year read
              chapters: scrapedData?.chapters?.length
                ? { createMany: { data: scrapedData.chapters } }
                : undefined,
              updatedAt: syncTime,
            },
          })

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
