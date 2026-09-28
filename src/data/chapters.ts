// Chapter registry — eager-bundles all 40 chapter JSONs and builds the
// story-word lemmatizer once at startup.

import type { Chapter, WordEntry, BookMeta } from '../engine/types'
import { buildLemmaMap } from '../engine/lemmatize'
import vocabularyJson from './vocabulary.json'

export const VOCAB: WordEntry[] = vocabularyJson as WordEntry[]
export const WORD_BY_ID: Map<string, WordEntry> = new Map(VOCAB.map(w => [w.id, w]))

const modules = import.meta.glob('./chapters/*.json', { eager: true })
export const CHAPTERS: Chapter[] = Object.values(modules)
  .map(m => (m as { default: Chapter }).default)
  .sort((a, b) => a.book - b.book || a.n - b.n)

export const CHAPTER_BY_ID: Map<string, Chapter> = new Map(CHAPTERS.map(c => [c.id, c]))

function publicAsset(path: string): string {
  const clean = path.startsWith('/') ? path.slice(1) : path
  return `${import.meta.env.BASE_URL}${clean}`
}

export const BOOKS: BookMeta[] = [
  { book: 1, titleFa: 'خانه', titleEn: 'Home', cover: publicAsset('art/chapters/b1c1.avif'), taglineFa: 'جایی که قصه آغاز می‌شود' },
  { book: 2, titleFa: 'شهر', titleEn: 'The City', cover: publicAsset('art/chapters/b2c1.webp'), taglineFa: 'جست‌وجو میان خیابان‌ها' },
  { book: 3, titleFa: 'روزها', titleEn: 'The Days', cover: publicAsset('art/chapters/b3c1.webp'), taglineFa: 'روزها می‌گذرند' },
  { book: 4, titleFa: 'بازار', titleEn: 'The Market', cover: publicAsset('art/chapters/b4c1.webp'), taglineFa: 'هزار سرنخ، هنوز بی‌نینو' },
  { book: 5, titleFa: 'حرف‌ها', titleEn: 'Words', cover: publicAsset('art/chapters/b5c1.webp'), taglineFa: 'یادداشت‌ها و زنگ‌ها' },
  { book: 6, titleFa: 'مدرسه', titleEn: 'School', cover: publicAsset('art/chapters/b6c1.webp'), taglineFa: 'امید و وارونه' },
  { book: 7, titleFa: 'راه و ساحل', titleEn: 'Road & Shore', cover: publicAsset('art/chapters/b7c1.webp'), taglineFa: 'سفر تا لبه‌ی دریا' },
  { book: 8, titleFa: 'کوه و ستاره‌ها', titleEn: 'Mountain & Stars', cover: publicAsset('art/chapters/b8c1.webp'), taglineFa: 'بازگشت زیر ستاره‌ها' },
]

export const lemmaMap = buildLemmaMap(VOCAB)

// Chapter order helpers
export function chapterIndex(id: string): number {
  return CHAPTERS.findIndex(ch => ch.id === id)
}

export function nextChapter(id: string): Chapter | undefined {
  return CHAPTERS[chapterIndex(id) + 1]
}

export function chaptersOfBook(book: number): Chapter[] {
  return CHAPTERS.filter(ch => ch.book === book)
}
