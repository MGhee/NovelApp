export type BookStatus = 'READING' | 'COMPLETED' | 'PLAN_TO_READ' | 'DROPPED'
export type BookType = 'WEB_NOVEL' | 'LIGHT_NOVEL' | 'MANGA' | 'MANHWA'

export interface BookSummary {
  id: number
  title: string
  author: string | null
  coverUrl: string | null
  status: BookStatus
  type: BookType
  currentChapter: number
  totalChapters: number
  siteUrl: string | null
  genre: string | null
  isFavorite: boolean
  yearRead: number | null
  updatedAt: string
}

export interface BookDetail extends BookSummary {
  description: string | null
  currentChapterUrl: string | null
  createdAt: string
  characters: Character[]
  customFields: CustomField[]
  chapters: ChapterItem[]
}

export interface Character {
  id: number
  name: string
  description: string | null
  role: string | null
}

export interface CustomField {
  id: number
  key: string
  value: string
}

export interface ChapterItem {
  id: number
  number: number
  title: string | null
  url: string
}

export interface BookEvent extends BookSummary {
  currentChapterUrl: string | null
}

export interface ScrapeResult {
  title: string
  author: string | null
  coverUrl: string | null
  description: string | null
  genre: string | null
  totalChapters: number
  chapters: Omit<ChapterItem, 'id'>[]
  detectedChapter?: number   // set when input URL was a chapter URL
  normalizedUrl?: string     // book index URL (differs from input if chapter URL was given)
}
