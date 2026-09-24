import { describe, expect, it } from 'vitest'
import { CHAPTERS, lemmaMap } from './chapters'
import { BOOK_TEST_CONTENT, type TestText } from './bookTests'
import { tokenizeSentence } from '../engine/lemmatize'

const introducedIn = new Map<string, number>()
for (const chapter of CHAPTERS) for (const id of chapter.new) introducedIn.set(id, chapter.book)
const storySentences = new Set(CHAPTERS.flatMap(chapter => chapter.sentences.map(sentence => sentence.en.trim().toLowerCase())))

function textsOf(book: number): TestText[] {
  const content = BOOK_TEST_CONTENT.get(book)!
  return [...content.reading, ...content.listening]
}

/** Every English word must be taught in this book or earlier, or be a declared name. */
function vocabularyProblems(text: TestText, book: number): string[] {
  const problems: string[] = []
  const lines = [text.titleEn, ...text.sentences.map(sentence => sentence.en)]
  for (const line of lines) {
    for (const token of tokenizeSentence(line, lemmaMap)) {
      if (!token.isWord) continue
      if (text.names.includes(token.raw)) continue
      if (!token.id) {
        problems.push(`unknown "${token.raw}" in: ${line}`)
        continue
      }
      const taught = introducedIn.get(token.id)
      if (taught === undefined || taught > book) problems.push(`"${token.raw}" (${token.id}, book ${taught}) in: ${line}`)
    }
  }
  return problems
}

describe('end-of-book comprehension texts', () => {
  it('exist for all eight books with two reading and two listening variants', () => {
    for (let book = 1; book <= 8; book++) {
      const content = BOOK_TEST_CONTENT.get(book)
      expect(content, `book ${book}`).toBeDefined()
      expect(content!.reading).toHaveLength(2)
      expect(content!.listening).toHaveLength(2)
    }
  })

  for (let book = 1; book <= 8; book++) {
    it(`book ${book} texts use only vocabulary taught by book ${book}`, () => {
      if (!BOOK_TEST_CONTENT.has(book)) return
      const problems = textsOf(book).flatMap(text => vocabularyProblems(text, book).map(problem => `${text.id}: ${problem}`))
      expect(problems).toEqual([])
    })
  }

  it('are complete, new and well-formed', () => {
    const seenSentences = new Map<string, string>()
    const ids = new Set<string>()
    for (const content of BOOK_TEST_CONTENT.values()) {
      for (const text of [...content.reading, ...content.listening]) {
        expect(ids.has(text.id), `duplicate id ${text.id}`).toBe(false)
        ids.add(text.id)
        expect(text.titleFa).toMatch(/[؀-ۿ]/)
        expect(text.sentences.length, text.id).toBeGreaterThanOrEqual(8)
        expect(text.sentences.length, text.id).toBeLessThanOrEqual(18)
        for (const name of text.names) {
          expect(name, `${text.id} name`).toMatch(/^[A-Z][a-z]+$/)
          expect(tokenizeSentence(name, lemmaMap)[0].id, `${text.id}: "${name}" is a vocabulary word, not a name`).toBeUndefined()
        }
        for (const sentence of text.sentences) {
          const key = sentence.en.trim().toLowerCase()
          expect(sentence.fa, `${text.id}: ${sentence.en}`).toMatch(/[؀-ۿ]/)
          expect(/[.!?]["”]?$/.test(sentence.en.trim()), `${text.id}: unterminated "${sentence.en}"`).toBe(true)
          expect(storySentences.has(key), `${text.id} copies a chapter sentence: ${sentence.en}`).toBe(false)
          expect(seenSentences.get(key), `${text.id} repeats a sentence from ${seenSentences.get(key)}: ${sentence.en}`).toBeUndefined()
          seenSentences.set(key, text.id)
        }
        expect(text.questions, text.id).toHaveLength(5)
        const answers = new Set<number>()
        for (const question of text.questions) {
          expect(question.q, text.id).toMatch(/[؀-ۿ]/)
          expect(question.options, `${text.id}: ${question.q}`).toHaveLength(4)
          expect(new Set(question.options.map(option => option.trim())).size, `${text.id}: ${question.q}`).toBe(4)
          expect(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4, `${text.id}: ${question.q}`).toBe(true)
          answers.add(question.answer)
        }
        expect(new Set(text.questions.map(question => question.q)).size, text.id).toBe(5)
        expect(answers.size, `${text.id}: answers should not all sit in one position`).toBeGreaterThan(1)
      }
    }
  })

  it('draw on the newest book so each test feels different', () => {
    for (let book = 2; book <= 8; book++) {
      if (!BOOK_TEST_CONTENT.has(book)) continue
      for (const text of textsOf(book)) {
        const fresh = new Set<string>()
        for (const sentence of text.sentences) {
          for (const token of tokenizeSentence(sentence.en, lemmaMap)) {
            if (token.id && introducedIn.get(token.id) === book) fresh.add(token.id)
          }
        }
        expect(fresh.size, `${text.id} uses only ${fresh.size} words from book ${book}`).toBeGreaterThanOrEqual(5)
      }
    }
  })
})
