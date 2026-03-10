import { bookEmitter } from '@/lib/events'
import type { BookEvent } from '@/lib/types'

export async function GET() {
  const encoder = new TextEncoder()
  let listener: ((payload: BookEvent) => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      // Flush the connection immediately
      controller.enqueue(encoder.encode(': connected\n\n'))

      listener = (payload: BookEvent) => {
        controller.enqueue(
          encoder.encode(`event: book_updated\ndata: ${JSON.stringify(payload)}\n\n`)
        )
      }
      bookEmitter.on('book_updated', listener)
    },
    cancel() {
      if (listener) bookEmitter.off('book_updated', listener)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
