import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/getUserId'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

function isConnReset(err: unknown) {
  if (!(err instanceof Error)) return false
  const errorWithCode = err as Error & { code?: string }
  return errorWithCode.code === 'ECONNRESET' || /aborted/i.test(err.message)
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rawUrl = req.nextUrl.searchParams.get('url')
    if (!rawUrl) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

    let imageUrl: URL
    try {
      imageUrl = new URL(rawUrl)
    } catch {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
    }

    if (!['http:', 'https:'].includes(imageUrl.protocol)) {
      return NextResponse.json({ error: 'Unsupported protocol' }, { status: 400 })
    }

    const upstream = await fetch(imageUrl.toString(), {
      headers: {
        'User-Agent': UA,
        Referer: imageUrl.origin,
      },
      cache: 'force-cache',
    })

    if (!upstream.ok) {
      return NextResponse.json({ error: 'Upstream image fetch failed' }, { status: 502 })
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Upstream response was not an image' }, { status: 415 })
    }

    const buffer = await upstream.arrayBuffer()
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err: unknown) {
    if (isConnReset(err)) {
      return NextResponse.json({ error: 'Request aborted' }, { status: 499 })
    }

    console.error('Error in /api/cover', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}