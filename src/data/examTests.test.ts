import { describe, expect, it } from 'vitest'
import { CHAPTERS, lemmaMap } from './chapters'
import { BOOK_TEST_CONTENT } from './bookTests'
import { CHAPTER_LISTENING } from './chapterListening'
import { EXAM_TEST_CONTENT, EXAM_TEXTS_PER_ATTEMPT, examTextsForAttempt, type CumulativeExam } from './examTests'
import { tokenizeSentence } from '../engine/lemmatize'

const bookOf = new Map<string, number>()
for (const chapter of CHAPTERS) for (const id of chapter.new) if (!bookOf.has(id)) bookOf.set(id, chapter.book)
const courseSentences = new Set([
  ...CHAPTERS.flatMap(chapter => chapter.sentences),
  ...[...BOOK_TEST_CONTENT.values()].flatMap(content => [...content.reading, ...content.listening]).flatMap(text => text.sentences),
  ...[...CHAPTER_LISTENING.values()].flatMap(text => text.sentences),
].map(sentence => sentence.en.trim().toLowerCase()))

const LAST_BOOK: Record<CumulativeExam, number> = { midpoint: 4, final: 8 }
// Each text must also practise the newer part of what the exam covers.
const NEWER_BOOKS: Record<CumulativeExam, { from: number; words: number }> = {
  midpoint: { from: 3, words: 3 },
  final: { from: 5, words: 5 },
}

// Texts are heard or read, never tapped for glosses, so a possessive or
// "let's" is checked as its base words.
function checkable(line: string): string {
  return line.replace(/\b(l)et['’]s\b/gi, '$1et us').replace(/(\w)['’]s\b/g, '$1')
}

describe('midpoint and final comprehension texts', () => {
  it('give each attempt its texts, with two sets alternating', () => {
    for (const exam of ['midpoint', 'final'] as const) {
      const content = EXAM_TEST_CONTENT.get(exam)!
      const count = EXAM_TEXTS_PER_ATTEMPT[exam]
      expect(content.reading).toHaveLength(count * 2)
      expect(content.listening).toHaveLength(count * 2)
      const first = examTextsForAttempt(exam, 1)
      const second = examTextsForAttempt(exam, 2)
      expect(first.reading).toHaveLength(count)
      expect(first.listening).toHaveLength(count)
      expect(second.reading.map(text => text.id)).not.toEqual(first.reading.map(text => text.id))
      expect(examTextsForAttempt(exam, 3).reading.map(text => text.id)).toEqual(first.reading.map(text => text.id))
    }
    expect(EXAM_TEXTS_PER_ATTEMPT).toEqual({ midpoint: 2, final: 4 })
  })

  for (const exam of ['midpoint', 'final'] as const) {
    it(`${exam} texts use only words taught by book ${LAST_BOOK[exam]} and practise the newer books`, () => {
      const content = EXAM_TEST_CONTENT.get(exam)!
      const problems: string[] = []
      for (const text of [...content.reading, ...content.listening]) {
        let newer = 0
        const seen = new Set<string>()
        for (const line of [text.titleEn, ...text.sentences.map(sentence => sentence.en)]) {
          for (const token of tokenizeSentence(checkable(line), lemmaMap)) {
            if (!token.isWord || text.names.includes(token.raw)) continue
            if (!token.id) {
              problems.push(`${text.id}: unknown "${token.raw}" in: ${line}`)
              continue
            }
            const book = bookOf.get(token.id)
            if (book === undefined || book > LAST_BOOK[exam]) problems.push(`${text.id}: "${token.raw}" (book ${book}) in: ${line}`)
            else if (book >= NEWER_BOOKS[exam].from && !seen.has(token.id)) newer++
            seen.add(token.id)
          }
        }
        if (newer < NEWER_BOOKS[exam].words) problems.push(`${text.id}: only ${newer} words from books ${NEWER_BOOKS[exam].from}+`)
      }
      expect(problems).toEqual([])
    })
  }

  it('are new, complete and well-formed', () => {
    const seen = new Map<string, string>()
    const ids = new Set<string>()
    for (const content of EXAM_TEST_CONTENT.values()) {
      for (const text of [...content.reading, ...content.listening]) {
        expect(ids.has(text.id), `duplicate id ${text.id}`).toBe(false)
        ids.add(text.id)
        expect(text.titleFa).toMatch(/[؀-ۿ]/)
        expect(text.sentences.length, text.id).toBeGreaterThanOrEqual(8)
        expect(text.sentences.length, text.id).toBeLessThanOrEqual(14)
        for (const name of text.names) {
          expect(name, `${text.id} name`).toMatch(/^[A-Z][a-z]+$/)
          expect(tokenizeSentence(name, lemmaMap)[0].id, `${text.id}: "${name}" is a vocabulary word, not a name`).toBeUndefined()
        }
        for (const sentence of text.sentences) {
          const key = sentence.en.trim().toLowerCase()
          expect(sentence.fa, `${text.id}: ${sentence.en}`).toMatch(/[؀-ۿ]/)
          expect(/[.!?]["”]?$/.test(sentence.en.trim()), `${text.id}: unterminated "${sentence.en}"`).toBe(true)
          expect(courseSentences.has(key), `${text.id} copies a course sentence: ${sentence.en}`).toBe(false)
          expect(seen.get(key), `${text.id} repeats a sentence from ${seen.get(key)}: ${sentence.en}`).toBeUndefined()
          seen.set(key, text.id)
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
        expect(answers.size, `${text.id}: answers should not all sit in one position`).toBeGreaterThan(1)
      }
    }
  })
})
