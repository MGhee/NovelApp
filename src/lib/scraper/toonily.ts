import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapeResult } from '@/lib/types'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const BASE = 'https://toonily.com'

export async function scrapeToonily(url: string): Promise<ScrapeResult> {
  // Ensure we're on the series page, not a chapter page
  const seriesUrl = url.replace(/\/chapter-[\w-]+\/?$/, '/')

  const { data: html } = await axios.get(seriesUrl, {
    headers: { 'User-Agent': UA, Referer: BASE },
    timeout: 15000,
  })
  const $ = cheerio.load(html)

  const title =
    $('h1.entry-title').text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('h1').first().text().trim() ||
    'Unknown'

  const author =
    $('.author-content a').first().text().trim() ||
    $('[itemprop="author"]').first().text().trim() ||
    null

  const rawCover =
    $('div.summary_image img, .thumb img').attr('src') ||
    $('meta[property="og:image"]').attr('content') ||
    null
  const coverUrl = rawCover
    ? rawCover.startsWith('http') ? rawCover : `${BASE}${rawCover}`
    : null

  const description =
    $('div.summary__content p, .description-summary p')
      .map((_, el) => $(el).text().trim())
      .get()
      .join('\n')
      .trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    null

  const genre =
    $('.genres-content a, .wp-manga-tags-list a')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean)
      .slice(0, 6)
      .join(', ') || null

  // Chapter list
  const chapters: ScrapeResult['chapters'] = []
  $('ul.main.version-chap li.wp-manga-chapter a, .listing-chapters_wrap li a').each((_, el) => {
    const href = $(el).attr('href') || ''
    const chTitle = $(el).text().trim()
    const numMatch = href.match(/chapter-(\d+)/i) || chTitle.match(/chapter\s*(\d+)/i)
    if (href) {
      chapters.push({
        number: numMatch ? parseInt(numMatch[1], 10) : chapters.length + 1,
        title: chTitle || null,
        url: href.startsWith('http') ? href : `${BASE}${href}`,
      })
    }
  })
  // Toonily lists chapters newest-first
  chapters.sort((a, b) => a.number - b.number)

  return { title, author, coverUrl, description, genre, totalChapters: chapters.length, chapters }
}
