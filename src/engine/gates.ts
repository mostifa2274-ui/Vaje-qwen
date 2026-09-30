import { CHAPTERS, chaptersOfBook } from '../data/chapters'
import { bookTestQuestionCount, bookTestTextsPerSkill, bookTestWordCount } from './bookTestSize'
import { bookConsolidated } from './consolidation'
import type { GhesseState } from './types'
import { faNum } from './format'
import policy from '../data/learningPolicy.json'

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
        titleFa: `آزمون پایان کتاب ${faNum(book)}`,
        subtitleFa: `${faNum(bookTestWordCount(book))} واژهٔ نمونه از ${book === 1 ? 'کتاب ۱' : `کتاب‌های ۱ تا ${faNum(book)}`} (با وزن بیشتر برای کتاب تازه؛ ترجمه و شنیداری)، به‌علاوهٔ ${faNum(bookTestTextsPerSkill(book))} متن خواندنی و ${faNum(bookTestTextsPerSkill(book))} متن شنیداری تازه.`,
        // Bounded cumulative vocabulary sample plus comprehension texts
        // (engine/bookTestSize.ts); every section must reach the section floor.
        questionCount: bookTestQuestionCount(book),
        passRate: policy.bookTest.sectionPassRate,
        productivePassRate: policy.bookTest.sectionPassRate,
      }
    }
  }
  if (id === MIDPOINT_EXAM_ID) {
    return {
      id,
      kind: 'midpoint',
      titleFa: 'آزمون ویژهٔ نیمهٔ مسیر',
      subtitleFa: 'آزمون تجمعی کتاب‌های ۱ تا ۴: یادآوری نوشتاری، جای‌خالی و واژه‌های ضعیف، به‌علاوهٔ دو متن خواندنی و دو متن شنیداری، پیش از ورود به کتاب ۵.',
      // 56 word questions plus two reading and two listening texts.
      questionCount: policy.midpointExam.wordQuestions,
      passRate: policy.midpointExam.passRate,
      productivePassRate: policy.midpointExam.productivePassRate,
    }
  }
  if (id === FINAL_EXAM_ID) {
    return {
      id,
      kind: 'final',
      titleFa: 'آزمون نهایی ۸۹۹ واژه',
      subtitleFa: 'آزمون تجمعی کل مسیر: یادآوری نوشتاری همهٔ کتاب‌ها، به‌علاوهٔ چهار متن خواندنی و چهار متن شنیداری؛ نشان تسلط درون‌برنامه‌ای علاوه بر این آزمون به شواهد فاصله‌دار همهٔ واژه‌ها نیاز دارد.',
      // 88 word questions plus four reading and four listening texts.
      questionCount: policy.finalExam.wordQuestions,
      passRate: policy.finalExam.passRate,
      productivePassRate: policy.finalExam.productivePassRate,
    }
  }
  return undefined
}

export function chapterPrepared(state: GhesseState, chapterId: string): boolean {
  const progress = state.chapters[chapterId]
  const chapter = CHAPTERS.find(item => item.id === chapterId)
  if (!progress || !chapter) return false
  // Never relock a chapter the learner has already completed in an older app
  // version. For every unfinished chapter, however, imported/corrupted totals
  // must match the chapter's real assignment and both prep tests must be 100%.
  if (progress.completed) return true
  const required = chapter.new.length
  const writtenTotal = progress.prepWrittenTotal ?? 0
  const listeningTotal = progress.prepListeningTotal ?? 0
  const standardPreparation =
    writtenTotal === required
    && listeningTotal === required
    && progress.prepWrittenCorrect === required
    && progress.prepListeningCorrect === required
  const diagnosticPreparation =
    progress.prepDiagnosticPassed === true
    && progress.prepDiagnosticTotal === required
  return Boolean(
    progress.preparedAt
    && required > 0
    && (standardPreparation || diagnosticPreparation),
  )
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

  // Crossing a book boundary always requires the previous book's
  // end-of-book test.
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

// Explore mode (Settings) opens every chapter and test for looking around.
// These decide only what can be opened; the strict checks above still decide
// whether anything done there is recorded.
export function canOpenChapter(state: GhesseState, chapterId: string): boolean {
  if (state.exploreAll) return CHAPTERS.some(ch => ch.id === chapterId)
  return canPrepareChapter(state, chapterId)
}

export function canOpenStory(state: GhesseState, chapterId: string): boolean {
  if (state.exploreAll) return CHAPTERS.some(ch => ch.id === chapterId)
  return canReadChapter(state, chapterId)
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
  // Every word of the book must also have been recalled on a later day than
  // it was taught (see consolidation.ts).
  if (def.kind === 'book') {
    return bookCompleted(state, def.book!)
      && (!policy.bookConsolidation.everyWordRecalledOnALaterDay || bookConsolidated(state, def.book!))
  }
  if (def.kind === 'midpoint') return [1, 2, 3, 4].every(book => examCleared(state, bookExamId(book)))
  // The midpoint is an explicit cumulative gate before Book 5. A sparse or
  // imported state must not be able to bypass it merely by carrying later
  // end-of-book pass records.
  return examCleared(state, MIDPOINT_EXAM_ID)
    && [1, 2, 3, 4, 5, 6, 7, 8].every(book => examCleared(state, bookExamId(book)))
}

export function canTakeExam(state: GhesseState, id: string): boolean {
  return examPrerequisitesMet(state, id) && !examRemediationPending(state, id)
}

export function canOpenExam(state: GhesseState, id: string): boolean {
  if (state.exploreAll) return Boolean(examDefinition(id))
  return canTakeExam(state, id)
}

export function nextGateAfterBook(state: GhesseState, book: number): string | undefined {
  const bookId = bookExamId(book)
  if (!examCleared(state, bookId)) return bookId
  if (book === 4 && !examCleared(state, MIDPOINT_EXAM_ID)) return MIDPOINT_EXAM_ID
  if (book === 8 && !examCleared(state, FINAL_EXAM_ID)) return FINAL_EXAM_ID
  return undefined
}
