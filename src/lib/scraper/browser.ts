import { connect, devices } from 'puppeteer-real-browser'
import type { Browser, Page } from 'puppeteer'

let browserInstance: Browser | null = null
let browserPromise: Promise<Browser> | null = null

async function getBrowser(): Promise<Browser> {
  if (process.env.DISABLE_BROWSER_SCRAPING === 'true') {
    throw new Error('Browser-based scraping is disabled in this environment (e.g., headless server). Protected sites cannot be scraped. Try adding the book manually or scraping from a local development environment.')
  }

  if (browserInstance) return browserInstance
  if (browserPromise) return browserPromise

  browserPromise = (async () => {
    const result = await connect({
      headless: false, // Real browser required for strict Cloudflare
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    })

    // puppeteer-real-browser returns { browser, page }
    const browser = 'browser' in result ? result.browser : (result as any)

    return browser
  })()

  browserInstance = await browserPromise
  browserPromise = null

  return browserInstance
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    try {
      await browserInstance.close()
    } catch (e) {
      // Browser may already be closed
    }
  }
  browserInstance = null
  browserPromise = null
}

export async function fetchWithBrowser(
  url: string,
  options?: {
    waitSelector?: string
    timeout?: number
  }
): Promise<string> {
  const browser = await getBrowser()
  const page = await browser.newPage()

  try {
    await page.setViewport({ width: 1366, height: 768 })

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: options?.timeout ?? 60000,
    })

    // puppeteer-real-browser automatically handles Cloudflare challenges
    // Additional wait for strict CF sites
    const maxWait = 30000
    const startTime = Date.now()

    while (Date.now() - startTime < maxWait) {
      try {
        const title = await page.title()
        if (!title.includes('Just a moment')) break
      } catch {
        await new Promise(r => setTimeout(r, 1000))
        continue
      }
      await new Promise(r => setTimeout(r, 1000))
    }

    if (options?.waitSelector) {
      await page.waitForSelector(options.waitSelector, { timeout: 15000 }).catch(() => {
        // Selector not found, continue anyway
      })
    }

    return await page.content()
  } finally {
    await page.close()
  }
}

export async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  await page.setViewport({ width: 1366, height: 768 })

  try {
    return await fn(page)
  } finally {
    await page.close()
  }
}
