import { describe, expect, it } from 'vitest'
import { CHAPTERS, lemmaMap } from './chapters'
import { BOOK_TEST_CONTENT } from './bookTests'
import { CHAPTER_LISTENING } from './chapterListening'
import { tokenizeSentence } from '../engine/lemmatize'

// Chapter index at which each word is first taught.
const taughtAt = new Map<string, number>()
CHAPTERS.forEach((chapter, index) => {
  for (const id of chapter.new) if (!taughtAt.has(id)) taughtAt.set(id, index)
})
const storySentences = new Set(CHAPTERS.flatMap(chapter => chapter.sentences.map(sentence => sentence.en.trim().toLowerCase())))
const bookTestSentences = new Set([...BOOK_TEST_CONTENT.values()]
  .flatMap(content => [...content.reading, ...content.listening])
  .flatMap(text => text.sentences.map(sentence => sentence.en.trim().toLowerCase())))

// Listening texts are heard, never tapped for glosses, so a possessive
// ("mother's") or "let's" is checked as its base words.
function checkable(line: string): string {
  return line.replace(/\b(l)et['’]s\b/gi, '$1et us').replace(/(\w)['’]s\b/g, '$1')
}

describe('chapter listening texts', () => {
  it('exist for every chapter', () => {
    for (const chapter of CHAPTERS) expect(CHAPTER_LISTENING.has(chapter.id), chapter.id).toBe(true)
    expect(CHAPTER_LISTENING.size).toBe(CHAPTERS.length)
  })

  it('use only words taught by the end of their chapter', () => {
    const problems: string[] = []
    CHAPTERS.forEach((chapter, index) => {
      const text = CHAPTER_LISTENING.get(chapter.id)
      if (!text) return
      for (const line of [text.titleEn, ...text.sentences.map(sentence => sentence.en)]) {
        for (const token of tokenizeSentence(checkable(line), lemmaMap)) {
          if (!token.isWord || text.names.includes(token.raw)) continue
          if (!token.id) problems.push(`${chapter.id}: unknown "${token.raw}" in: ${line}`)
          else if ((taughtAt.get(token.id) ?? Infinity) > index) problems.push(`${chapter.id}: "${token.raw}" (${token.id}) is taught later, in: ${line}`)
        }
      }
    })
    expect(problems).toEqual([])
  })

  it('practise the chapter\'s own new words', () => {
    for (const chapter of CHAPTERS) {
      const text = CHAPTER_LISTENING.get(chapter.id)
      if (!text) continue
      const used = new Set(text.sentences.flatMap(sentence => tokenizeSentence(checkable(sentence.en), lemmaMap).map(token => token.id)))
      const fresh = chapter.new.filter(id => used.has(id)).length
      expect(fresh, `${chapter.id} uses ${fresh} of its new words`).toBeGreaterThanOrEqual(Math.min(3, chapter.new.length))
    }
  })

  it('are new, complete and well-formed', () => {
    const seen = new Map<string, string>()
    for (const [chapterId, text] of CHAPTER_LISTENING) {
      expect(text.id).toBe(`${chapterId}-listening`)
      expect(text.titleFa).toMatch(/[؀-ۿ]/)
      expect(text.sentences.length, chapterId).toBeGreaterThanOrEqual(8)
      expect(text.sentences.length, chapterId).toBeLessThanOrEqual(14)
      for (const name of text.names) {
        expect(name, `${chapterId} name`).toMatch(/^[A-Z][a-z]+$/)
        expect(tokenizeSentence(name, lemmaMap)[0].id, `${chapterId}: "${name}" is a vocabulary word, not a name`).toBeUndefined()
      }
      for (const sentence of text.sentences) {
        const key = sentence.en.trim().toLowerCase()
        expect(sentence.fa, `${chapterId}: ${sentence.en}`).toMatch(/[؀-ۿ]/)
        expect(/[.!?]["”]?$/.test(sentence.en.trim()), `${chapterId}: unterminated "${sentence.en}"`).toBe(true)
        expect(storySentences.has(key), `${chapterId} copies a story sentence: ${sentence.en}`).toBe(false)
        expect(bookTestSentences.has(key), `${chapterId} copies a book-test sentence: ${sentence.en}`).toBe(false)
        expect(seen.get(key), `${chapterId} repeats a sentence from ${seen.get(key)}: ${sentence.en}`).toBeUndefined()
        seen.set(key, chapterId)
      }
      expect(text.questions, chapterId).toHaveLength(5)
      const answers = new Set<number>()
      for (const question of text.questions) {
        expect(question.q, chapterId).toMatch(/[؀-ۿ]/)
        expect(question.options, `${chapterId}: ${question.q}`).toHaveLength(4)
        expect(new Set(question.options.map(option => option.trim())).size, `${chapterId}: ${question.q}`).toBe(4)
        expect(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4, `${chapterId}: ${question.q}`).toBe(true)
        answers.add(question.answer)
      }
      expect(new Set(text.questions.map(question => question.q)).size, chapterId).toBe(5)
      expect(answers.size, `${chapterId}: answers should not all sit in one position`).toBeGreaterThan(1)
    }
  })
})
