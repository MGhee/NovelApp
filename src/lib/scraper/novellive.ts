import * as cheerio from 'cheerio'
import { fetchWithBrowser } from './browser'
import type { ScrapeResult } from '@/lib/types'

const BASE = 'https://novellive.app'

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
  const coverUrl = rawCover
    ? rawCover.startsWith('http') ? rawCover : `${BASE}${rawCover}`
    : null

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

  // Extract chapters: look for chapter links
  const chapters: ScrapeResult['chapters'] = []
  try {
    $('a[href*="chapter"]').each((_, el) => {
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
    chapters.sort((a, b) => a.number - b.number)
  } catch {
    // Continue without chapters on error
  }

  return { title, author, coverUrl, description, genre, totalChapters: chapters.length, chapters }
}

export async function scrapeNovellive(url: string): Promise<ScrapeResult> {
  const appUrl = url.replace('novellive.com', 'novellive.app')
  const html = await fetchWithBrowser(appUrl, { timeout: 30000 })

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

  return parseNovellive(html, appUrl)
}
