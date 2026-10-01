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

function chaptersThroughBookCompleted(state: GhesseState, book: number): boolean {
  const chapters = CHAPTERS.filter(chapter => chapter.book <= book)
  return chapters.length > 0 && chapters.every(chapter => chapterCompleted(state, chapter.id))
}

export function courseChaptersCompleted(state: GhesseState): boolean {
  return CHAPTERS.length > 0 && CHAPTERS.every(chapter => chapterCompleted(state, chapter.id))
}

export function examPassed(state: GhesseState, id: string): boolean {
  const progress = state.exams[id]
  return Boolean(progress && progress.attempts > 0 && progress.passed === true)
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

  // Corrupted/imported sparse state must never use a later chapter or exam
  // record as a substitute for the actual earlier course path.
  if (!CHAPTERS.slice(0, index).every(ch => chapterCompleted(state, ch.id))) return false

  // Every chapter in a later book depends on the whole milestone chain, not
  // merely the immediately preceding exam record. This keeps sparse imports
  // from manufacturing a path through book 3+ or around the midpoint gate.
  const priorBooks = Array.from({ length: Math.max(0, chapter.book - 1) }, (_, offset) => offset + 1)
  if (!priorBooks.every(book => examCleared(state, bookExamId(book)))) return false
  if (chapter.book >= 5 && !examCleared(state, MIDPOINT_EXAM_ID)) return false
  return true
}

export function canReadChapter(state: GhesseState, chapterId: string): boolean {
  // Completion is historical evidence and must keep its story rereadable even
  // if a later retake creates remediation on an older milestone. That does not
  // unlock any unfinished successor; canPrepareChapter remains strict.
  if (chapterCompleted(state, chapterId)) return CHAPTERS.some(ch => ch.id === chapterId)
  return canPrepareChapter(state, chapterId) && chapterPrepared(state, chapterId)
}

// Explore mode (Settings) opens every chapter and test for looking around.
// These decide only what can be opened; the strict checks above still decide
// whether anything done there is recorded.
export function canOpenChapter(state: GhesseState, chapterId: string): boolean {
  if (state.exploreAll) return CHAPTERS.some(ch => ch.id === chapterId)
  return chapterCompleted(state, chapterId) || canPrepareChapter(state, chapterId)
}

export function canOpenStory(state: GhesseState, chapterId: string): boolean {
  if (state.exploreAll) return CHAPTERS.some(ch => ch.id === chapterId)
  return canReadChapter(state, chapterId)
}

/** Prefer real attempt time; the import floor is only a conservative fallback. */
function remediationFloor(progress: GhesseState['exams'][string]): number | undefined {
  return progress.lastAttemptAt ?? progress.remediationAfter
}

export function examRemediationWordIds(state: GhesseState): string[] {
  const unresolved = new Set<string>()
  for (const progress of Object.values(state.exams)) {
    // A passed exam can still contain missed words. Those gaps must remain
    // first-class remediation items until independently recalled after the
    // attempt. If an imported timestamp was unusable, normalization supplies
    // a separate conservative remediation floor instead of inventing an
    // attempt time.
    if (!progress || progress.attempts === 0 || progress.missedWordIds.length === 0) continue
    const floor = remediationFloor(progress)
    for (const wordId of progress.missedWordIds) {
      const word = state.words[wordId]
      if (!floor || !word?.lastIndependentSuccessAt || word.lastIndependentSuccessAt <= floor) unresolved.add(wordId)
    }
  }
  return [...unresolved]
}

export function examRemediationPending(state: GhesseState, id: string): boolean {
  const progress = state.exams[id]
  if (!progress || progress.attempts === 0 || progress.missedWordIds.length === 0) return false
  const floor = remediationFloor(progress)
  // A direct/corrupted in-memory record without either timestamp still fails
  // closed. Normalized imports get remediationAfter, so a fresh independent
  // recall can resolve them without permanent lockout.
  if (!floor) return true
  return progress.missedWordIds.some(wordId => {
    const word = state.words[wordId]
    return !word?.lastIndependentSuccessAt || word.lastIndependentSuccessAt <= floor
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
    const book = def.book!
    const previousBookExamsCleared = Array.from(
      { length: Math.max(0, book - 1) },
      (_, index) => index + 1,
    ).every(previousBook => examCleared(state, bookExamId(previousBook)))
    const midpointCleared = book < 5 || examCleared(state, MIDPOINT_EXAM_ID)
    return chaptersThroughBookCompleted(state, book)
      && previousBookExamsCleared
      && midpointCleared
      && (!policy.bookConsolidation.everyWordRecalledOnALaterDay || bookConsolidated(state, book))
  }
  if (def.kind === 'midpoint') {
    return chaptersThroughBookCompleted(state, 4)
      && [1, 2, 3, 4].every(book => examCleared(state, bookExamId(book)))
  }
  // Cumulative pass records are evidence only after the underlying path exists.
  // Sparse/imported state must not be able to reconstruct a completed course
  // from exam records while chapters themselves are missing.
  return courseChaptersCompleted(state)
    && examCleared(state, MIDPOINT_EXAM_ID)
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
