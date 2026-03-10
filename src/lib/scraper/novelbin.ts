import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapeResult } from '@/lib/types'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const BASE = 'https://novelbin.com'

export async function scrapeNovelBin(url: string): Promise<ScrapeResult> {
  const { data: html } = await axios.get(url, {
    headers: { 'User-Agent': UA, Referer: BASE },
    timeout: 15000,
  })
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
  const novelId =
    $('#rating').attr('data-novel-id') ||
    $('[data-novel-id]').first().attr('data-novel-id') ||
    ''

  if (novelId) {
    try {
      const { data: chHtml } = await axios.get(
        `${BASE}/ajax/chapter-archive?novelId=${novelId}`,
        { headers: { 'User-Agent': UA, Referer: url }, timeout: 15000 }
      )
      const $c = cheerio.load(chHtml)
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
    } catch { /* chapter list unavailable */ }
  }

  // Fallback: parse chapter links from page directly
  if (chapters.length === 0) {
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
