import { describe, expect, it } from 'vitest'
import { CHAPTERS, WORD_BY_ID } from '../data/chapters'
import { BOOK_TEST_CONTENT } from '../data/bookTests'
import { emptyState } from './store'
import { blankWordProgress, recordRetrieval } from './review'
import { bookExamId, canPrepareChapter, canTakeExam, examDefinition, examRemediationPending } from './gates'
import {
  BOOK_TEST_WORDS_PER_SECTION,
  bookTestAllocation,
  buildBookTest,
  recordBookTest,
  scoreBookTest,
  type BookTest,
  type BookTestAnswers,
} from './bookTest'
import type { GhesseState } from './types'

const introducedIn = new Map<string, number>()
for (const chapter of CHAPTERS) for (const id of chapter.new) if (!introducedIn.has(id)) introducedIn.set(id, chapter.book)

function stateThroughBook(book: number): GhesseState {
  const state = emptyState(1, 'b1c1')
  for (const chapter of CHAPTERS.filter(ch => ch.book <= book)) {
    state.chapters[chapter.id] = { preparedAt: 1, prepAttempts: 1, completed: true, checksCorrect: 10, checksTotal: 10, reads: 1 }
    for (const id of chapter.new) state.words[id] = blankWordProgress(1)
  }
  for (let passed = 1; passed < book; passed++) {
    state.exams[bookExamId(passed)] = {
      attempts: 1, passed: true, passedAt: 2, lastAttemptAt: 2, lastScore: 1, bestScore: 1,
      lastProductiveScore: 1, bestProductiveScore: 1, missedWordIds: [], testedWordIds: [],
    }
  }
  return state
}

function perfectAnswers(test: BookTest): BookTestAnswers {
  return {
    translation: test.translation.map(item => WORD_BY_ID.get(item.wordId)!.fa),
    listeningWords: test.listeningWords.map(item => item.wordId),
    reading: test.reading.questions.map(question => question.answer),
    listening: test.listening.questions.map(question => question.answer),
  }
}

describe('end-of-book test', () => {
  it('is the book-N gate: 34 items, each part needing 100%', () => {
    const def = examDefinition(bookExamId(3))!
    expect(def.kind).toBe('book')
    expect(def.titleFa).toBe('آزمون پایان کتاب ۳')
    expect(def.questionCount).toBe(34)
    expect(def.passRate).toBe(1)
  })

  for (let book = 1; book <= 8; book++) {
    it(`book ${book}: vocabulary spans every book so far without repeats`, () => {
      const test = buildBookTest(book, stateThroughBook(book), 1)!
      expect(test.translation).toHaveLength(BOOK_TEST_WORDS_PER_SECTION)
      expect(test.listeningWords).toHaveLength(BOOK_TEST_WORDS_PER_SECTION)
      const all = [...test.translation, ...test.listeningWords]
      expect(new Set(all.map(item => item.wordId)).size).toBe(all.length)
      for (const item of all) {
        expect(introducedIn.get(item.wordId)).toBe(item.book)
        expect(item.book).toBeLessThanOrEqual(book)
      }
      for (const section of [test.translation, test.listeningWords]) {
        const books = new Set(section.map(item => item.book))
        for (let earlier = 1; earlier <= book; earlier++) expect(books.has(earlier), `book ${earlier} in section`).toBe(true)
        if (book > 1) expect(section.filter(item => item.book === book)).toHaveLength(4)
      }
      expect([test.reading, test.listening].map(text => text.id)).toEqual([
        BOOK_TEST_CONTENT.get(book)!.reading[0].id,
        BOOK_TEST_CONTENT.get(book)!.listening[0].id,
      ])
    })
  }

  it('spreads the earlier-book places evenly and rotates the spare ones', () => {
    for (let book = 2; book <= 8; book++) {
      for (let rotation = 0; rotation < 8; rotation++) {
        const allocation = bookTestAllocation(book, rotation)
        expect([...allocation.values()].reduce((sum, count) => sum + count, 0)).toBe(BOOK_TEST_WORDS_PER_SECTION)
        const earlier = [...allocation].filter(([source]) => source < book).map(([, count]) => count)
        expect(Math.max(...earlier) - Math.min(...earlier)).toBeLessThanOrEqual(1)
      }
    }
    const extras = new Set([0, 1, 2, 3, 4, 5, 6].map(rotation => [...bookTestAllocation(8, rotation)].find(([, count]) => count === 2)![0]))
    expect(extras.size).toBe(7)
  })

  it('asks function words only inside the texts, and never ambiguous sounds', () => {
    for (let book = 1; book <= 8; book++) {
      for (const attempt of [1, 2, 3]) {
        const test = buildBookTest(book, stateThroughBook(book), attempt)!
        for (const item of [...test.translation, ...test.listeningWords]) {
          expect(['grammar', 'pronouns', 'prepositions', 'linking', 'question_words']).not.toContain(WORD_BY_ID.get(item.wordId)!.topic)
        }
        for (const item of test.listeningWords) {
          const word = WORD_BY_ID.get(item.wordId)!
          expect(['like', 'second', 'a, an']).not.toContain(word.word)
          expect(item.options).toHaveLength(4)
          expect(item.options.filter(option => option.id === item.wordId)).toHaveLength(1)
          const surfaces = item.options.map(option => WORD_BY_ID.get(option.id)!.word.toLowerCase())
          for (const group of [['to', 'too', 'two'], ['right', 'write'], ['hear', 'here'], ['son', 'sun'], ['know', 'no'], ['by', 'buy', 'bye'], ['there', 'their'], ['our', 'hour'], ['for', 'four']]) {
            expect(surfaces.filter(value => group.includes(value)).length, `${word.word}: ${surfaces.join(', ')}`).toBeLessThanOrEqual(1)
          }
        }
      }
    }
  })

  it('is stable for one attempt and alternates texts between attempts', () => {
    const state = stateThroughBook(2)
    const first = buildBookTest(2, state, 1)!
    expect(buildBookTest(2, state, 1)).toEqual(first)
    const second = buildBookTest(2, state, 2)!
    const third = buildBookTest(2, state, 3)!
    expect(second.reading.id).not.toBe(first.reading.id)
    expect(second.listening.id).not.toBe(first.listening.id)
    expect(third.reading.id).toBe(first.reading.id)
    expect(third.listening.id).toBe(first.listening.id)
  })

  it('widens vocabulary coverage on a retake', () => {
    let state = stateThroughBook(1)
    const first = buildBookTest(1, state, 1)!
    const answers = perfectAnswers(first)
    answers.reading = answers.reading.map(() => null)
    state = recordBookTest(state, first, answers, scoreBookTest(first, answers), 100)
    const tested = new Set(state.exams[bookExamId(1)].testedWordIds)
    expect(tested.size).toBe(24)
    const second = buildBookTest(1, state, 2)!
    const fresh = [...second.translation, ...second.listeningWords].filter(item => !tested.has(item.wordId))
    expect(fresh.length).toBeGreaterThanOrEqual(10)
  })

  it('passes only when every answer in every part is right', () => {
    const test = buildBookTest(3, stateThroughBook(3), 1)!
    const perfect = perfectAnswers(test)
    const all = scoreBookTest(test, perfect)
    expect(all.passed).toBe(true)
    expect(all.correct).toBe(34)
    expect(all.missedWordIds).toEqual([])

    // One wrong answer anywhere fails the whole test.
    const fourReading = { ...perfect, reading: perfect.reading.map((answer, index) => index === 0 ? (answer! + 1) % 4 : answer) }
    expect(scoreBookTest(test, fourReading).sections.reading).toMatchObject({ correct: 4, passed: false })
    expect(scoreBookTest(test, fourReading).passed).toBe(false)
    const threeListening = { ...perfect, listening: perfect.listening.map((answer, index) => index < 2 ? (answer! + 1) % 4 : answer) }
    const failed = scoreBookTest(test, threeListening)
    expect(failed.sections.listening).toMatchObject({ correct: 3, total: 5, passed: false })
    expect(failed.passed).toBe(false)
    expect(failed.score).toBeGreaterThan(0.9)

    const translation = [...perfect.translation]
    translation[0] = ''
    translation[1] = 'اشتباه'
    translation[2] = 'نمی‌دانم'
    const typedGaps = scoreBookTest(test, { ...perfect, translation })
    expect(typedGaps.sections.translation).toMatchObject({ correct: 9, passed: false })
    expect(typedGaps.missedWordIds).toEqual(test.translation.slice(0, 3).map(item => item.wordId))

    const listeningWords = [...perfect.listeningWords]
    listeningWords[4] = test.listeningWords[4].options.find(option => option.id !== test.listeningWords[4].wordId)!.id
    listeningWords[5] = ''
    expect(scoreBookTest(test, { ...perfect, listeningWords }).sections.listeningWords).toMatchObject({ correct: 10, passed: false })
  })

  it('accepts any listed Persian meaning, typed loosely', () => {
    const test = buildBookTest(1, stateThroughBook(1), 1)!
    const answers = perfectAnswers(test)
    answers.translation = test.translation.map(item => {
      const fa = WORD_BY_ID.get(item.wordId)!.fa
      return ` ${fa.split(/[؛;،,/]/).at(-1)!.trim().replace(/ی/g, 'ي')} `
    })
    expect(scoreBookTest(test, answers).sections.translation.correct).toBe(12)
  })

  it('records the attempt, keeps a pass and gates the next book on remediation', () => {
    let state = stateThroughBook(1)
    expect(canTakeExam(state, bookExamId(1))).toBe(true)
    expect(canPrepareChapter(state, 'b2c1')).toBe(false)

    // One missed word fails the test at the 100% pass mark.
    const test = buildBookTest(1, state, 1)!
    const answers = perfectAnswers(test)
    answers.translation[0] = ''
    const result = scoreBookTest(test, answers)
    expect(result.passed).toBe(false)
    state = recordBookTest(state, test, answers, result, 1_000)
    const progress = state.exams[bookExamId(1)]
    expect(progress).toMatchObject({ attempts: 1, passed: false, lastAttemptAt: 1_000, missedWordIds: [test.translation[0].wordId] })
    expect(progress.lastProductiveScore).toBeCloseTo(11 / 12)
    const missed = test.translation[0].wordId
    expect(state.words[missed].reviewWrong).toBe(1)
    expect(state.words[test.translation[1].wordId].reviewCorrect).toBe(1)

    // The missed word must be recalled again before the retake opens.
    expect(examRemediationPending(state, bookExamId(1))).toBe(true)
    expect(canTakeExam(state, bookExamId(1))).toBe(false)
    expect(canPrepareChapter(state, 'b2c1')).toBe(false)
    state = { ...state, words: { ...state.words, [missed]: recordRetrieval(state.words[missed], true, 'reverse', 2_000, 'review') } }
    expect(canTakeExam(state, bookExamId(1))).toBe(true)
    expect(canPrepareChapter(state, 'b2c1')).toBe(false)

    // A perfect retake passes and opens book 2.
    const second = buildBookTest(1, state, 2)!
    const perfect = perfectAnswers(second)
    const passed = scoreBookTest(second, perfect)
    expect(passed.passed).toBe(true)
    state = recordBookTest(state, second, perfect, passed, 3_000)
    expect(state.exams[bookExamId(1)]).toMatchObject({ attempts: 2, passed: true, passedAt: 3_000, missedWordIds: [] })
    expect(canPrepareChapter(state, 'b2c1')).toBe(true)

    // A later failed retake never revokes the pass.
    const retake = buildBookTest(1, state, 3)!
    const blank: BookTestAnswers = { translation: [], listeningWords: [], reading: [null, null, null, null, null], listening: [null, null, null, null, null] }
    state = recordBookTest(state, retake, blank, scoreBookTest(retake, blank), 4_000)
    expect(state.exams[bookExamId(1)]).toMatchObject({ attempts: 3, passed: true, passedAt: 3_000, bestScore: 1 })
  })
})
