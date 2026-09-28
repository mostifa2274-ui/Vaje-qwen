import { describe, expect, it } from 'vitest'
import { CHAPTERS, WORD_BY_ID } from '../data/chapters'
import { BOOK_TEST_CONTENT } from '../data/bookTests'
import { emptyState } from './store'
import { blankWordProgress, recordRetrieval } from './review'
import { bookExamId, canPrepareChapter, canTakeExam, examDefinition, examRemediationPending } from './gates'
import { bookTestQuestionCount, bookTestTextsPerSkill, bookTestWordCount, bookTestWordsFrom, bookWordIds } from './bookTestSize'
import {
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
    reading: test.reading.map(text => text.questions.map(question => question.answer)),
    listening: test.listening.map(text => text.questions.map(question => question.answer)),
  }
}

describe('end-of-book test', () => {
  it('is the book-N gate, growing with the books and needing 100% in each part', () => {
    const def = examDefinition(bookExamId(3))!
    expect(def.kind).toBe('book')
    expect(def.titleFa).toBe('آزمون پایان کتاب ۳')
    expect(def.questionCount).toBe(bookTestQuestionCount(3))
    expect(def.passRate).toBe(1)
    // Half of the words studied so far, and 1, 2, 3, 4 texts per skill.
    const studied = (book: number) => CHAPTERS.filter(ch => ch.book <= book).reduce((sum, ch) => sum + ch.new.length, 0)
    for (let book = 1; book <= 8; book++) {
      expect(Math.abs(bookTestWordCount(book) - studied(book) / 2)).toBeLessThanOrEqual(book)
      expect(bookTestTextsPerSkill(book)).toBe(Math.ceil(book / 2))
    }
    expect(bookTestWordCount(1)).toBe(145)
    expect(bookTestWordCount(8)).toBeGreaterThanOrEqual(445)
  })

  for (let book = 1; book <= 8; book++) {
    it(`book ${book}: half of every studied book's words, without repeats`, () => {
      const test = buildBookTest(book, stateThroughBook(book), 1)!
      const all = [...test.translation, ...test.listeningWords]
      expect(all).toHaveLength(bookTestWordCount(book))
      expect(Math.abs(test.translation.length - test.listeningWords.length)).toBeLessThanOrEqual(book)
      expect(new Set(all.map(item => item.wordId)).size).toBe(all.length)
      for (const item of all) {
        expect(introducedIn.get(item.wordId)).toBe(item.book)
        expect(item.book).toBeLessThanOrEqual(book)
      }
      for (let source = 1; source <= book; source++) {
        expect(all.filter(item => item.book === source), `book ${source}`).toHaveLength(bookTestWordsFrom(source))
        expect(bookTestWordsFrom(source)).toBe(Math.round(bookWordIds(source).length / 2))
        for (const section of [test.translation, test.listeningWords]) {
          expect(section.some(item => item.book === source), `book ${source} in each section`).toBe(true)
        }
      }
      const count = bookTestTextsPerSkill(book)
      expect(test.reading.map(text => text.id)).toEqual(BOOK_TEST_CONTENT.get(book)!.reading.slice(0, count).map(text => text.id))
      expect(test.listening.map(text => text.id)).toEqual(BOOK_TEST_CONTENT.get(book)!.listening.slice(0, count).map(text => text.id))
    })
  }

  it('splits each book\'s share between typing and listening and rotates the spare word', () => {
    for (let book = 1; book <= 8; book++) {
      for (const rotation of [0, 1]) {
        const allocation = bookTestAllocation(book, rotation)
        expect([...allocation.keys()]).toEqual(Array.from({ length: book }, (_, index) => index + 1))
        for (const [source, counts] of allocation) {
          expect(counts.translation + counts.listeningWords).toBe(bookTestWordsFrom(source))
          expect(Math.abs(counts.translation - counts.listeningWords)).toBeLessThanOrEqual(1)
        }
      }
      for (const [source, counts] of bookTestAllocation(book, 0)) {
        if (bookTestWordsFrom(source) % 2) expect(bookTestAllocation(book, 1).get(source)!.translation).not.toBe(counts.translation)
      }
    }
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
          // A sound-alike of the heard word is never offered beside it.
          const surfaces = item.options.map(option => WORD_BY_ID.get(option.id)!.word.toLowerCase())
          for (const group of [['to', 'too', 'two'], ['right', 'write'], ['hear', 'here'], ['son', 'sun'], ['know', 'no'], ['by', 'buy', 'bye'], ['there', 'their'], ['our', 'hour'], ['for', 'four']]) {
            if (!group.includes(word.word.toLowerCase())) continue
            expect(surfaces.filter(value => group.includes(value)).length, `${word.word}: ${surfaces.join(', ')}`).toBe(1)
          }
        }
      }
    }
  }, 30_000)

  it('is stable for one attempt and alternates texts between attempts', () => {
    const state = stateThroughBook(2)
    const first = buildBookTest(2, state, 1)!
    expect(buildBookTest(2, state, 1)).toEqual(first)
    const second = buildBookTest(2, state, 2)!
    const third = buildBookTest(2, state, 3)!
    const ids = (texts: { id: string }[]) => texts.map(text => text.id)
    for (const skill of ['reading', 'listening'] as const) {
      expect(ids(second[skill]).some(id => ids(first[skill]).includes(id))).toBe(false)
      expect(ids(third[skill])).toEqual(ids(first[skill]))
    }
  })

  it('widens vocabulary coverage on a retake', () => {
    let state = stateThroughBook(1)
    const first = buildBookTest(1, state, 1)!
    const answers = perfectAnswers(first)
    answers.reading = answers.reading.map(text => text.map(() => null))
    state = recordBookTest(state, first, answers, scoreBookTest(first, answers), 100)
    const tested = new Set(state.exams[bookExamId(1)].testedWordIds)
    expect(tested.size).toBe(145)
    const second = buildBookTest(1, state, 2)!
    const fresh = [...second.translation, ...second.listeningWords].filter(item => !tested.has(item.wordId))
    expect(fresh.length).toBeGreaterThanOrEqual(50)
  })

  it('passes only when every answer in every part is right', () => {
    const test = buildBookTest(3, stateThroughBook(3), 1)!
    const perfect = perfectAnswers(test)
    const all = scoreBookTest(test, perfect)
    expect(all.passed).toBe(true)
    expect(all.correct).toBe(bookTestQuestionCount(3))
    expect(all.missedWordIds).toEqual([])
    const texts = bookTestTextsPerSkill(3)
    expect(all.sections.reading.total).toBe(texts * 5)

    // One wrong answer anywhere fails the whole test.
    const wrongFirst = (chosen: Array<Array<number | null>>, count: number) =>
      chosen.map((text, slot) => slot === chosen.length - 1 ? text.map((answer, index) => index < count ? (answer! + 1) % 4 : answer) : text)
    const oneReading = { ...perfect, reading: wrongFirst(perfect.reading, 1) }
    expect(scoreBookTest(test, oneReading).sections.reading).toMatchObject({ correct: texts * 5 - 1, passed: false })
    expect(scoreBookTest(test, oneReading).passed).toBe(false)
    const twoListening = { ...perfect, listening: wrongFirst(perfect.listening, 2) }
    const failed = scoreBookTest(test, twoListening)
    expect(failed.sections.listening).toMatchObject({ correct: texts * 5 - 2, total: texts * 5, passed: false })
    expect(failed.passed).toBe(false)
    expect(failed.score).toBeGreaterThan(0.95)

    const translation = [...perfect.translation]
    translation[0] = ''
    translation[1] = 'اشتباه'
    translation[2] = 'نمی‌دانم'
    const typedGaps = scoreBookTest(test, { ...perfect, translation })
    expect(typedGaps.sections.translation).toMatchObject({ correct: test.translation.length - 3, passed: false })
    expect(typedGaps.missedWordIds).toEqual(test.translation.slice(0, 3).map(item => item.wordId))

    const listeningWords = [...perfect.listeningWords]
    listeningWords[4] = test.listeningWords[4].options.find(option => option.id !== test.listeningWords[4].wordId)!.id
    listeningWords[5] = ''
    expect(scoreBookTest(test, { ...perfect, listeningWords }).sections.listeningWords).toMatchObject({ correct: test.listeningWords.length - 2, passed: false })
  })

  it('accepts any listed Persian meaning, typed loosely', () => {
    const test = buildBookTest(1, stateThroughBook(1), 1)!
    const answers = perfectAnswers(test)
    answers.translation = test.translation.map(item => {
      const fa = WORD_BY_ID.get(item.wordId)!.fa
      return ` ${fa.split(/[؛;،,/]/).at(-1)!.trim().replace(/ی/g, 'ي')} `
    })
    expect(scoreBookTest(test, answers).sections.translation.correct).toBe(test.translation.length)
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
    expect(progress.lastProductiveScore).toBeCloseTo((test.translation.length - 1) / test.translation.length)
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
    const blank: BookTestAnswers = { translation: [], listeningWords: [], reading: [[null, null, null, null, null]], listening: [[null, null, null, null, null]] }
    state = recordBookTest(state, retake, blank, scoreBookTest(retake, blank), 4_000)
    expect(state.exams[bookExamId(1)]).toMatchObject({ attempts: 3, passed: true, passedAt: 3_000, bestScore: 1 })
  })
})
