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
 * Given a chapter URL like https://readnovelfull.com/book-slug/chapter-123.html,
 * return the book's base URL: https://readnovelfull.com/book-slug.html
 */
export function extractBookUrl(chapterUrl: string): string | null {
  try {
    const u = new URL(chapterUrl)
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    // Pattern: /book-slug/chapter-N.html → /book-slug.html
    const bookSlug = parts[0]
    const bookPath = `/${bookSlug}${bookSlug.endsWith('.html') ? '' : '.html'}`
    return `${u.origin}${bookPath}`
  } catch {
    return null
  }
}

/** Extract chapter number from URL, e.g. /chapter-123.html → 123 */
export function extractChapterFromUrl(url: string): number | null {
  const match = url.match(/chapter[_-](\d+)/i) || url.match(/ch[_-](\d+)/i)
  return match ? parseInt(match[1], 10) : null
}

/** Extract chapter number from page title, e.g. "Chapter 123 - Title | Site" */
export function extractChapterFromTitle(title: string): number | null {
  const match = title.match(/chapter\s+(\d+)/i)
  return match ? parseInt(match[1], 10) : null
}
