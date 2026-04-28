const STATUS_LABELS = {
  READING: 'Reading',
  COMPLETED: 'Completed',
  PLAN_TO_READ: 'Plan to Read',
  DROPPED: 'Waiting',
}

const DEFAULT_APP_URL = 'https://novelapp.viktorbarzin.me'

function showState(id) {
  ['loading', 'matched', 'not-matched', 'app-offline', 'not-novel-site', 'auth-required'].forEach((s) => {
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

function setupSignInButton() {
  const btn = document.getElementById('google-sign-in-btn')
  const errorEl = document.getElementById('sign-in-error')
  const loadingEl = document.getElementById('sign-in-loading')

  btn.addEventListener('click', async () => {
    btn.disabled = true
    btn.classList.add('hidden')
    loadingEl.classList.remove('hidden')
    errorEl.classList.add('hidden')

    chrome.runtime.sendMessage({ type: 'GOOGLE_SIGN_IN' }, (response) => {
      if (response?.success) {
        // Re-run init to show the authenticated UI
        init()
      } else {
        btn.disabled = false
        btn.classList.remove('hidden')
        loadingEl.classList.add('hidden')
        errorEl.textContent = response?.error || 'Sign-in failed'
        errorEl.classList.remove('hidden')
      }
    })
  })
}

async function init() {
  showState('loading')

  // Load configured app URL and auth state from storage
  const { appUrl, sessionToken, userEmail, userName, userPicture, autoRedirect } =
    await chrome.storage.sync.get({
      appUrl: DEFAULT_APP_URL,
      sessionToken: '',
      userEmail: '',
      userName: '',
      userPicture: '',
      autoRedirect: true,
    })

  const { authFailed } = await chrome.storage.session.get({ authFailed: false })

  // Auth gate: if no session token or auth failed, show sign-in
  if (!sessionToken || authFailed) {
    showState('auth-required')
    setupSignInButton()
    return
  }

  // Show user info in header
  if (userEmail) {
    const userInfo = document.getElementById('user-info')
    const avatar = document.getElementById('user-avatar')
    if (userPicture) {
      avatar.src = userPicture
      avatar.title = userEmail
    }
    userInfo.classList.remove('hidden')
  }

  const APP_URL = appUrl

  // Set dynamic links
  document.querySelector('[data-href="open-app"]').href = APP_URL
  document.querySelector('[data-href="offline-link"]').href = APP_URL

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url) { showState('not-novel-site'); return }

  const url = tab.url
  const trackedHosts = (chrome.runtime.getManifest().content_scripts?.[0]?.matches || [])
    .map((p) => { try { return new URL(p.replace('*', 'x')).hostname } catch { return null } })
    .filter(Boolean)
  let tabHost = ''
  try { tabHost = new URL(url).hostname } catch { /* not a real URL */ }
  const isTrackedSite = tabHost && trackedHosts.some((h) => tabHost === h || tabHost === `www.${h}` || `www.${tabHost}` === h)

  if (!isTrackedSite) { showState('not-novel-site'); return }

  // Check if app is running and if this page matches a book
  try {
    const matchUrl = `${APP_URL}/api/extension/match?url=${encodeURIComponent(url)}`
    const headers = { 'Authorization': `Bearer ${sessionToken}` }
    const res = await fetch(matchUrl, { signal: AbortSignal.timeout(3000), headers })

    if (res.status === 401) {
      // Token expired or invalid — clear and show sign-in
      await chrome.storage.sync.remove(['sessionToken', 'userEmail', 'userName', 'userPicture'])
      showState('auth-required')
      setupSignInButton()
      return
    }

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
