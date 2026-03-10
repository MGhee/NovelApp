import { EventEmitter } from 'events'

const g = globalThis as unknown as { bookEmitter: EventEmitter }
export const bookEmitter = g.bookEmitter ?? new EventEmitter()
bookEmitter.setMaxListeners(50)
if (process.env.NODE_ENV !== 'production') g.bookEmitter = bookEmitter
