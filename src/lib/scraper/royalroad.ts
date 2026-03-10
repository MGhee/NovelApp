import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapeResult } from '@/lib/types'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const BASE = 'https://www.royalroad.com'

export async function scrapeRoyalRoad(url: string): Promise<ScrapeResult> {
  const { data: html } = await axios.get(url, {
    headers: { 'User-Agent': UA, Referer: BASE },
    timeout: 15000,
  })
  const $ = cheerio.load(html)

  const title =
    $('h1.font-white').first().text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('h1').first().text().trim() ||
    'Unknown'

  const author =
    $('span[property="name"]').first().text().trim() ||
    $('a[href*="/profile/"]').first().text().trim() ||
    null

  const rawCover =
    $('img.thumbnail, .cover-art-container img, img[src*="cover"]').attr('src') ||
    $('meta[property="og:image"]').attr('content') ||
    null
  const coverUrl = rawCover
    ? rawCover.startsWith('http') ? rawCover : `${BASE}${rawCover}`
    : null

  const description =
    $('div.description .hidden-content, div[property="description"]')
      .first().text().trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    null

  const genre =
    $('a.fiction-tag, .tags a')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean)
      .slice(0, 6)
      .join(', ') || null

  // Chapters are in a table with data-url attributes
  const chapters: ScrapeResult['chapters'] = []
  $('tr.chapter-row').each((_, row) => {
    const a = $(row).find('td a').first()
    const href = a.attr('href') || ''
    const chTitle = a.text().trim()
    const numMatch = href.match(/chapter\/(\d+)/) || chTitle.match(/chapter\s*(\d+)/i)
    if (href) {
      chapters.push({
        number: numMatch ? parseInt(numMatch[1], 10) : chapters.length + 1,
        title: chTitle || null,
        url: href.startsWith('http') ? href : `${BASE}${href}`,
      })
    }
  })
  // RoyalRoad lists chapters oldest-first, so order is usually already correct
  chapters.sort((a, b) => a.number - b.number)

  return { title, author, coverUrl, description, genre, totalChapters: chapters.length, chapters }
}
