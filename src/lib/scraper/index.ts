import type { ScrapeResult } from '@/lib/types'
import { extractBookUrl, extractChapterFromUrl, normalizeUrl } from '@/lib/utils'
import { scrapeReadNovelFull } from './readnovelfull'
import { scrapeNovelpub } from './novelpub'
import { scrapeWuxiaworld } from './wuxiaworld'
import { scrapeRoyalRoad } from './royalroad'
import { scrapeScribbleHub } from './scribblehub'
import { scrapeMangaDex, resolveMangaDexChapterUrl } from './mangadex'
import { scrapeWebtoons } from './webtoons'
import { scrapeToonily } from './toonily'
import { scrapeEmpireNovel } from './empirenovel'
import { scrapeHangukHub } from './hangukhub'
import { scrapeNovelBin } from './novelbin'
import { scrapeGeneric } from './generic'

export async function scrapeBook(inputUrl: string): Promise<ScrapeResult> {
  const parsed = new URL(inputUrl)
  const host = parsed.hostname.replace(/^www\./, '')

  // ── Chapter URL detection ────────────────────────────────────────────────
  let url = inputUrl
  let detectedChapter: number | undefined

  if (host === 'mangadex.org' && parsed.pathname.startsWith('/chapter/')) {
    // MangaDex chapter pages need an API call to find the manga
    const resolved = await resolveMangaDexChapterUrl(inputUrl)
    if (resolved) {
      url = resolved.bookUrl
      detectedChapter = resolved.chapterNumber ?? undefined
    }
  } else {
    const bookUrl = extractBookUrl(inputUrl)
    if (bookUrl && bookUrl !== normalizeUrl(inputUrl)) {
      url = bookUrl
      detectedChapter = extractChapterFromUrl(inputUrl) ?? undefined
    }
  }

  // ── Dispatch to site-specific scraper ────────────────────────────────────
  const scraperHost = new URL(url).hostname.replace(/^www\./, '')
  let result: ScrapeResult

  if (scraperHost === 'readnovelfull.com' || scraperHost === 'readnovelfull.net') {
    result = await scrapeReadNovelFull(url)
  } else if (scraperHost === 'novelpub.com') {
    result = await scrapeNovelpub(url)
  } else if (scraperHost === 'wuxiaworld.com') {
    result = await scrapeWuxiaworld(url)
  } else if (scraperHost === 'royalroad.com') {
    result = await scrapeRoyalRoad(url)
  } else if (scraperHost === 'scribblehub.com') {
    result = await scrapeScribbleHub(url)
  } else if (scraperHost === 'mangadex.org') {
    result = await scrapeMangaDex(url)
  } else if (scraperHost === 'webtoons.com') {
    result = await scrapeWebtoons(url)
  } else if (scraperHost === 'toonily.com') {
    result = await scrapeToonily(url)
  } else if (scraperHost === 'empirenovel.com') {
    result = await scrapeEmpireNovel(url)
  } else if (scraperHost === 'hangukhub.com') {
    result = await scrapeHangukHub(url)
  } else if (scraperHost === 'novelbin.com') {
    result = await scrapeNovelBin(url)
  } else {
    result = await scrapeGeneric(url)
  }

  // ── Attach chapter detection metadata ────────────────────────────────────
  if (detectedChapter !== undefined) {
    result.detectedChapter = detectedChapter
  }
  if (url !== inputUrl) {
    result.normalizedUrl = url
  }

  return result
}
