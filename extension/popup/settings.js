/**
 * NovelApp Extension Settings
 * Manages the server URL configuration
 */

const appUrlInput = document.getElementById('app-url')
const saveBtn = document.getElementById('save-btn')
const resetBtn = document.getElementById('reset-btn')
const statusMessage = document.getElementById('status-message')
const autoRedirectInput = document.getElementById('auto-redirect')

const DEFAULT_APP_URL = 'https://novelapp.viktorbarzin.me'
const DEFAULT_API_KEY = ''
const DEFAULT_AUTO_REDIRECT = true

const apiKeyInput = document.getElementById('api-key')

// Load current settings on page open
async function loadSettings() {
  const { appUrl, apiKey, autoRedirect } = await chrome.storage.sync.get({
    appUrl: DEFAULT_APP_URL,
    apiKey: DEFAULT_API_KEY,
    autoRedirect: DEFAULT_AUTO_REDIRECT,
  })
  appUrlInput.value = appUrl
  if (apiKeyInput) apiKeyInput.value = apiKey || ''
  if (autoRedirectInput) autoRedirectInput.checked = autoRedirect
}

// Save settings
saveBtn.addEventListener('click', async () => {
  const url = appUrlInput.value.trim()
  const apiKey = apiKeyInput ? apiKeyInput.value.trim() : ''
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
  await chrome.storage.sync.set({ appUrl: cleanUrl, apiKey, autoRedirect })
  appUrlInput.value = cleanUrl
  if (apiKeyInput) apiKeyInput.value = apiKey
  if (autoRedirectInput) autoRedirectInput.checked = autoRedirect

  showStatus('Settings saved successfully!', 'success')
})

// Reset to default
resetBtn.addEventListener('click', async () => {
  await chrome.storage.sync.remove(['appUrl', 'apiKey', 'autoRedirect'])
  appUrlInput.value = DEFAULT_APP_URL
  if (apiKeyInput) apiKeyInput.value = DEFAULT_API_KEY
  if (autoRedirectInput) autoRedirectInput.checked = DEFAULT_AUTO_REDIRECT
  showStatus('Reset to default settings', 'success')
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
