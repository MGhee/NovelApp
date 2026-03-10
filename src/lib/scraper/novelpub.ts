import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapeResult } from '@/lib/types'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export async function scrapeNovelpub(url: string): Promise<ScrapeResult> {
  const { data: html } = await axios.get(url, {
    headers: { 'User-Agent': UA, Referer: 'https://www.novelpub.com' },
    timeout: 15000,
  })
  const $ = cheerio.load(html)

  const title =
    $('h1.novel-title').text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('h1').first().text().trim() ||
    'Unknown'

  const author =
    $('span.author a').first().text().trim() ||
    $('[itemprop="author"]').first().text().trim() ||
    null

  const rawCover =
    $('figure.cover img').attr('src') ||
    $('img.cover-image').attr('src') ||
    $('meta[property="og:image"]').attr('content') ||
    null
  const coverUrl = rawCover
    ? rawCover.startsWith('http') ? rawCover : `https://www.novelpub.com${rawCover}`
    : null

  const description =
    $('div.summary .content p').map((_, el) => $(el).text().trim()).get().join('\n').trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    null

  const genre =
    $('div.categories a, div.genres a, .tags a')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean)
      .slice(0, 6)
      .join(', ') || null

  // Fetch chapters from /chapters page (first page for count, then iterate)
  const chapters: ScrapeResult['chapters'] = []
  try {
    const slug = new URL(url).pathname.replace(/^\/novel\//, '').replace(/\/$/, '')
    const chaptersUrl = `https://www.novelpub.com/novel/${slug}/chapters`
    const { data: chHtml } = await axios.get(chaptersUrl, {
      headers: { 'User-Agent': UA, Referer: url },
      timeout: 15000,
    })
    const $c = cheerio.load(chHtml)

    // Try to find total pages
    const lastPage = parseInt($c('.pagination .PagedList-skipToLast a, .pagination li:last-child a').attr('href')?.match(/page=(\d+)/)?.[1] || '1', 10)
    const maxPages = Math.min(lastPage, 20) // cap at 20 pages to avoid abuse

    const collectChapters = ($p: cheerio.CheerioAPI) => {
      $p('ul.chapter-list li a, .chapter-list a').each((i, el) => {
        const href = $p(el).attr('href') || ''
        const chTitle = $p(el).find('.chapter-title, span').first().text().trim() || $p(el).text().trim()
        const numMatch = href.match(/chapter-(\d+)/i) || chTitle.match(/chapter\s*(\d+)/i)
        if (href) {
          chapters.push({
            number: numMatch ? parseInt(numMatch[1], 10) : chapters.length + 1,
            title: chTitle || null,
            url: href.startsWith('http') ? href : `https://www.novelpub.com${href}`,
          })
        }
      })
    }

    collectChapters($c)

    for (let page = 2; page <= maxPages; page++) {
      const { data: pageHtml } = await axios.get(`${chaptersUrl}?page=${page}`, {
        headers: { 'User-Agent': UA, Referer: chaptersUrl },
        timeout: 10000,
      })
      collectChapters(cheerio.load(pageHtml))
    }

    chapters.sort((a, b) => a.number - b.number)
  } catch {
    // Chapter list unavailable — continue without it
  }

  return { title, author, coverUrl, description, genre, totalChapters: chapters.length, chapters }
}
