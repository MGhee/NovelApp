/**
 * NovelApp Tracker - Background Service Worker
 */

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'NAVIGATE_TO_URL') {
    // Navigate the tab that sent this message to the given URL
    if (sender.tab && sender.tab.id) {
      chrome.tabs.update(sender.tab.id, { url: message.url })
    }
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
    // Let popup know that auth failed so it can show login UI
    chrome.storage.session.set({ authFailed: true })
  }
})

// Clear badge when tab changes
chrome.tabs.onActivated.addListener(() => {
  chrome.action.setBadgeText({ text: '' })
})
