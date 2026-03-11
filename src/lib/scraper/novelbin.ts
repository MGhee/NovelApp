import * as cheerio from 'cheerio'
import { withPage } from './browser'
import type { ScrapeResult } from '@/lib/types'

const BASE = 'https://novelbin.com'

export function parseNovelBin(html: string, url: string, chapterListHtml?: string): ScrapeResult {
  const $ = cheerio.load(html)

  const title =
    $('h3.title').text().trim() ||
    $('h1.novel-title, h1.title').first().text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    'Unknown'

  const author =
    $('li.author a, .info a[href*="author"]').first().text().trim() ||
    $('[itemprop="author"]').first().text().trim() ||
    null

  const rawCover =
    $('.book img, .cover img').attr('src') ||
    $('meta[property="og:image"]').attr('content') ||
    null
  const coverUrl = rawCover
    ? rawCover.startsWith('http') ? rawCover : `${BASE}${rawCover}`
    : null

  const description =
    $('div.desc-text p').map((_, el) => $(el).text().trim()).get().join('\n').trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    null

  const genre =
    $('li.categories a, .tag-item a, .genres a')
      .map((_, el) => $(el).text().trim())
      .get().filter(Boolean).slice(0, 6).join(', ') || null

  // NovelBin uses the same AJAX chapter-archive pattern as ReadNovelFull
  const chapters: ScrapeResult['chapters'] = []

  // If provided HTML from AJAX endpoint, use it; otherwise try to extract from main page
  if (chapterListHtml) {
    const $c = cheerio.load(chapterListHtml)
    $c('ul.list-chapter li a').each((i, el) => {
      const href = $c(el).attr('href') || ''
      const chTitle = $c(el).text().trim()
      const numMatch = href.match(/chapter[_-](\d+)/i)
      if (href) {
        chapters.push({
          number: numMatch ? parseInt(numMatch[1], 10) : i + 1,
          title: chTitle || null,
          url: href.startsWith('http') ? href : `${BASE}${href}`,
        })
      }
    })
    chapters.sort((a, b) => a.number - b.number)
  } else {
    // Fallback: parse chapter links from page directly
    $('a[href*="chapter"]').each((_, el) => {
      const href = $(el).attr('href') || ''
      const numMatch = href.match(/chapter[_-](\d+)/i)
      if (numMatch && !chapters.find(c => c.number === parseInt(numMatch[1], 10))) {
        chapters.push({
          number: parseInt(numMatch[1], 10),
          title: $(el).text().trim() || null,
          url: href.startsWith('http') ? href : `${BASE}${href}`,
        })
      }
    })
    chapters.sort((a, b) => a.number - b.number)
  }

  return { title, author, coverUrl, description, genre, totalChapters: chapters.length, chapters }
}

export async function scrapeNovelBin(url: string): Promise<ScrapeResult> {
  return withPage(async (page) => {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
    const html = await page.content()

    // Fetch AJAX chapter list from within the browser context (same-origin, shares Cloudflare cookies)
    const chapterListHtml = await page.evaluate(async (base) => {
      const el = document.querySelector('#rating[data-novel-id], [data-novel-id]')
      const novelId = el?.getAttribute('data-novel-id')
      if (!novelId) return null

      try {
        const resp = await fetch(`${base}/ajax/chapter-archive?novelId=${novelId}`, {
          credentials: 'same-origin',
        })
        return resp.ok ? await resp.text() : null
      } catch {
        return null
      }
    }, BASE)

    return parseNovelBin(html, url, chapterListHtml ?? undefined)
  })
}
