import type { BookStatus } from '@/lib/types'

export function getCurrentYear(): number {
  return new Date().getFullYear()
}

export function resolveYearReadForStatus(params: {
  status: BookStatus
  incomingYearRead?: number | null
  existingYearRead?: number | null
  currentYear?: number
}): number | null {
  const {
    status,
    incomingYearRead,
    existingYearRead,
    currentYear = getCurrentYear(),
  } = params

  if (status !== 'COMPLETED') return null

  if (typeof incomingYearRead === 'number') return incomingYearRead
  if (typeof existingYearRead === 'number') return existingYearRead
  return currentYear
}