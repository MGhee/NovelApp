import type { ScrapeResult } from '@/lib/types'
import { scrapeReadNovelFull } from './readnovelfull'
import { scrapeGeneric } from './generic'

export async function scrapeBook(url: string): Promise<ScrapeResult> {
  const hostname = new URL(url).hostname.replace(/^www\./, '')

  if (hostname === 'readnovelfull.com' || hostname === 'readnovelfull.net') {
    return scrapeReadNovelFull(url)
  }

  return scrapeGeneric(url)
}
