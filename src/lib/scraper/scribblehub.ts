import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapeResult } from '@/lib/types'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const BASE = 'https://www.scribblehub.com'

export async function scrapeScribbleHub(url: string): Promise<ScrapeResult> {
  const { data: html } = await axios.get(url, {
    headers: { 'User-Agent': UA, Referer: BASE },
    timeout: 15000,
  })
  const $ = cheerio.load(html)

  const title =
    $('div.fic_title').text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('h1').first().text().trim() ||
    'Unknown'

  const author =
    $('span.auth_name_fic a').first().text().trim() ||
    $('[itemprop="author"]').first().text().trim() ||
    null

  const rawCover =
    $('div.fic_image img').attr('src') ||
    $('meta[property="og:image"]').attr('content') ||
    null
  const coverUrl = rawCover
    ? rawCover.startsWith('http') ? rawCover : `${BASE}${rawCover}`
    : null

  const description =
    $('div.wi_fic_desc p').map((_, el) => $(el).text().trim()).get().join('\n').trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    null

  const genre =
    $('a.fic_genre, .wi_fic_genre a, span.wi_fic_genre a')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean)
      .slice(0, 6)
      .join(', ') || null

  // Fetch ToC via AJAX endpoint (ScribbleHub uses WordPress AJAX)
  const chapters: ScrapeResult['chapters'] = []
  try {
    // Extract series ID from URL or page
    const seriesIdMatch = url.match(/\/series\/(\d+)/) ||
      $('input#novel_id, input[name="novel_id"]').attr('value')?.match(/(\d+)/)
    const seriesId = seriesIdMatch?.[1]

    if (seriesId) {
      const { data: tocHtml } = await axios.post(
        `${BASE}/wp-admin/admin-ajax.php`,
        new URLSearchParams({ action: 'wi_gettocchp', strFic: seriesId }),
        {
          headers: {
            'User-Agent': UA,
            Referer: url,
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest',
          },
          timeout: 15000,
        }
      )
      const $t = cheerio.load(tocHtml)
      $t('li.toc_w a').each((_, el) => {
        const href = $t(el).attr('href') || ''
        const chTitle = $t(el).text().trim()
        const numMatch = href.match(/\/chapter-(\d+)/) || chTitle.match(/chapter\s*(\d+)/i)
        if (href) {
          chapters.push({
            number: numMatch ? parseInt(numMatch[1], 10) : chapters.length + 1,
            title: chTitle || null,
            url: href.startsWith('http') ? href : `${BASE}${href}`,
          })
        }
      })
      chapters.sort((a, b) => a.number - b.number)
    }
  } catch {
    // ToC unavailable — continue without chapters
  }

  return { title, author, coverUrl, description, genre, totalChapters: chapters.length, chapters }
}
