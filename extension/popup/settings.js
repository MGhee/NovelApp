/**
 * NovelApp Extension Settings
 * Manages the server URL and authentication
 */

const appUrlInput = document.getElementById('app-url')
const saveBtn = document.getElementById('save-btn')
const resetBtn = document.getElementById('reset-btn')
const statusMessage = document.getElementById('status-message')
const autoRedirectInput = document.getElementById('auto-redirect')

const DEFAULT_APP_URL = 'https://novelapp.viktorbarzin.me'
const DEFAULT_AUTO_REDIRECT = true

// Load current settings on page open
async function loadSettings() {
  const { appUrl, autoRedirect, sessionToken, userEmail, userName, userPicture } =
    await chrome.storage.sync.get({
      appUrl: DEFAULT_APP_URL,
      autoRedirect: DEFAULT_AUTO_REDIRECT,
      sessionToken: '',
      userEmail: '',
      userName: '',
      userPicture: '',
    })

  appUrlInput.value = appUrl
  if (autoRedirectInput) autoRedirectInput.checked = autoRedirect

  // Show account state
  const signedInEl = document.getElementById('account-signed-in')
  const signedOutEl = document.getElementById('account-signed-out')

  if (sessionToken) {
    signedInEl.classList.remove('hidden')
    signedOutEl.classList.add('hidden')
    document.getElementById('settings-name').textContent = userName || 'User'
    document.getElementById('settings-email').textContent = userEmail
    const avatar = document.getElementById('settings-avatar')
    if (userPicture) {
      avatar.src = userPicture
    } else {
      avatar.style.display = 'none'
    }
  } else {
    signedInEl.classList.add('hidden')
    signedOutEl.classList.remove('hidden')
  }
}

// Save settings
saveBtn.addEventListener('click', async () => {
  const url = appUrlInput.value.trim()
  const autoRedirect = autoRedirectInput ? autoRedirectInput.checked : DEFAULT_AUTO_REDIRECT

  // Validate URL
  if (!url) {
    showStatus('Please enter a URL', 'error')
    return
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    showStatus('URL must start with http:// or https://', 'error')
    return
  }

  // Remove trailing slash for consistency
  const cleanUrl = url.replace(/\/$/, '')

  // Save to storage
  await chrome.storage.sync.set({ appUrl: cleanUrl, autoRedirect })
  appUrlInput.value = cleanUrl
  if (autoRedirectInput) autoRedirectInput.checked = autoRedirect

  showStatus('Settings saved successfully!', 'success')
})

// Reset to default
resetBtn.addEventListener('click', async () => {
  await chrome.storage.sync.remove(['appUrl', 'autoRedirect'])
  appUrlInput.value = DEFAULT_APP_URL
  if (autoRedirectInput) autoRedirectInput.checked = DEFAULT_AUTO_REDIRECT
  showStatus('Reset to default settings', 'success')
})

// Sign out
document.getElementById('sign-out-btn')?.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'SIGN_OUT' }, () => {
    loadSettings() // Refresh UI to show signed-out state
  })
})

// Show status message
function showStatus(message, type) {
  statusMessage.textContent = message
  statusMessage.className = `status-message status-${type}`

  // Auto-hide success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      statusMessage.className = 'status-message'
    }, 3000)
  }
}

// Load settings on page load
loadSettings()
