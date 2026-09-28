import { CHAPTERS } from '../data/chapters'

// How big an end-of-book test is. It grows with everything studied so far:
// half of every book's words are asked (split between typed translation and
// listening), and the number of reading and listening texts grows with the
// books too.

export const BOOK_TEST_WORD_SHARE = 0.5
export const BOOK_TEST_QUESTIONS_PER_TEXT = 5

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

/** How many of one book's words an end-of-book test asks. */
export function bookTestWordsFrom(source: number): number {
  return Math.round(bookWordIds(source).length * BOOK_TEST_WORD_SHARE)
}

/** Words asked by the test after `book`: half of books 1..book. */
export function bookTestWordCount(book: number): number {
  let total = 0
  for (let source = 1; source <= book; source++) total += bookTestWordsFrom(source)
  return total
}

/** Reading texts, and as many listening texts, in one attempt: 1 for books 1–2, 2 for 3–4, 3 for 5–6, 4 for 7–8. */
export function bookTestTextsPerSkill(book: number): number {
  return Math.ceil(book / 2)
}

export function bookTestQuestionCount(book: number): number {
  return bookTestWordCount(book) + 2 * bookTestTextsPerSkill(book) * BOOK_TEST_QUESTIONS_PER_TEXT
}
