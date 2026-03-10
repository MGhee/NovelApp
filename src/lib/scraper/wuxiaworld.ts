import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapeResult } from '@/lib/types'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const BASE = 'https://www.wuxiaworld.com'

export async function scrapeWuxiaworld(url: string): Promise<ScrapeResult> {
  const { data: html } = await axios.get(url, {
    headers: { 'User-Agent': UA, Referer: BASE },
    timeout: 15000,
  })
  const $ = cheerio.load(html)

  // Try JSON-LD first for structured data
  let jsonTitle: string | null = null
  let jsonAuthor: string | null = null
  let jsonDescription: string | null = null
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '{}')
      if (data['@type'] === 'Book' || data['@type'] === 'WebPage') {
        jsonTitle = data.name || data.headline || null
        jsonAuthor = data.author?.name || null
        jsonDescription = data.description || null
      }
    } catch { /* ignore */ }
  })

  const title =
    jsonTitle ||
    $('h1.novel-name, h1.font-bold').first().text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('h1').first().text().trim() ||
    'Unknown'

  const author =
    jsonAuthor ||
    $('a[href*="/author/"], .author-name a').first().text().trim() ||
    $('[itemprop="author"]').first().text().trim() ||
    null

  const rawCover =
    $('img.novel-image, img.cover-img').attr('src') ||
    $('meta[property="og:image"]').attr('content') ||
    null
  const coverUrl = rawCover
    ? rawCover.startsWith('http') ? rawCover : `${BASE}${rawCover}`
    : null

  const description =
    jsonDescription ||
    $('.synopsis p, .description p, [class*="synopsis"] p')
      .map((_, el) => $(el).text().trim())
      .get()
      .join('\n')
      .trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    null

  const genre =
    $('.genre-tag, .tag-item, a[href*="/genre/"]')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean)
      .slice(0, 6)
      .join(', ') || null

  // Chapters listed in chapter list sections
  const chapters: ScrapeResult['chapters'] = []
  $('li.chapter-item a, .chapter-list a, ul[class*="chapter"] li a').each((_, el) => {
    const href = $(el).attr('href') || ''
    const chTitle = $(el).text().trim()
    const numMatch = href.match(/chapter[_-](\d+)/i) || chTitle.match(/chapter\s*(\d+)/i)
    if (href) {
      chapters.push({
        number: numMatch ? parseInt(numMatch[1], 10) : chapters.length + 1,
        title: chTitle || null,
        url: href.startsWith('http') ? href : `${BASE}${href}`,
      })
    }
  })
  chapters.sort((a, b) => a.number - b.number)

  return { title, author, coverUrl, description, genre, totalChapters: chapters.length, chapters }
}
