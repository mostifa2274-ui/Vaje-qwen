// Chapter registry — eager-bundles all 40 chapter JSONs, builds the
// lemmatizer + containment index once at startup.

import type { Chapter, WordEntry, BookMeta } from '../engine/types'
import { buildLemmaMap, tokenizeSentence } from '../engine/lemmatize'
import { setContainment } from '../engine/mastery'
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
  { book: 1, titleFa: 'خانه', titleEn: 'Home', tint: '#e8d9c4', cover: publicAsset('art/book1.svg'), taglineFa: 'جایی که قصه آغاز می‌شود' },
  { book: 2, titleFa: 'شهر', titleEn: 'The City', tint: '#d4ddd2', cover: publicAsset('art/book2.svg'), taglineFa: 'جست‌وجو میان خیابان‌ها' },
  { book: 3, titleFa: 'روزها', titleEn: 'The Days', tint: '#e5dccb', cover: publicAsset('art/book3.svg'), taglineFa: 'روزها می‌گذرند' },
  { book: 4, titleFa: 'بازار', titleEn: 'The Market', tint: '#ead7c8', cover: publicAsset('art/book4.svg'), taglineFa: 'هزار گربه، هیچ‌کدام نینو' },
  { book: 5, titleFa: 'حرف‌ها', titleEn: 'Words', tint: '#e0d5c5', cover: publicAsset('art/book5.svg'), taglineFa: 'یادداشت‌ها و زنگ‌ها' },
  { book: 6, titleFa: 'مدرسه', titleEn: 'School', tint: '#d8dede', cover: publicAsset('art/book6.svg'), taglineFa: 'امید و وارونه' },
  { book: 7, titleFa: 'راه و ساحل', titleEn: 'Road & Shore', tint: '#d9dfd5', cover: publicAsset('art/book7.svg'), taglineFa: 'سفر تا لبه‌ی دریا' },
  { book: 8, titleFa: 'کوه و ستاره‌ها', titleEn: 'Mountain & Stars', tint: '#d5d4e0', cover: publicAsset('art/book8.svg'), taglineFa: 'بازگشت زیر ستاره‌ها' },
]

export const lemmaMap = buildLemmaMap(VOCAB)

// Containment: explicitly introduced words plus resolved story-word senses.
const c = new Map<string, Set<string>>()
for (const ch of CHAPTERS) {
  const ids = new Set<string>(ch.new)
  for (const s of ch.sentences) {
    for (const tok of tokenizeSentence(s.en, lemmaMap)) {
      if (tok.isWord && tok.id) ids.add(tok.id)
    }
  }
  c.set(ch.id, ids)
}
setContainment(c)

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

// Introduced word ids up to and including chapter k
export function introducedThrough(chapterId: string): Set<string> {
  const idx = chapterIndex(chapterId)
  const out = new Set<string>()
  for (let i = 0; i <= idx && i < CHAPTERS.length; i++) {
    for (const id of CHAPTERS[i].new) out.add(id)
  }
  return out
}
