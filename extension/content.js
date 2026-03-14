/**
 * NovelApp Tracker - Content Script
 * Runs on novel reading sites and reports the current chapter to the local app.
 */
(async function () {
  const { appUrl } = await chrome.storage.sync.get({ appUrl: 'http://localhost:3000' })
  const APP_URL = appUrl
  const currentUrl = window.location.href
  const pageTitle = document.title

  function parsePositiveInt(value) {
    if (!value) return null
    const n = parseInt(value, 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }

  function extractChapterFromUrl(url) {
    const explicitMatch =
      url.match(/(?:chapter|chap|ch)[\s._\-/]*(\d{1,5})(?!\d)/i) ||
      url.match(/(?:episode|ep)[\s._\-/]*(\d{1,5})(?!\d)/i)
    if (explicitMatch) return parsePositiveInt(explicitMatch[1])

    try {
      const u = new URL(url)

      // Query params like ?chapter=120 or ?episode_no=57
      const queryKeys = ['chapter', 'ch', 'chap', 'episode', 'ep', 'episode_no']
      for (const key of queryKeys) {
        const parsed = parsePositiveInt(u.searchParams.get(key))
        if (parsed) return parsed
      }

      // Fallback to trailing numeric path patterns like /slug/123 or /title-123
      const segments = u.pathname.split('/').filter(Boolean)
      for (let i = segments.length - 1; i >= 0; i--) {
        const clean = segments[i].replace(/\.[a-z0-9]+$/i, '')
        const exact = clean.match(/^(\d{1,5})$/)
        if (exact) return parsePositiveInt(exact[1])

        const slugLike = clean.match(/(?:^|[-_])(\d{1,5})(?:$|[-_])/)
        if (slugLike) return parsePositiveInt(slugLike[1])
      }
    } catch {
      // Ignore parse failures and fall through.
    }

    return null
  }

  function extractChapterFromTitle(title) {
    const match =
      title.match(/(?:chapter|chap|ch)\.?\s*(\d{1,5})(?!\d)/i) ||
      title.match(/(?:episode|ep)\.?\s*(\d{1,5})(?!\d)/i)
    return match ? parsePositiveInt(match[1]) : null
  }

  // 1. Extract chapter number from URL or title
  const chapterNumber = extractChapterFromUrl(currentUrl) ?? extractChapterFromTitle(pageTitle)

  if (!chapterNumber || isNaN(chapterNumber)) return

  // 2. Send update to local app.
  // API route normalizes chapter URL to book URL server-side for each site.
  try {
    const response = await fetch(`${APP_URL}/api/extension/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteUrl: currentUrl,
        chapterNumber,
        chapterUrl: currentUrl,
      }),
    })

    const data = await response.json()

    // 3. Notify background service worker
    chrome.runtime.sendMessage({
      type: 'CHAPTER_UPDATED',
      updated: data.updated,
      bookTitle: data.book?.title || null,
      chapterNumber,
    })
  } catch {
    // App not running — fail silently
    chrome.runtime.sendMessage({ type: 'APP_OFFLINE' })
  }
})()
