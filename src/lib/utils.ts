/** Normalize a book URL — strip query params and trailing slash */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname}`.replace(/\/$/, '')
  } catch {
    return url.trim()
  }
}

/**
 * Given a chapter URL, return the book's index URL.
 * Returns null if the URL is already a book index URL or cannot be converted.
 * Handles: readnovelfull, novelpub, wuxiaworld, royalroad, scribblehub, webtoons, toonily, empirenovel, hangukhub, novelbin, novellive.
 * (mangadex chapter URLs need an API call — handled in the scraper directly.)
 */
export function extractBookUrl(chapterUrl: string): string | null {
  try {
    const u = new URL(chapterUrl)
    const host = u.hostname.replace(/^www\./, '')
    const parts = u.pathname.split('/').filter(Boolean)

    if (host === 'readnovelfull.com' || host === 'readnovelfull.net') {
      // /{slug}/chapter-N.html → /{slug}.html
      if (parts.length < 2) return null
      const slug = parts[0]
      return `${u.origin}/${slug}${slug.endsWith('.html') ? '' : '.html'}`
    }

    if (host === 'novelpub.com') {
      // /novel/{slug}/chapter-N → /novel/{slug}
      if (parts.length >= 3 && parts[0] === 'novel' && /chapter/i.test(parts[2])) {
        return `${u.origin}/novel/${parts[1]}`
      }
      return null
    }

    if (host === 'wuxiaworld.com') {
      // /novel/{slug}/{chapter-slug} → /novel/{slug}
      if (parts.length >= 3 && parts[0] === 'novel') {
        return `${u.origin}/novel/${parts[1]}`
      }
      return null
    }

    if (host === 'royalroad.com') {
      // /fiction/{id}/{slug}/chapter/{chId}/{chSlug} → /fiction/{id}/{slug}
      if (parts.length >= 5 && parts[0] === 'fiction' && parts[3] === 'chapter') {
        return `${u.origin}/fiction/${parts[1]}/${parts[2]}`
      }
      return null
    }

    if (host === 'scribblehub.com') {
      // /read/{id}-{slug}/?chapter=N → /series/{id}/{slug}/
      if (parts[0] === 'read' && parts.length >= 2) {
        const match = parts[1].match(/^(\d+)-(.+)$/)
        if (match) return `${u.origin}/series/${match[1]}/${match[2]}/`
      }
      return null
    }

    if (host === 'mangadex.org') {
      // /chapter/{uuid} — needs API call, handled in scraper
      return null
    }

    if (host === 'webtoons.com') {
      // /en/{genre}/{slug}/viewer?title_no={id}&episode_no={n} → /en/{genre}/{slug}/list?title_no={id}
      if (parts.length >= 4 && parts[parts.length - 1] === 'viewer') {
        const titleNo = u.searchParams.get('title_no')
        if (!titleNo) return null
        const baseParts = parts.slice(0, -1).join('/')
        return `${u.origin}/${baseParts}/list?title_no=${titleNo}`
      }
      return null
    }

    if (host === 'toonily.com') {
      // /webtoon/{slug}/chapter-N/ → /webtoon/{slug}/
      if (parts.length >= 3 && parts[0] === 'webtoon' && /chapter/i.test(parts[2])) {
        return `${u.origin}/webtoon/${parts[1]}/`
      }
      return null
    }

    if (host === 'empirenovel.com') {
      // /novel/{slug}/{chapterNumber} → /novel/{slug}
      // Detect: last segment is all digits
      if (parts.length >= 3 && parts[0] === 'novel' && /^\d+$/.test(parts[parts.length - 1])) {
        return `${u.origin}/novel/${parts[1]}`
      }
      return null
    }

    if (host === 'hangukhub.com') {
      // /series/{slug}/chapter-N         → /series/{slug}/
      // /series/{slug}/part-N-chapter-N  → /series/{slug}/
      if (parts.length >= 3 && parts[0] === 'series') {
        return `${u.origin}/series/${parts[1]}/`
      }
      return null
    }

    if (host === 'novelbin.com') {
      // /b/{slug}/chapter-N → /b/{slug}
      if (parts.length >= 3 && parts[0] === 'b' && /chapter/i.test(parts[2])) {
        return `${u.origin}/b/${parts[1]}`
      }
      // /novel-book/{slug}/chapter-N → /novel-book/{slug}
      if (parts.length >= 3 && parts[0] === 'novel-book' && /chapter/i.test(parts[2])) {
        return `${u.origin}/novel-book/${parts[1]}`
      }
      return null
    }

    if (host === 'novellive.app') {
      // /book/{slug}/chapter-{N}-{title-slug} → /book/{slug}
      if (parts.length >= 3 && parts[0] === 'book' && /chapter/i.test(parts[2])) {
        return `${u.origin}/book/${parts[1]}`
      }
      return null
    }

    if (host === 'kingofshojo.com') {
      // /{slug}-chapter-{N}/ → /manga/{slug}/
      if (parts.length >= 1) {
        const m = parts[parts.length - 1].match(/^(.+?)-chapter-\d+$/i)
        if (m) return `${u.origin}/manga/${m[1]}/`
      }
      return null
    }

    if (host === 'comix.to') {
      // /title/{hash_id}-{slug}/{chapter_id}-chapter-{N} → /title/{hash_id}-{slug}
      if (parts.length >= 3 && parts[0] === 'title' && /-chapter-\d+$/i.test(parts[2])) {
        return `${u.origin}/title/${parts[1]}`
      }
      return null
    }

    if (host === 'asurascans.com') {
      // /comics/{slug}-{8hex}/chapter/{N} → /comics/{slug}
      // /comics/{slug}-{8hex}             → /comics/{slug}
      if (parts.length >= 2 && parts[0] === 'comics') {
        const slug = parts[1].replace(/-[0-9a-f]{8}$/i, '')
        return `${u.origin}/comics/${slug}`
      }
      return null
    }

    if (host === 'saikaiscan.com.br') {
      // /ler/series/{slug}/{n}/{chapter_slug} → /series/{slug}
      if (parts.length >= 3 && parts[0] === 'ler' && parts[1] === 'series') {
        return `${u.origin}/series/${parts[2]}`
      }
      return null
    }

    if (host === 'twkan.com') {
      // /txt/{book_id}/{chapter_id} → /book/{book_id}.html
      if (parts.length >= 2 && parts[0] === 'txt') {
        return `${u.origin}/book/${parts[1]}.html`
      }
      return null
    }

    if (host === 'ttkan.co') {
      // /novel/pagea/{novel_id}_{n}.html → /novel/chapters/{novel_id}
      if (parts.length >= 3 && parts[0] === 'novel' && parts[1] === 'pagea') {
        const novelId = parts[2].replace(/\.html?$/i, '').split('_')[0]
        if (novelId) return `${u.origin}/novel/chapters/${novelId}`
      }
      return null
    }

    // Generic fallback for unknown hosts: strip trailing chapter-like path
    // segments. Handles two patterns:
    //   1. Combined segment: /series/{slug}/chapter-12, /novel/{slug}/ep-3-title
    //   2. Two-segment:      /comics/{slug}/chapter/12, /webtoon/{slug}/ep/3
    const CHAPTER_SEGMENT_RE = /^(?:chapter|chap|ch|episode|ep|vol|volume|part)[-_.]?\d/i
    const CHAPTER_BARE_RE = /^(?:chapter|chap|ch|episode|ep|vol|volume|part)$/i
    let stripped = false
    const trimmed = [...parts]
    while (trimmed.length > 1 && CHAPTER_SEGMENT_RE.test(trimmed[trimmed.length - 1])) {
      trimmed.pop()
      stripped = true
    }
    if (
      trimmed.length >= 2 &&
      /^\d+$/.test(trimmed[trimmed.length - 1]) &&
      CHAPTER_BARE_RE.test(trimmed[trimmed.length - 2])
    ) {
      trimmed.pop()
      trimmed.pop()
      stripped = true
    }
    if (stripped && trimmed.length > 0) {
      return `${u.origin}/${trimmed.join('/')}/`
    }

    return null
  } catch {
    return null
  }
}

/** Extract chapter number from URL, e.g. /chapter-123.html → 123 */
export function extractChapterFromUrl(url: string): number | null {
  const parse = (value: string | null | undefined): number | null => {
    if (!value) return null
    const n = parseInt(value, 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }

  // Prefer explicit chapter markers first.
  const explicitMatch =
    url.match(/(?:chapter|chap|ch)[\s._\-/]*(\d{1,5})(?!\d)/i) ||
    url.match(/(?:episode|ep)[\s._\-/]*(\d{1,5})(?!\d)/i)
  if (explicitMatch) return parse(explicitMatch[1])

  try {
    const u = new URL(url)

    // Handle chapter values in query params, e.g. ?chapter=120 or ?episode_no=57
    const queryKeys = ['chapter', 'ch', 'chap', 'episode', 'ep', 'episode_no']
    for (const key of queryKeys) {
      const value = u.searchParams.get(key)
      const parsed = parse(value)
      if (parsed) return parsed
    }

    // Fallback: detect trailing numeric chapter-like slug in path segments.
    // Example: /novel/slug/123 or /novel/slug/title-123
    const segments = u.pathname.split('/').filter(Boolean)
    for (let i = segments.length - 1; i >= 0; i--) {
      const clean = segments[i].replace(/\.[a-z0-9]+$/i, '')
      const exact = clean.match(/^(\d{1,5})$/)
      if (exact) return parse(exact[1])

      const slugLike = clean.match(/(?:^|[-_])(\d{1,5})(?:$|[-_])/)
      if (slugLike) return parse(slugLike[1])
    }
  } catch {
    // Ignore parse failures and fall through.
  }

  return null
}

/** Extract chapter number from page title, e.g. "Chapter 123 - Title | Site" */
export function extractChapterFromTitle(title: string): number | null {
  const match =
    title.match(/(?:chapter|chap|ch)\.?\s*(\d{1,5})(?!\d)/i) ||
    title.match(/(?:episode|ep)\.?\s*(\d{1,5})(?!\d)/i)
  if (!match) return null
  const parsed = parseInt(match[1], 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}
