import { CHAPTERS } from '../data/chapters'
import policy from '../data/learningPolicy.json'

// End-of-book tests are cumulative but deliberately bounded. The gate samples
// enough vocabulary to expose weak areas without turning one checkpoint into a
// second course. The newest book gets double weight; older books stay
// represented so retention is still cumulative.
//
// Vocabulary questions per attempt: 24, 28, 32, 36, 40, 44, 48, 52.
// Reading/listening passages still grow from one per skill to four per skill.

export const BOOK_TEST_MIN_WORDS = policy.bookTest.minVocabularyQuestions
export const BOOK_TEST_WORD_STEP = policy.bookTest.vocabularyQuestionStep
export const BOOK_TEST_MAX_WORDS = policy.bookTest.maxVocabularyQuestions
export const BOOK_TEST_QUESTIONS_PER_TEXT = policy.bookTest.questionsPerText

const wordsByBook = new Map<number, string[]>()
for (const chapter of CHAPTERS) {
  const ids = wordsByBook.get(chapter.book) ?? []
  for (const id of chapter.new) if (!ids.includes(id)) ids.push(id)
  wordsByBook.set(chapter.book, ids)
}

/** Words taught in one book, in teaching order. */
export function bookWordIds(book: number): string[] {
  return wordsByBook.get(book) ?? []
}

/** Total vocabulary items in one end-of-book attempt. */
export function bookTestWordCount(book: number): number {
  if (!Number.isInteger(book) || book < 1 || book > 8) return 0
  return Math.min(BOOK_TEST_MAX_WORDS, BOOK_TEST_MIN_WORDS + (book - 1) * BOOK_TEST_WORD_STEP)
}

/**
 * Allocate one bounded test across all books studied so far.
 * Each older book receives one weight unit and the newest receives two.
 * Remainders are assigned newest-first, keeping every source represented.
 */
export function bookTestWordsBySource(book: number): Map<number, number> {
  const result = new Map<number, number>()
  const total = bookTestWordCount(book)
  if (!total) return result

  const newestWeight = policy.bookTest.newestBookWeight
  const olderWeight = policy.bookTest.olderBookWeight
  const weightUnits = (book - 1) * olderWeight + newestWeight
  const unit = Math.floor(total / weightUnits)
  for (let source = 1; source <= book; source++) {
    result.set(source, source === book ? unit * newestWeight : unit * olderWeight)
  }

  let remaining = total - unit * weightUnits
  let source = book
  while (remaining > 0) {
    result.set(source, (result.get(source) ?? 0) + 1)
    remaining--
    source--
    if (source < 1) source = book
  }
  return result
}

/** Number of vocabulary items contributed by one studied book. */
export function bookTestWordsFrom(source: number, book: number): number {
  if (source < 1 || source > book) return 0
  return bookTestWordsBySource(book).get(source) ?? 0
}

/** Reading texts, and as many listening texts, in one attempt: 1 for books 1–2, 2 for 3–4, 3 for 5–6, 4 for 7–8. */
export function bookTestTextsPerSkill(book: number): number {
  return Math.ceil(book / 2)
}

export function bookTestQuestionCount(book: number): number {
  return bookTestWordCount(book) + 2 * bookTestTextsPerSkill(book) * BOOK_TEST_QUESTIONS_PER_TEXT
}
