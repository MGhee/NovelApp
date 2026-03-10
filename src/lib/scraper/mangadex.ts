import axios from 'axios'
import type { ScrapeResult } from '@/lib/types'

const API = 'https://api.mangadex.org'
const UPLOADS = 'https://uploads.mangadex.org'

/** Extract manga UUID from a MangaDex title URL like /title/{uuid} or /title/{uuid}/{slug} */
function extractMangaId(url: string): string | null {
  const match = new URL(url).pathname.match(/\/title\/([0-9a-f-]{36})/)
  return match?.[1] ?? null
}

export async function scrapeMangaDex(url: string): Promise<ScrapeResult> {
  const mangaId = extractMangaId(url)
  if (!mangaId) throw new Error('Could not extract manga ID from URL')

  // Fetch manga metadata
  const { data: mangaData } = await axios.get(`${API}/manga/${mangaId}`, {
    params: { 'includes[]': ['cover_art', 'author', 'artist'] },
    timeout: 15000,
  })
  const manga = mangaData.data
  const attrs = manga.attributes

  // Title (prefer English)
  const title =
    attrs.title?.en ||
    Object.values(attrs.title ?? {})[0] ||
    'Unknown'

  // Author from relationships
  const authorRel = manga.relationships?.find((r: any) => r.type === 'author')
  const author = authorRel?.attributes?.name || null

  // Cover from relationships
  let coverUrl: string | null = null
  const coverRel = manga.relationships?.find((r: any) => r.type === 'cover_art')
  if (coverRel?.attributes?.fileName) {
    coverUrl = `${UPLOADS}/covers/${mangaId}/${coverRel.attributes.fileName}.512.jpg`
  }

  // Description (prefer English)
  const description =
    attrs.description?.en ||
    Object.values(attrs.description ?? {})[0] ||
    null

  // Tags → genre
  const genre =
    (attrs.tags ?? [])
      .filter((t: any) => t.attributes?.group === 'genre' || t.attributes?.group === 'theme')
      .map((t: any) => t.attributes?.name?.en || Object.values(t.attributes?.name ?? {})[0])
      .filter(Boolean)
      .slice(0, 6)
      .join(', ') || null

  // Chapters (English, ordered ascending) — paginated, up to 500 per request
  const chapters: ScrapeResult['chapters'] = []
  try {
    let offset = 0
    const limit = 500
    while (true) {
      const { data: feed } = await axios.get(`${API}/manga/${mangaId}/feed`, {
        params: {
          limit,
          offset,
          'translatedLanguage[]': 'en',
          'order[chapter]': 'asc',
          'order[volume]': 'asc',
        },
        timeout: 15000,
      })
      for (const ch of feed.data ?? []) {
        const chAttrs = ch.attributes
        const num = parseFloat(chAttrs.chapter)
        if (isNaN(num)) continue
        chapters.push({
          number: Math.floor(num),
          title: chAttrs.title || `Chapter ${chAttrs.chapter}`,
          url: `https://mangadex.org/chapter/${ch.id}`,
        })
      }
      if (feed.data.length < limit) break
      offset += limit
      if (offset > 5000) break // safety cap
    }
  } catch {
    // Chapter feed unavailable
  }

  return {
    title: String(title),
    author,
    coverUrl,
    description: description ? String(description) : null,
    genre,
    totalChapters: chapters.length,
    chapters,
  }
}

/** Resolve a MangaDex chapter URL to its manga URL (needs API call) */
export async function resolveMangaDexChapterUrl(chapterUrl: string): Promise<{ bookUrl: string; chapterNumber: number | null } | null> {
  try {
    const chapterUuid = new URL(chapterUrl).pathname.match(/\/chapter\/([0-9a-f-]{36})/)?.[1]
    if (!chapterUuid) return null

    const { data } = await axios.get(`${API}/chapter/${chapterUuid}`, {
      params: { 'includes[]': 'manga' },
      timeout: 10000,
    })
    const mangaRel = data.data?.relationships?.find((r: any) => r.type === 'manga')
    if (!mangaRel) return null

    const chNum = parseFloat(data.data?.attributes?.chapter)
    return {
      bookUrl: `https://mangadex.org/title/${mangaRel.id}`,
      chapterNumber: isNaN(chNum) ? null : Math.floor(chNum),
    }
  } catch {
    return null
  }
}
