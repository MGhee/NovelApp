import 'server-only'
import * as cheerio from 'cheerio'
import { fetchWithBrowser } from './browser'
import type { ScrapeResult } from '@/lib/types'

const BASE = 'https://hangukhub.com'

/**
 * Clean chapter title by removing prefixes, chapter numbers, and date info.
 */
function cleanChapterTitle(rawTitle: string): string | null {
  if (!rawTitle) return null

  let title = rawTitle

  // Remove "Pt. X Ch. Y..." pattern first (Part + Chapter) - e.g., "Pt. 2 Ch. 100(2)" → content
  title = title.replace(/^Pt\.\s*\d+\s*Ch(?:apter)?[.:]?\s*\d+(?:\(\d+\))?(?:\+\d+)?(?:\([^)]*\))*\s*/i, '')

  // Remove "Pt. X " prefix if not already handled - e.g., "Pt. 2 "
  title = title.replace(/^Pt\.\s*\d+\s*/i, '')

  // Remove "Ch(apter) X..." prefix at start - e.g., "Ch. 2Which floor" → "Which floor"
  // This handles "Ch. 123", "Ch. 2Which", "Chapter 5The Story", etc.
  title = title.replace(/^Ch(?:apter)?[.:]?\s*\d+(?:\(\d+\))?(?:\+\d+)?(?:\([^)]*\))*\s*/i, '')

  // Remove trailing metadata: "/ XXXh ago", "/ XXXw ago", "/ XXXX"
  title = title.replace(/\s*\/\s*\d+[a-z]*(?:\s*ago)?\s*$/i, '')
  title = title.replace(/\s*\/\s*\d+\s*$/i, '')

  // Remove date patterns at the end - handle both "Apr 21, 2023" and "Apr21,2023" formats
  title = title.replace(/\s*[A-Z][a-z]{2}\s*\d{1,2},?\s*\d{4}\s*$/i, '')

  // Remove leading/trailing metadata like "/ 824", "+ something / 825"
  title = title.replace(/^[+\/\s]+/, '')
  title = title.replace(/[+\/\s\d]*$/, '')

  // Trim whitespace
  title = title.trim()

  // If nothing remains after cleanup (pure metadata/empty), return null
  if (!title || /^[\s\/\d\(\)+-]*$/.test(title)) {
    return null
  }

  return title
}

/**
 * Extract chapter number from a hangukhub chapter slug.
 * Handles formats:
 *   /series/{slug}/chapter-724           → 724
 *   /series/{slug}/part-2-chapter-120    → 844 (724 + 120 for Part 2)
 */
function extractChapterNum(slug: string, totalPart1Chapters: number = 724): number | null {
  // Part 2 chapters: part-2-chapter-N
  const part2Match = slug.match(/part-2-chapter-(\d+)$/i)
  if (part2Match) {
    // Part 2 chapters continue after Part 1, so add Part 1 total as offset
    return totalPart1Chapters + parseInt(part2Match[1], 10)
  }

  // Standard Part 1: chapter-N at end
  const standard = slug.match(/(?:^|[-/])chapter-(\d+)$/i)
  if (standard) return parseInt(standard[1], 10)

  return null
}

export function parseHangukHub(html: string, url: string): ScrapeResult {
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

  // Try multiple selectors for cover image, including Next.js optimized images
  let rawCover = $('img.object-cover').attr('src') || $('img.object-cover').attr('data-src')
  if (!rawCover) rawCover = $('div.summary_image img, .thumb img, .cover img').attr('src')
  if (!rawCover) rawCover = $('meta[property="og:image"]').attr('content')

  // Extract actual image URL from Next.js optimization wrapper if present
  let coverUrl: string | null = null
  if (rawCover) {
    if (rawCover.includes('/_next/image')) {
      // Extract URL from Next.js image optimization: /_next/image?url=...&w=...&q=...
      const urlMatch = rawCover.match(/url=([^&]+)/)
      if (urlMatch) {
        coverUrl = decodeURIComponent(urlMatch[1])
      } else {
        coverUrl = rawCover
      }
    } else {
      coverUrl = rawCover.startsWith('http') ? rawCover : `${BASE}${rawCover}`
    }
  }

  // Try multiple selectors for description
  let description = $('div.summary__content p, div.manga-summary p, .description p')
    .map((_, el) => $(el).text().trim()).get().filter(Boolean).join('\n').trim() || null
  if (!description) description = $('meta[property="og:description"]').attr('content')?.trim() || null
  // Fallback: look for any substantial paragraph text
  if (!description) {
    const p = $('p').filter((_, el) => {
      const text = $(el).text().trim()
      return text.length > 50 && !text.toLowerCase().includes('cookie')
    }).first().text().trim()
    description = p || null
  }

  const genre =
    $('.genres-content a, .wp-manga-tags-list a, .genre a')
      .map((_, el) => $(el).text().trim())
      .get().filter(Boolean).slice(0, 6).join(', ') || null

  // Chapters listed newest-first; collect all, then sort
  const rawChapters: Array<{ slug: string; title: string | null; url: string }> = []

  $('a[href*="/series/"][href*="chapter"], a[href*="/series/"][href*="part-2-chapter"]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const rawTitle = $(el).text().trim()
    if (!href.includes('/series/')) return
    // Skip non-chapter links like "Show all chapters"
    if (rawTitle.toLowerCase().includes('show all')) return
    const cleanedTitle = cleanChapterTitle(rawTitle)
    rawChapters.push({ slug: href, title: cleanedTitle, url: href.startsWith('http') ? href : `${BASE}${href}` })
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

  // Fetch the first page to get metadata
  const html = await fetchWithBrowser(seriesUrl, {
    timeout: 30000,
    waitSelector: 'a[href*="/series/"][href*="chapter"]', // Wait for chapter links to render
  })

  const result = parseHangukHub(html, seriesUrl)

  // Fetch paginated chapters from /chapters?sortOrder=desc&page=1, etc.
  const baseSeriesUrl = seriesUrl.replace(/\/$/, '')
  const allFetchedChapters: {number: number, title: string | null, url: string, isPart2: boolean}[] = []

  // Try fetching pages until we get 2 consecutive empty pages
  let pageNum = 1
  let consecutiveEmptyPages = 0

  while (consecutiveEmptyPages < 2) {
    try {
      const pageHtml = await fetchWithBrowser(`${baseSeriesUrl}/chapters?sortOrder=desc&page=${pageNum}`, {
        timeout: 30000,
      })

      const $ = cheerio.load(pageHtml)
      let foundChapters = 0

      $('a[href*="/series/"][href*="chapter"], a[href*="/series/"][href*="part-2-chapter"]').each((_, el) => {
        const href = $(el).attr('href') || ''
        const rawTitle = $(el).text().trim()
        if (!href.includes('/series/')) return
        if (rawTitle.toLowerCase().includes('show all')) return

        const isPart2 = href.includes('part-2-chapter')
        const part2Match = isPart2 ? href.match(/part-2-chapter-(\d+)/i) : null
        const part1Match = !isPart2 ? href.match(/\/chapter-(\d+)/i) : null

        const chNum = part2Match ? parseInt(part2Match[1], 10) : (part1Match ? parseInt(part1Match[1], 10) : 0)

        if (chNum > 0) {
          const cleanedTitle = cleanChapterTitle(rawTitle)
          allFetchedChapters.push({
            number: chNum,
            title: cleanedTitle || null,
            url: href.startsWith('http') ? href : `${BASE}${href}`,
            isPart2
          })
          foundChapters++
        }
      })

      if (foundChapters === 0) {
        consecutiveEmptyPages++
      } else {
        consecutiveEmptyPages = 0
      }

      pageNum++
      await new Promise(r => setTimeout(r, 500))
    } catch {
      break
    }
  }

  // Separate Part 1 and Part 2, count Part 1 to determine offset for Part 2
  const part1Chapters = allFetchedChapters.filter(ch => !ch.isPart2)
  const part2Chapters = allFetchedChapters.filter(ch => ch.isPart2)
  const part1MaxNum = Math.max(0, ...part1Chapters.map(ch => ch.number))

  // Renumber chapters: keep Part 1 as-is, offset Part 2 by Part 1 max
  const finalChapters = [
    ...result.chapters, // From base page
    ...part1Chapters.map(ch => ({number: ch.number, title: ch.title, url: ch.url})),
    ...part2Chapters.map(ch => ({number: part1MaxNum + ch.number, title: ch.title, url: ch.url}))
  ]

  // De-duplicate by number and sort
  const seen = new Set<number>()
  const deduped = finalChapters.filter(c => {
    if (seen.has(c.number)) return false
    seen.add(c.number)
    return true
  })

  deduped.sort((a, b) => a.number - b.number)

  result.chapters = deduped
  result.totalChapters = deduped.length

  return result
}
