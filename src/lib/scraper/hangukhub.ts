import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapeResult } from '@/lib/types'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const BASE = 'https://hangukhub.com'

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

/**
 * Extract chapter number from a hangukhub chapter slug.
 * Handles two formats:
 *   /series/{slug}/chapter-724       → 724
 *   /series/{slug}/part-2-chapter-1  → null (use listing position instead)
 */
function extractChapterNum(slug: string): number | null {
  // Standard: chapter-N at end
  const standard = slug.match(/(?:^|[-/])chapter-(\d+)$/i)
  if (standard) return parseInt(standard[1], 10)
  return null
}

export async function scrapeHangukHub(url: string): Promise<ScrapeResult> {
  // Always scrape the series root page, not a chapter page
  const seriesUrl = (() => {
    const u = new URL(url)
    const parts = u.pathname.split('/').filter(Boolean)
    // /series/{slug} or /series/{slug}/...
    if (parts[0] === 'series' && parts.length >= 2) {
      return `${BASE}/series/${parts[1]}/`
    }
    return url
  })()

  const { data: html } = await axios.get(seriesUrl, {
    headers: HEADERS,
    timeout: 20000,
  })
  const $ = cheerio.load(html)

  const title =
    $('div.post-title h1, h1.entry-title').first().text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('h1').first().text().trim() ||
    'Unknown'

  const author =
    $('.author-content a, .novel-author a').first().text().trim() ||
    $('[itemprop="author"]').first().text().trim() ||
    null

  const rawCover =
    $('div.summary_image img, .thumb img, .cover img').attr('src') ||
    $('meta[property="og:image"]').attr('content') ||
    null
  const coverUrl = rawCover
    ? rawCover.startsWith('http') ? rawCover : `${BASE}${rawCover}`
    : null

  const description =
    $('div.summary__content p, div.manga-summary p, .description p')
      .map((_, el) => $(el).text().trim()).get().join('\n').trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    null

  const genre =
    $('.genres-content a, .wp-manga-tags-list a, .genre a')
      .map((_, el) => $(el).text().trim())
      .get().filter(Boolean).slice(0, 6).join(', ') || null

  // Chapters listed newest-first; collect all, then sort
  const rawChapters: Array<{ slug: string; title: string; url: string }> = []

  $('ul.main.version-chap li.wp-manga-chapter a, .listing-chapters_wrap li a, ul li a[href*="/series/"]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const chTitle = $(el).text().trim()
    if (!href.includes('/series/')) return
    rawChapters.push({ slug: href, title: chTitle, url: href.startsWith('http') ? href : `${BASE}${href}` })
  })

  // Reverse so oldest is first, then assign numbers
  rawChapters.reverse()

  const chapters: ScrapeResult['chapters'] = rawChapters.map((ch, idx) => {
    // Try to extract chapter number from the URL slug
    const urlSlug = new URL(ch.url).pathname.split('/').filter(Boolean).pop() || ''
    const extracted = extractChapterNum(urlSlug)
    return {
      number: extracted ?? (idx + 1),
      title: ch.title || null,
      url: ch.url,
    }
  })

  // De-duplicate by number (keep first occurrence)
  const seen = new Set<number>()
  const deduped = chapters.filter(c => {
    if (seen.has(c.number)) return false
    seen.add(c.number)
    return true
  })

  deduped.sort((a, b) => a.number - b.number)

  return { title, author, coverUrl, description, genre, totalChapters: deduped.length, chapters: deduped }
}
