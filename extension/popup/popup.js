const APP_URL = 'http://localhost:3000'

const STATUS_LABELS = {
  READING: 'Reading',
  COMPLETED: 'Completed',
  PLAN_TO_READ: 'Plan to Read',
  DROPPED: 'Dropped',
}

function showState(id) {
  ['loading', 'matched', 'not-matched', 'app-offline', 'not-novel-site'].forEach((s) => {
    document.getElementById(s).classList.toggle('hidden', s !== id)
  })
}

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

async function init() {
  showState('loading')

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url) { showState('not-novel-site'); return }

  const url = tab.url
  const isNovelSite = /readnovelfull\.com|novelfull\.com|novelbin\.com|lightnovelworld\.com|mangadex\.org|webtoon\.com/.test(url)

  if (!isNovelSite) { showState('not-novel-site'); return }

  // Check if app is running and if this page matches a book
  try {
    const matchUrl = `${APP_URL}/api/extension/match?url=${encodeURIComponent(url)}`
    const res = await fetch(matchUrl, { signal: AbortSignal.timeout(3000) })
    const { match } = await res.json()

    if (match) {
      // Show book info
      const progress = match.totalChapters > 0
        ? Math.min((match.currentChapter / match.totalChapters) * 100, 100)
        : 0

      document.getElementById('book-title').textContent = match.title
      document.getElementById('book-progress').textContent = match.totalChapters > 0
        ? `Ch. ${match.currentChapter} / ${match.totalChapters}`
        : `Ch. ${match.currentChapter}`
      document.getElementById('progress-bar').style.width = `${progress}%`
      document.getElementById('book-status').textContent = STATUS_LABELS[match.status] || match.status

      const coverEl = document.getElementById('book-cover')
      if (match.coverUrl) {
        coverEl.src = match.coverUrl
        coverEl.onerror = () => { coverEl.style.display = 'none' }
      } else {
        coverEl.style.display = 'none'
      }

      document.getElementById('open-book-btn').onclick = () => {
        chrome.tabs.create({ url: `${APP_URL}/books/${match.id}` })
      }

      showState('matched')
    } else {
      // Book not in list — offer to add
      const bookBaseUrl = extractBookUrl(url) || url
      document.getElementById('add-book-btn').onclick = () => {
        chrome.tabs.create({ url: `${APP_URL}?add=${encodeURIComponent(bookBaseUrl)}` })
      }
      showState('not-matched')
    }
  } catch {
    showState('app-offline')
  }
}

init()
