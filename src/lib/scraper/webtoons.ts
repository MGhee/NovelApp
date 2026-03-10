import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapeResult } from '@/lib/types'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const BASE = 'https://www.webtoons.com'

export async function scrapeWebtoons(url: string): Promise<ScrapeResult> {
  // Normalise to list page if not already
  const listUrl = url.includes('/list?') || url.includes('/viewer?')
    ? url.replace('/viewer?', '/list?').replace(/&episode_no=\d+/, '')
    : url

  const { data: html } = await axios.get(listUrl, {
    headers: {
      'User-Agent': UA,
      Referer: BASE,
      Cookie: 'needCCPA=false; needCOPPA=false; needGDPR=false; pagGDPR=false',
    },
    timeout: 15000,
  })
  const $ = cheerio.load(html)

  const title =
    $('h1.subj').text().trim() ||
    $('h1.detail_title').text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    'Unknown'

  const author =
    $('h2.author').text().trim() ||
    $('div.author_area').text().trim() ||
    null

  const rawCover =
    $('div.detail_body img.detail_bg, .thmb img').attr('src') ||
    $('meta[property="og:image"]').attr('content') ||
    null
  const coverUrl = rawCover
    ? rawCover.startsWith('http') ? rawCover : `${BASE}${rawCover}`
    : null

  const description =
    $('p.summary').text().trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() ||
    null

  // Genre from URL path (/en/{genre}/...)
  const urlParts = new URL(listUrl).pathname.split('/').filter(Boolean)
  const genre = urlParts[1] ? urlParts[1].replace(/-/g, ' ') : null

  // Episodes
  const chapters: ScrapeResult['chapters'] = []
  const titleNo = new URL(listUrl).searchParams.get('title_no')

  $('#_episodeList li, .detail_lst li').each((_, el) => {
    const a = $(el).find('a').first()
    const href = a.attr('href') || ''
    const epNo = new URL(href, BASE).searchParams.get('episode_no')
    const chTitle = $(el).find('.subj span, .subj').first().text().trim()
    if (href && epNo) {
      chapters.push({
        number: parseInt(epNo, 10),
        title: chTitle || null,
        url: href.startsWith('http') ? href : `${BASE}${href}`,
      })
    }
  })

  // Episodes are listed newest-first on Webtoons
  chapters.sort((a, b) => a.number - b.number)

  // If title_no is in URL, also try paginated fetch to get all episodes
  if (titleNo && chapters.length > 0) {
    try {
      const lastEp = chapters[chapters.length - 1].number
      // Webtoons shows 10 per page; if we got fewer than expected, try additional pages
      let page = 2
      while (page <= 20) {
        const pageUrl = `${listUrl}&page=${page}`
        const { data: pageHtml } = await axios.get(pageUrl, {
          headers: { 'User-Agent': UA, Referer: listUrl, Cookie: 'needCCPA=false; needGDPR=false' },
          timeout: 10000,
        })
        const $p = cheerio.load(pageHtml)
        let added = 0
        $p('#_episodeList li, .detail_lst li').each((_, el) => {
          const a = $p(el).find('a').first()
          const href = a.attr('href') || ''
          const epNo = new URL(href, BASE).searchParams.get('episode_no')
          const chTitle = $p(el).find('.subj span, .subj').first().text().trim()
          if (href && epNo && !chapters.find(c => c.number === parseInt(epNo, 10))) {
            chapters.push({
              number: parseInt(epNo, 10),
              title: chTitle || null,
              url: href.startsWith('http') ? href : `${BASE}${href}`,
            })
            added++
          }
        })
        if (added === 0) break
        page++
      }
      chapters.sort((a, b) => a.number - b.number)
    } catch { /* ignore pagination errors */ }
  }

  return { title, author, coverUrl, description, genre, totalChapters: chapters.length, chapters }
}
