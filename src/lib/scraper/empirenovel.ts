import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapeResult } from '@/lib/types'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const BASE = 'https://www.empirenovel.com'

const HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
}

export async function scrapeEmpireNovel(url: string): Promise<ScrapeResult> {
  const { data: html } = await axios.get(url, {
    headers: HEADERS,
    timeout: 20000,
  })
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

  // Also try a dedicated chapter list page if available
  if (chapters.length === 0) {
    try {
      const listUrl = `${BASE}/novel/${slug}/`
      if (listUrl !== url && listUrl !== `${url}/`) {
        const { data: listHtml } = await axios.get(listUrl, {
          headers: { ...HEADERS, Referer: url },
          timeout: 15000,
        })
        const $l = cheerio.load(listHtml)
        $l('a[href]').each((_, el) => {
          const href = $l(el).attr('href') || ''
          const match = href.match(new RegExp(`/novel/${slug}/(\\d+)/?$`))
          if (match) {
            const num = parseInt(match[1], 10)
            if (!chapters.find(c => c.number === num)) {
              chapters.push({
                number: num,
                title: $l(el).text().trim() || `Chapter ${num}`,
                url: href.startsWith('http') ? href : `${BASE}${href}`,
              })
            }
          }
        })
      }
    } catch { /* ignore */ }
  }

  chapters.sort((a, b) => a.number - b.number)

  return { title, author, coverUrl, description, genre, totalChapters: chapters.length, chapters }
}
