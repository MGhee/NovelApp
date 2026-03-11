import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapeResult } from '@/lib/types'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const BASE = 'https://readnovelfull.com'

export async function scrapeReadNovelFull(url: string): Promise<ScrapeResult> {
  const { data: html } = await axios.get(url, {
    headers: { 'User-Agent': UA, Referer: BASE },
    timeout: 15000,
  })
  const $ = cheerio.load(html)

  let title = $('h3.title').text().trim() || $('h1').first().text().trim() || 'Unknown'
  // Deduplicate title if it appears twice (e.g., "TitleTitle")
  const halfLen = Math.floor(title.length / 2)
  if (halfLen > 5 && title.substring(0, halfLen) === title.substring(halfLen)) {
    title = title.substring(0, halfLen)
  }
  const author = $('li.author a').first().text().trim() || null
  const rawCover = $('.book img').attr('src') || $('meta[property="og:image"]').attr('content') || null
  const coverUrl = rawCover
    ? rawCover.startsWith('http') ? rawCover : `${BASE}${rawCover}`
    : null
  let description = $('div.desc-text p').map((_, el) => $(el).text().trim()).get().join('\n').trim() || null
  // Remove title if it appears at the start of description (duplicate from site HTML)
  if (description && description.startsWith(title)) {
    description = description.substring(title.length).trim()
  }
  const genre = $('li.categories a').map((_, el) => $(el).text().trim()).get().join(', ') || null

  // Novel ID is in a data attribute used for chapter list AJAX
  const novelId =
    $('#rating').attr('data-novel-id') ||
    $('[data-novel-id]').first().attr('data-novel-id') ||
    ''

  let chapters: ScrapeResult['chapters'] = []
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
    } catch {
      // Chapter list fetch failed — continue without chapter list
    }
  }

  return { title, author, coverUrl, description, genre, totalChapters: chapters.length, chapters }
}
