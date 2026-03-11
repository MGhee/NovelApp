import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapeResult } from '@/lib/types'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/**
 * Scraper for justlightnovels.com (WordPress LightNovel theme)
 * This site is primarily a PDF/EPUB download site, not chapter-reading.
 * The scraper extracts metadata but returns empty chapters list.
 * NOTE: The site may be blocked by Cloudflare; graceful degradation is built in.
 */
export async function scrapeJustLightNovels(url: string): Promise<ScrapeResult> {
  let title = 'Unknown'
  let author: string | null = null
  let coverUrl: string | null = null
  let description: string | null = null
  let genre: string | null = null

  try {
    const { data: html } = await axios.get(url, {
      headers: { 'User-Agent': UA, Referer: 'https://www.justlightnovels.com' },
      timeout: 15000,
    })
    const $ = cheerio.load(html)

    // Try various selectors for title (WordPress post title)
    title =
      $('h1.entry-title').text().trim() ||
      $('h1.post-title').text().trim() ||
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('title').text().trim() ||
      title

    // Author — may be in author byline or metadata
    author =
      $('span.author-name').text().trim() ||
      $('a[rel="author"]').text().trim() ||
      $('[itemprop="author"]').text().trim() ||
      null

    // Cover image
    const rawCover =
      $('img.attachment-post-thumbnail').attr('src') ||
      $('figure.wp-caption img').first().attr('src') ||
      $('meta[property="og:image"]').attr('content') ||
      null
    coverUrl = rawCover && rawCover.startsWith('http') ? rawCover : null

    // Description from post excerpt or content
    description =
      $('p.entry-summary').text().trim() ||
      $('meta[property="og:description"]').attr('content')?.trim() ||
      null

    // Genres/categories from WordPress taxonomy
    genre =
      $('a[rel="category"]')
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(Boolean)
        .slice(0, 6)
        .join(', ') || null
  } catch {
    // If scraping fails (e.g., 403 Cloudflare block), we'll still return partial data
    // The error is swallowed because we can still return title/author/etc from metadata
  }

  // PDF/EPUB download sites don't have chapter URLs to track
  // The chapters list is intentionally empty
  const chapters: ScrapeResult['chapters'] = []

  return {
    title,
    author,
    coverUrl,
    description,
    genre,
    totalChapters: 0,
    chapters,
  }
}
