/**
 * NovelApp Tracker - Background Service Worker
 */

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'CHAPTER_UPDATED') {
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
  } else if (message.type === 'APP_OFFLINE') {
    chrome.action.setBadgeText({ text: '!' })
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' })
  } else if (message.type === 'UNAUTHORIZED') {
    // Red badge: server requires authentication
    chrome.action.setBadgeText({ text: '!' })
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' })
    // Let popup know that auth failed so it can show login UI
    chrome.storage.session.set({ authFailed: true })
  }
})

// Clear badge when tab changes
chrome.tabs.onActivated.addListener(() => {
  chrome.action.setBadgeText({ text: '' })
})
