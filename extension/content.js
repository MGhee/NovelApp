/**
 * NovelApp Tracker - Content Script
 * Runs on novel reading sites and reports the current chapter to the local app.
 */
(async function () {
  const { appUrl, apiKey, autoRedirect } = await chrome.storage.sync.get({
    appUrl: 'https://novelapp.viktorbarzin.me',
    apiKey: '',
    autoRedirect: true,
  })
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
    const headers = { 'Content-Type': 'application/json' }
    if (apiKey && apiKey.trim()) headers['Authorization'] = `Bearer ${apiKey.trim()}`

    const response = await fetch(`${APP_URL}/api/extension/update`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        siteUrl: currentUrl,
        chapterNumber,
        chapterUrl: currentUrl,
      }),
    })

    console.debug('extension: update response status=', response.status)
    if (response.status === 401) {
      // Server requires auth — notify background so UI can prompt login
      console.warn('extension: server returned 401 Unauthorized')
      chrome.runtime.sendMessage({ type: 'UNAUTHORIZED' })
      return
    }

    const data = await response.json().catch((e) => {
      console.error('extension: failed to parse JSON from update response', e)
      return null
    })

    console.debug('extension: update response data=', data)
    console.debug('extension: redirect check', {
      hasUrl: !!data?.redirectUrl,
      autoRedirect,
      serverChapter: data?.serverChapter,
      currentChapter: chapterNumber,
      shouldRedirect: data?.redirectUrl && autoRedirect && data.serverChapter > chapterNumber
    })

    // 3. Check if redirect is needed
    if (data?.redirectUrl && autoRedirect && data.serverChapter > chapterNumber) {
      console.debug('extension: initiating redirect to', data.redirectUrl)
      // Notify background for redirect badge
      chrome.runtime.sendMessage({
        type: 'CHAPTER_REDIRECT',
        bookTitle: data?.book?.title || null,
        fromChapter: chapterNumber,
        toChapter: data.serverChapter,
      })

      // Show redirect bar with countdown
      showRedirectBar(data.book?.title, data.serverChapter, data.redirectUrl)
    } else {
      // Normal flow: just notify about update
      chrome.runtime.sendMessage({
        type: 'CHAPTER_UPDATED',
        updated: data?.updated || false,
        bookTitle: data?.book?.title || null,
        chapterNumber,
      })
    }
  } catch {
    // App not running or network error — notify background
    console.error('extension: network error while sending update')
    chrome.runtime.sendMessage({ type: 'APP_OFFLINE' })
  }

  function showRedirectBar(bookTitle, targetChapter, redirectUrl) {
    console.debug('extension: showRedirectBar called with', { bookTitle, targetChapter, redirectUrl })

    const bar = document.createElement('div')
    bar.id = 'novelapp-redirect-notification'
    let countdown = 5
    let timerInterval = null

    const updateCountdown = () => {
      const button = bar.querySelector('#novelapp-go-now')
      if (button) {
        button.textContent = `Go (${countdown}s)`
        console.debug('extension: countdown updated to', countdown)
      }
    }

    bar.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        left: 20px !important;
        right: auto !important;
        background: #3b82f6;
        color: white;
        padding: 24px;
        border-radius: 12px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        max-width: 350px;
        min-width: 300px;
      ">
        <div style="margin-bottom: 16px; font-size: 16px; line-height: 1.4;">
          <div style="font-weight: 700; margin-bottom: 6px; font-size: 18px;">Jump to Ch. ${targetChapter}</div>
          <div style="opacity: 0.95; font-size: 14px;">Redirecting in ${countdown}s...</div>
        </div>
        <div style="display: flex; gap: 10px;">
          <button id="novelapp-stay-here" style="
            flex: 1;
            padding: 12px 14px;
            background: rgba(255,255,255,0.15);
            color: white;
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background 0.2s;
          ">Stay</button>
          <button id="novelapp-go-now" style="
            flex: 1;
            padding: 12px 14px;
            background: rgba(255,255,255,0.3);
            color: white;
            border: 1px solid rgba(255,255,255,0.4);
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: background 0.2s;
          ">Go (3s)</button>
        </div>
      </div>
    `

    document.body.appendChild(bar)
    console.debug('extension: redirect notification inserted into DOM')

    const stayBtn = bar.querySelector('#novelapp-stay-here')
    const goBtn = bar.querySelector('#novelapp-go-now')

    stayBtn.addEventListener('click', () => {
      console.debug('extension: user clicked Stay Here')
      clearInterval(timerInterval)
      bar.remove()
    })

    goBtn.addEventListener('click', () => {
      console.debug('extension: user clicked Go Now, navigating to', redirectUrl)
      clearInterval(timerInterval)
      chrome.runtime.sendMessage({ type: 'NAVIGATE_TO_URL', url: redirectUrl })
    })

    timerInterval = setInterval(() => {
      countdown--
      updateCountdown()
      if (countdown <= 0) {
        console.debug('extension: countdown finished, redirecting to', redirectUrl)
        clearInterval(timerInterval)
        chrome.runtime.sendMessage({ type: 'NAVIGATE_TO_URL', url: redirectUrl })
      }
    }, 1000)
  }
})()
