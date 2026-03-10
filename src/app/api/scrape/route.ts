import { NextRequest, NextResponse } from 'next/server'
import { scrapeBook } from '@/lib/scraper'

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 })

  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const result = await scrapeBook(url)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to scrape'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
