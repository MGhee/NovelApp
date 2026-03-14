/**
 * NovelApp Extension Settings
 * Manages the server URL configuration
 */

const appUrlInput = document.getElementById('app-url')
const saveBtn = document.getElementById('save-btn')
const resetBtn = document.getElementById('reset-btn')
const statusMessage = document.getElementById('status-message')

const DEFAULT_APP_URL = 'http://localhost:3000'

// Load current settings on page open
async function loadSettings() {
  const { appUrl } = await chrome.storage.sync.get({ appUrl: DEFAULT_APP_URL })
  appUrlInput.value = appUrl
}

// Save settings
saveBtn.addEventListener('click', async () => {
  const url = appUrlInput.value.trim()

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
  await chrome.storage.sync.set({ appUrl: cleanUrl })
  appUrlInput.value = cleanUrl

  showStatus('Settings saved successfully!', 'success')
})

// Reset to default
resetBtn.addEventListener('click', async () => {
  await chrome.storage.sync.remove('appUrl')
  appUrlInput.value = DEFAULT_APP_URL
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
