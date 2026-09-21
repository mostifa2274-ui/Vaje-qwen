import { CHAPTERS, chaptersOfBook } from '../data/chapters'
import type { GhesseState } from './types'

export type ExamKind = 'book' | 'midpoint' | 'final'

export interface ExamDefinition {
  id: string
  kind: ExamKind
  book?: number
  titleFa: string
  subtitleFa: string
  questionCount: number
  passRate: number
  productivePassRate: number
}

export function bookExamId(book: number): string {
  return `book-${book}`
}

export const MIDPOINT_EXAM_ID = 'midpoint-4'
export const FINAL_EXAM_ID = 'final-8'

export function examDefinition(id: string): ExamDefinition | undefined {
  const match = /^book-(\d)$/.exec(id)
  if (match) {
    const book = Number(match[1])
    if (book >= 1 && book <= 8) {
      return {
        id,
        kind: 'book',
        book,
        titleFa: `آزمون کتاب ${book}`,
        subtitleFa: 'آزمون ترکیبی همین کتاب با سهم بالا از یادآوری نوشتاری و پوشش واژه‌های ضعیف و واژه‌های کمتر آزموده‌شده.',
        questionCount: 32,
        passRate: 0.85,
        productivePassRate: 0.8,
      }
    }
  }
  if (id === MIDPOINT_EXAM_ID) {
    return {
      id,
      kind: 'midpoint',
      titleFa: 'آزمون ویژهٔ نیمهٔ مسیر',
      subtitleFa: 'آزمون تجمعی کتاب‌های ۱ تا ۴ با یادآوری نوشتاری، جای‌خالی و واژه‌های ضعیف پیش از ورود به کتاب ۵.',
      questionCount: 56,
      passRate: 0.88,
      productivePassRate: 0.85,
    }
  }
  if (id === FINAL_EXAM_ID) {
    return {
      id,
      kind: 'final',
      titleFa: 'آزمون نهایی ۸۹۹ واژه',
      subtitleFa: 'آزمون تجمعی کل مسیر با استاندارد سخت‌گیرانهٔ یادآوری نوشتاری؛ گواهی تسلط علاوه بر این آزمون به شواهد فاصله‌دار همهٔ واژه‌ها نیاز دارد.',
      questionCount: 88,
      passRate: 0.92,
      productivePassRate: 0.9,
    }
  }
  return undefined
}

export function chapterPrepared(state: GhesseState, chapterId: string): boolean {
  return Boolean(state.chapters[chapterId]?.preparedAt)
}

export function chapterCompleted(state: GhesseState, chapterId: string): boolean {
  return state.chapters[chapterId]?.completed === true
}

export function bookCompleted(state: GhesseState, book: number): boolean {
  const chapters = chaptersOfBook(book)
  return chapters.length > 0 && chapters.every(ch => chapterCompleted(state, ch.id))
}

export function examPassed(state: GhesseState, id: string): boolean {
  return state.exams[id]?.passed === true
}

export function previousChapterId(chapterId: string): string | undefined {
  const index = CHAPTERS.findIndex(ch => ch.id === chapterId)
  return index > 0 ? CHAPTERS[index - 1].id : undefined
}

export function canPrepareChapter(state: GhesseState, chapterId: string): boolean {
  const chapter = CHAPTERS.find(ch => ch.id === chapterId)
  if (!chapter) return false
  const index = CHAPTERS.findIndex(ch => ch.id === chapterId)
  if (index === 0) return true

  const previous = CHAPTERS[index - 1]
  // Corrupted/imported sparse state must not allow skipping earlier chapters.
  const earlierInBook = CHAPTERS.filter(ch => ch.book === chapter.book && ch.n < chapter.n)
  if (!earlierInBook.every(ch => chapterCompleted(state, ch.id))) return false

  // Crossing a book boundary always requires the previous book exam.
  if (previous.book !== chapter.book) {
    if (!examCleared(state, bookExamId(previous.book))) return false
    // Book 5 has an additional cumulative midpoint gate.
    if (chapter.book === 5 && !examCleared(state, MIDPOINT_EXAM_ID)) return false
  }
  return true
}

export function canReadChapter(state: GhesseState, chapterId: string): boolean {
  return canPrepareChapter(state, chapterId) && chapterPrepared(state, chapterId)
}

export function examRemediationWordIds(state: GhesseState): string[] {
  const unresolved = new Set<string>()
  for (const progress of Object.values(state.exams)) {
    // A passed exam can still contain missed words. Those gaps must remain
    // first-class remediation items until independently recalled after the
    // attempt; otherwise the gate is blocked without showing the learner why.
    if (!progress || progress.attempts === 0 || !progress.lastAttemptAt) continue
    for (const wordId of progress.missedWordIds) {
      const word = state.words[wordId]
      if (!word?.lastIndependentSuccessAt || word.lastIndependentSuccessAt <= progress.lastAttemptAt) unresolved.add(wordId)
    }
  }
  return [...unresolved]
}

export function examRemediationPending(state: GhesseState, id: string): boolean {
  const progress = state.exams[id]
  if (!progress || progress.attempts === 0 || progress.missedWordIds.length === 0 || !progress.lastAttemptAt) return false
  const lastAttemptAt = progress.lastAttemptAt
  return progress.missedWordIds.some(wordId => {
    const word = state.words[wordId]
    return !word?.lastIndependentSuccessAt || word.lastIndependentSuccessAt <= lastAttemptAt
  })
}

export function examCleared(state: GhesseState, id: string): boolean {
  return examPassed(state, id) && !examRemediationPending(state, id)
}

function examPrerequisitesMet(state: GhesseState, id: string): boolean {
  const def = examDefinition(id)
  if (!def) return false
  if (def.kind === 'book') return bookCompleted(state, def.book!)
  if (def.kind === 'midpoint') return [1, 2, 3, 4].every(book => examCleared(state, bookExamId(book)))
  return [1, 2, 3, 4, 5, 6, 7, 8].every(book => examCleared(state, bookExamId(book)))
}

export function canTakeExam(state: GhesseState, id: string): boolean {
  return examPrerequisitesMet(state, id) && !examRemediationPending(state, id)
}

export function nextGateAfterBook(state: GhesseState, book: number): string | undefined {
  const bookId = bookExamId(book)
  if (!examPassed(state, bookId)) return bookId
  if (book === 4 && !examPassed(state, MIDPOINT_EXAM_ID)) return MIDPOINT_EXAM_ID
  if (book === 8 && !examPassed(state, FINAL_EXAM_ID)) return FINAL_EXAM_ID
  return undefined
}
