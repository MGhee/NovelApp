import * as cheerio from 'cheerio'
import { fetchWithBrowser } from './browser'
import type { ScrapeResult } from '@/lib/types'

const BASE = 'https://novellive.app'
const MEDIA_BASE = 'https://media.novellive.com' // Use .com CDN which is accessible

export function parseNovellive(html: string, url: string): ScrapeResult {
  const $ = cheerio.load(html)

  const title =
    $('h1').first().text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    'Unknown'

  const author =
    $('[class*="author"] a').first().text().trim() ||
    $('[itemprop="author"]').first().text().trim() ||
    null

  const rawCover =
    $('img[class*="cover"]').attr('src') ||
    $('meta[property="og:image"]').attr('content') ||
    null
  let coverUrl: string | null = null
  if (rawCover) {
    if (rawCover.startsWith('http')) {
      // Replace .app domain with working .com CDN domain
      coverUrl = rawCover.replace('media.novellive.app', 'media.novellive.com')
    } else {
      coverUrl = `${BASE}${rawCover}`
    }
  }

  const description =
    $('meta[property="og:description"]').attr('content')?.trim() ||
    null

  const genre =
    $('a[href*="/genres/"]')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean)
      .slice(0, 6)
      .join(', ') || null

  // Extract all chapter links from the page (both recent and older chapters)
  const chapters: ScrapeResult['chapters'] = []
  try {
    $('a[href*="chapter"]').each((_, el) => {
      const href = $(el).attr('href') || ''
      const text = $(el).text().trim()

      // Match chapter number from href (more reliable than text)
      const hrefMatch = href.match(/chapter[_-](\d+)/i)
      if (hrefMatch && href.includes('/book/')) {
        const chapterNum = parseInt(hrefMatch[1], 10)
        // Avoid duplicates
        if (!chapters.some(ch => ch.number === chapterNum)) {
          chapters.push({
            number: chapterNum,
            title: text || null,
            url: href.startsWith('http') ? href : `${BASE}${href}`,
          })
        }
      }
    })

    // Sort by chapter number ascending
    chapters.sort((a, b) => a.number - b.number)
  } catch {
    // Chapter list extraction failed — continue without it
  }

  return { title, author, coverUrl, description, genre, totalChapters: chapters.length, chapters }
}

/**
 * Extract only the paginated chapter list from a novellive page.
 * The page has two ul.ul-list5 lists:
 *  - First: "latest chapters" sidebar (same on every page)
 *  - Second: the actual paginated chapter list (different per page, ~40 chapters)
 * We want only the second list.
 */
function extractPaginatedChapters(html: string): ScrapeResult['chapters'] {
  const $ = cheerio.load(html)
  const chapters: ScrapeResult['chapters'] = []

  // Get all ul.ul-list5 elements — the second one is the paginated list
  const lists = $('ul.ul-list5')
  const paginatedList = lists.length >= 2 ? lists.eq(1) : lists.eq(0)

  paginatedList.find('a[href*="chapter"]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const text = $(el).text().trim()
    const hrefMatch = href.match(/chapter[_-](\d+)/i)
    if (hrefMatch && href.includes('/book/')) {
      const chapterNum = parseInt(hrefMatch[1], 10)
      if (!chapters.some(ch => ch.number === chapterNum)) {
        chapters.push({
          number: chapterNum,
          title: text || null,
          url: href.startsWith('http') ? href : `${BASE}${href}`,
        })
      }
    }
  })

  return chapters
}

export async function scrapeNovellive(url: string): Promise<ScrapeResult> {
  // novellive.app uses Puppeteer to bypass Cloudflare
  const appUrl = url.replace('novellive.com', 'novellive.app')
  const html = await fetchWithBrowser(appUrl, {
    timeout: 30000,
    waitSelector: 'ul.ul-list5', // Wait for chapter lists to render
  })

  // Check if Cloudflare challenge was resolved
  if (html.includes('Just a moment')) {
    return {
      title: 'Unknown',
      author: null,
      coverUrl: null,
      description: null,
      genre: null,
      totalChapters: 0,
      chapters: [],
    }
  }

  // Get metadata from page 1
  const result = parseNovellive(html, appUrl)

  // Replace chapters with only paginated ones from page 1
  const page1Chapters = extractPaginatedChapters(html)
  const allChapters = new Map<number, ScrapeResult['chapters'][0]>()
  for (const ch of page1Chapters) allChapters.set(ch.number, ch)

  // Detect max page number from pagination links
  const $ = cheerio.load(html)
  const pageNumbers = new Set<number>()
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const match = href.match(/\/book\/[^/]+\/(\d+)$/)
    if (match) pageNumbers.add(parseInt(match[1], 10))
  })
  const maxPage = pageNumbers.size > 0 ? Math.max(...pageNumbers) : 1

  // Iterate through all pages sequentially (like hangukhub)
  const baseUrl = appUrl.replace(/\/+$/, '')
  let consecutiveEmpty = 0

  for (let pageNum = 2; pageNum <= maxPage; pageNum++) {
    try {
      const pageHtml = await fetchWithBrowser(`${baseUrl}/${pageNum}`, {
        timeout: 30000,
        waitSelector: 'ul.ul-list5',
      })
      const pageChapters = extractPaginatedChapters(pageHtml)

      let newCount = 0
      for (const ch of pageChapters) {
        if (!allChapters.has(ch.number)) {
          allChapters.set(ch.number, ch)
          newCount++
        }
      }

      if (newCount === 0) {
        consecutiveEmpty++
        if (consecutiveEmpty >= 2) break
      } else {
        consecutiveEmpty = 0
      }

      await new Promise(r => setTimeout(r, 500)) // Rate limit
    } catch {
      break
    }
  }

  // Build final result
  result.chapters = [...allChapters.values()].sort((a, b) => a.number - b.number)
  result.totalChapters = result.chapters.length

  return result
}
