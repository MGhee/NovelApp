import * as cheerio from 'cheerio'
import { fetchWithBrowser } from './browser'
import type { ScrapeResult } from '@/lib/types'

const BASE = 'https://www.empirenovel.com'

export function parseEmpireNovel(html: string, url: string): ScrapeResult {
  const $ = cheerio.load(html)

  const title =
    $('h1.novel-title, h1.title').first().text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('h1').first().text().trim() ||
    'Unknown'

  const author =
    $('.author a, .novel-author a, [itemprop="author"]').first().text().trim() ||
    null

  const rawCover =
    $('.novel-cover img, .book-cover img, .cover img').attr('src') ||
    $('meta[property="og:image"]').attr('content') ||
    null
  const coverUrl = rawCover
    ? rawCover.startsWith('http') ? rawCover : `${BASE}${rawCover}`
    : null

  const description =
    $('.novel-description p, .summary__content p, .description p')
      .map((_, el) => $(el).text().trim()).get().join('\n').trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    null

  const genre =
    $('.novel-genre a, .genres a, .tags a')
      .map((_, el) => $(el).text().trim())
      .get().filter(Boolean).slice(0, 6).join(', ') || null

  // Chapters: empirenovel uses numeric slugs — /novel/{slug}/{chapterNumber}
  const chapters: ScrapeResult['chapters'] = []
  const slug = new URL(url).pathname.replace(/^\/novel\//, '').replace(/\/$/, '')

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    // Match /novel/{slug}/{digits} pattern
    const match = href.match(new RegExp(`/novel/${slug}/(\\d+)/?$`))
    if (match) {
      const num = parseInt(match[1], 10)
      if (!chapters.find(c => c.number === num)) {
        chapters.push({
          number: num,
          title: $(el).text().trim() || `Chapter ${num}`,
          url: href.startsWith('http') ? href : `${BASE}${href}`,
        })
      }
    }
  })

  chapters.sort((a, b) => a.number - b.number)

  return { title, author, coverUrl, description, genre, totalChapters: chapters.length, chapters }
}

export async function scrapeEmpireNovel(url: string): Promise<ScrapeResult> {
  const html = await fetchWithBrowser(url, {
    timeout: 30000,
  })

  return parseEmpireNovel(html, url)
}
