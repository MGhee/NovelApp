/**
 * NovelApp Tracker - Background Service Worker
 */

const DEFAULT_APP_URL = 'https://novelapp.viktorbarzin.me'
const GOOGLE_CLIENT_ID = '982186971214-01mnife8l7tauss1seu1olv3vap99pab.apps.googleusercontent.com'

function generateNonce() {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

async function startGoogleSignIn() {
  const nonce = generateNonce()
  const redirectUrl = chrome.identity.getRedirectURL()

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
  authUrl.searchParams.set('response_type', 'id_token')
  authUrl.searchParams.set('redirect_uri', redirectUrl)
  authUrl.searchParams.set('scope', 'openid email profile')
  authUrl.searchParams.set('nonce', nonce)
  authUrl.searchParams.set('prompt', 'select_account')

  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true,
  })

  // Extract id_token from the URL fragment
  const url = new URL(responseUrl)
  const fragment = new URLSearchParams(url.hash.substring(1))
  const idToken = fragment.get('id_token')

  if (!idToken) {
    throw new Error('No ID token in response')
  }

  return idToken
}

async function exchangeIdToken(idToken) {
  const { appUrl } = await chrome.storage.sync.get({ appUrl: DEFAULT_APP_URL })

  const response = await fetch(`${appUrl}/api/auth/google-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    if (response.status === 403) {
      throw new Error('Your Google account is not authorized for this server')
    }
    throw new Error(error.error || `Server error: ${response.status}`)
  }

  return response.json()
}

async function storeAuthResult(result) {
  await chrome.storage.sync.set({
    sessionToken: result.sessionToken,
    userEmail: result.email,
    userName: result.name || '',
    userPicture: result.picture || '',
  })
  // Clean up legacy apiKey if present
  await chrome.storage.sync.remove(['apiKey'])
  // Clear any previous auth failure state
  await chrome.storage.session.set({ authFailed: false })
  // Clear the red badge if it was showing
  chrome.action.setBadgeText({ text: '' })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'NAVIGATE_TO_URL') {
    // Navigate the tab that sent this message to the given URL
    if (sender.tab && sender.tab.id) {
      chrome.tabs.update(sender.tab.id, { url: message.url })
    }
  } else if (message.type === 'GOOGLE_SIGN_IN') {
    // Must return true for async sendResponse
    ;(async () => {
      try {
        const idToken = await startGoogleSignIn()
        const result = await exchangeIdToken(idToken)
        await storeAuthResult(result)
        sendResponse({ success: true, email: result.email })
      } catch (error) {
        sendResponse({ success: false, error: error.message })
      }
    })()
    return true // Keep message channel open for async response
  } else if (message.type === 'SIGN_OUT') {
    chrome.storage.sync.remove(['sessionToken', 'userEmail', 'userName', 'userPicture'])
    chrome.storage.session.set({ authFailed: false })
    chrome.action.setBadgeText({ text: '' })
    sendResponse({ success: true })
    return true
  } else if (message.type === 'CHAPTER_UPDATED') {
    if (message.updated) {
      // Green badge: chapter was updated
      chrome.action.setBadgeText({ text: '✓' })
      chrome.action.setBadgeBackgroundColor({ color: '#22c55e' })
      // Store last tracked info for popup
      chrome.storage.session.set({
        lastTracked: {
          bookTitle: message.bookTitle,
          chapterNumber: message.chapterNumber,
          timestamp: Date.now(),
        },
        authFailed: false,
      })
    } else {
      // Gray badge: book found but chapter unchanged (already tracked)
      chrome.action.setBadgeText({ text: '·' })
      chrome.action.setBadgeBackgroundColor({ color: '#555' })
      chrome.storage.session.set({ authFailed: false })
    }
  } else if (message.type === 'CHAPTER_REDIRECT') {
    // Blue badge with arrow: redirecting to latest chapter
    chrome.action.setBadgeText({ text: '→' })
    chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' })
    chrome.storage.session.set({
      lastTracked: {
        bookTitle: message.bookTitle,
        fromChapter: message.fromChapter,
        toChapter: message.toChapter,
        redirected: true,
        timestamp: Date.now(),
      },
      authFailed: false,
    })
  } else if (message.type === 'APP_OFFLINE') {
    chrome.action.setBadgeText({ text: '!' })
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' })
  } else if (message.type === 'UNAUTHORIZED') {
    // Red badge: server requires authentication
    chrome.action.setBadgeText({ text: '!' })
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' })
    // Clear the expired/invalid token
    chrome.storage.sync.remove(['sessionToken', 'userEmail', 'userName', 'userPicture'])
    // Let popup know that auth failed so it can show login UI
    chrome.storage.session.set({ authFailed: true })
  }
})

// Clear badge when tab changes
chrome.tabs.onActivated.addListener(() => {
  chrome.action.setBadgeText({ text: '' })
})
