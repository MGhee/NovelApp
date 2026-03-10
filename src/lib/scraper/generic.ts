import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapeResult } from '@/lib/types'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export async function scrapeGeneric(url: string): Promise<ScrapeResult> {
  const { data: html } = await axios.get(url, {
    headers: { 'User-Agent': UA },
    timeout: 15000,
  })
  const $ = cheerio.load(html)

  const title =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('h1').first().text().trim() ||
    $('title').text().split('|')[0].trim() ||
    'Unknown Title'

  const coverUrl =
    $('meta[property="og:image"]').attr('content') ||
    $('.book-cover img, .novel-cover img, .thumb img, .cover img').first().attr('src') ||
    null

  const description =
    $('meta[property="og:description"]').attr('content')?.trim() ||
    $('.description, .summary, .synopsis, .intro').first().text().trim() ||
    null

  const author =
    $('[itemprop="author"]').first().text().trim() ||
    $('.author a, .author-name').first().text().trim() ||
    null

  const genre =
    $('.categories a, .genre a, .tag-item a')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean)
      .slice(0, 6)
      .join(', ') || null

  // Collect chapter links by URL pattern
  const chaptersMap = new Map<number, { number: number; title: string | null; url: string }>()
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const numMatch = href.match(/chapter[_-](\d+)/i)
    if (numMatch) {
      const num = parseInt(numMatch[1], 10)
      if (!chaptersMap.has(num)) {
        const chUrl = href.startsWith('http') ? href : new URL(href, url).toString()
        chaptersMap.set(num, { number: num, title: $(el).text().trim() || null, url: chUrl })
      }
    }
  })

  const chapters = Array.from(chaptersMap.values()).sort((a, b) => a.number - b.number)

  // Resolve relative cover URL
  const resolvedCover = coverUrl && !coverUrl.startsWith('http')
    ? new URL(coverUrl, url).toString()
    : coverUrl

  return {
    title,
    author,
    coverUrl: resolvedCover,
    description,
    genre,
    totalChapters: chapters.length,
    chapters,
  }
}
