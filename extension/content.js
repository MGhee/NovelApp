/**
 * NovelApp Tracker - Content Script
 * Runs on novel reading sites and reports the current chapter to the local app.
 */
(async function () {
  const APP_URL = 'http://localhost:3000'
  const currentUrl = window.location.href
  const pageTitle = document.title

  // 1. Extract chapter number from URL or title
  const urlMatch = currentUrl.match(/chapter[_\-\/]?(\d+)/i)
  const titleMatch = pageTitle.match(/chapter\s+(\d+)/i)
  const chapterNumber = urlMatch
    ? parseInt(urlMatch[1], 10)
    : titleMatch
    ? parseInt(titleMatch[1], 10)
    : null

  if (!chapterNumber || isNaN(chapterNumber)) return

  // 2. Derive book's base URL by stripping the chapter path segment
  //    e.g. https://readnovelfull.com/book-slug/chapter-123.html
  //       → https://readnovelfull.com/book-slug.html
  function extractBookUrl(chUrl) {
    try {
      const u = new URL(chUrl)
      const parts = u.pathname.split('/').filter(Boolean)
      if (parts.length < 2) return null
      const bookSlug = parts[0]
      const bookPath = `/${bookSlug}${bookSlug.endsWith('.html') ? '' : '.html'}`
      return `${u.origin}${bookPath}`
    } catch {
      return null
    }
  }

  const bookBaseUrl = extractBookUrl(currentUrl)
  if (!bookBaseUrl) return

  // 3. Send update to local app
  try {
    const response = await fetch(`${APP_URL}/api/extension/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteUrl: bookBaseUrl,
        chapterNumber,
        chapterUrl: currentUrl,
      }),
    })

    const data = await response.json()

    // 4. Notify background service worker
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
