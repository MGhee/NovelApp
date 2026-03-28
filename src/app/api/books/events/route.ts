import { bookEmitter } from '@/lib/events'
import type { BookEvent } from '@/lib/types'
import { NextRequest } from 'next/server'
import { getUserId } from '@/lib/getUserId'

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const encoder = new TextEncoder()
  let listeners: { [key: string]: (payload: any) => void } = {}

  const stream = new ReadableStream({
    start(controller) {
      // Flush the connection immediately
      controller.enqueue(encoder.encode(': connected\n\n'))

      // Subscribe to all book events for this user
      const eventTypes = ['book_updated', 'book_created', 'book_deleted']

      eventTypes.forEach((eventType) => {
        const eventKey = `${eventType}:${userId}`
        const listener = (payload: BookEvent) => {
          controller.enqueue(
            encoder.encode(`event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`)
          )
        }
        listeners[eventKey] = listener
        bookEmitter.on(eventKey, listener)
      })
    },
    cancel() {
      // Remove all listeners
      Object.entries(listeners).forEach(([eventKey, listener]) => {
        bookEmitter.off(eventKey, listener)
      })
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
