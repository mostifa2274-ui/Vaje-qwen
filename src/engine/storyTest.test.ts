import { beforeEach, describe, expect, it } from 'vitest'

const mem = new Map<string, string>()
globalThis.localStorage = {
  getItem: (key: string) => mem.get(key) ?? null,
  setItem: (key: string, value: string) => void mem.set(key, value),
  removeItem: (key: string) => void mem.delete(key),
  clear: () => mem.clear(),
  key: (index: number) => [...mem.keys()][index] ?? null,
  get length() { return mem.size },
} as Storage

import { CHAPTERS, CHAPTER_BY_ID, chaptersOfBook } from '../data/chapters'
import { emptyState, loadState, STORAGE_KEY } from './store'
import { FINAL_EXAM_ID, bookExamId, canPrepareChapter, canTakeExam, canTakeStoryTest, storyTestCleared } from './gates'
import { nextBestAction } from './analytics'
import {
  STORY_TEST_CURRENT_COUNT,
  buildStoryTest,
  previousQuestionCount,
  recordStoryTest,
  scoreStoryTest,
  storyTestId,
} from './storyTest'
import type { GhesseState } from './types'

function completedThrough(book: number): GhesseState {
  const state = emptyState(1, CHAPTERS[0].id)
  for (const chapter of CHAPTERS.filter(item => item.book <= book)) {
    state.chapters[chapter.id] = { preparedAt: 2, prepAttempts: 1, completed: true, completedAt: 3, checksCorrect: 10, checksTotal: 10, reads: 1 }
  }
  for (let passed = 1; passed <= book; passed++) {
    state.exams[bookExamId(passed)] = {
      attempts: 1, passed: true, passedAt: 4, lastAttemptAt: 4, lastScore: 1, bestScore: 1,
      lastProductiveScore: 1, bestProductiveScore: 1, missedWordIds: [], testedWordIds: [],
    }
  }
  return state
}

function passStory(state: GhesseState, book: number): GhesseState {
  const test = buildStoryTest(book, 1)
  const answers = Object.fromEntries(test.questions.map((question, index) => [index, question.answerId]))
  return recordStoryTest(state, book, scoreStoryTest(test, answers), 10)
}

describe('book story comprehension tests', () => {
  it('builds valid four-option questions for every book and attempt', () => {
    for (let book = 1; book <= 8; book++) {
      for (let attempt = 1; attempt <= 4; attempt++) {
        const test = buildStoryTest(book, attempt)
        expect(test.questions, `book ${book}`).toHaveLength(STORY_TEST_CURRENT_COUNT + previousQuestionCount(book))
        expect(new Set(test.questions.map(question => question.id)).size, `book ${book}`).toBe(test.questions.length)
        for (const question of test.questions) {
          const where = `book ${book} attempt ${attempt} ${question.id}`
          expect(question.options, where).toHaveLength(4)
          expect(new Set(question.options.map(option => option.id)).size, where).toBe(4)
          expect(new Set(question.options.map(option => option.label.trim().toLowerCase())).size, where).toBe(4)
          expect(question.options.some(option => option.id === question.answerId), where).toBe(true)
          expect(CHAPTER_BY_ID.get(question.chapterId)?.book, where).toBe(question.book)
        }
      }
    }
  })

  it('covers every chapter of the finished book and every earlier book', () => {
    for (let book = 1; book <= 8; book++) {
      const test = buildStoryTest(book, 1)
      const current = test.questions.filter(question => question.scope === 'current')
      const previous = test.questions.filter(question => question.scope === 'previous')
      expect(current).toHaveLength(STORY_TEST_CURRENT_COUNT)
      expect(current.every(question => question.book === book)).toBe(true)
      for (const chapter of chaptersOfBook(book)) {
        expect(current.some(question => question.showChapter && question.chapterId === chapter.id), chapter.id).toBe(true)
      }
      expect(previous.every(question => question.book < book)).toBe(true)
      for (let earlier = 1; earlier < book; earlier++) {
        expect(previous.some(question => question.book === earlier), `book ${book} reviews book ${earlier}`).toBe(true)
      }
      // Earlier books come first, in story order.
      const books = test.questions.map(question => question.book)
      expect(books).toEqual([...books].sort((a, b) => a - b))
    }
  })

  it('asks book-level questions that are answerable from the story', () => {
    for (let book = 1; book <= 8; book++) {
      const test = buildStoryTest(book, 2)
      const which = test.questions.filter(question => question.id.startsWith('which-chapter:'))
      expect(which.length).toBeGreaterThan(0)
      for (const question of which) {
        const chapter = CHAPTER_BY_ID.get(question.chapterId)!
        expect(chapter.sentences.some(sentence => sentence.en === question.context), question.id).toBe(true)
        expect(question.answerId).toBe(`chapter:${chapter.id}`)
        expect(question.showChapter).toBe(false)
      }
      const order = test.questions.find(question => question.id.startsWith('order:'))!
      const chapterOf = (optionId: string) => CHAPTER_BY_ID.get(optionId.split(':')[1])!
      const earliest = [...order.options].sort((a, b) => chapterOf(a.id).n - chapterOf(b.id).n)[0]
      expect(order.answerId).toBe(earliest.id)
      expect(new Set(order.options.map(option => chapterOf(option.id).id)).size).toBe(4)
    }
  })

  it('is deterministic per attempt and varies between attempts', () => {
    expect(buildStoryTest(5, 3)).toEqual(buildStoryTest(5, 3))
    const ids = (attempt: number) => buildStoryTest(5, attempt).questions.map(question => question.id).join('|')
    expect(ids(1)).not.toBe(ids(2))
  })

  it('passes at 80% and keeps a pass through later retakes', () => {
    const test = buildStoryTest(2, 1)
    const allRight = Object.fromEntries(test.questions.map((question, index) => [index, question.answerId]))
    const total = test.questions.length
    const passingMisses = Math.floor(total * 0.2)
    const passing = { ...allRight }
    for (let index = 0; index < passingMisses; index++) delete passing[index]
    const failing = { ...passing }
    delete failing[passingMisses]

    const passed = scoreStoryTest(test, passing)
    expect(passed.passed).toBe(true)
    expect(passed.missed).toHaveLength(passingMisses)
    expect(passed.previousTotal + passed.currentTotal).toBe(total)
    expect(scoreStoryTest(test, failing).passed).toBe(false)

    let state = recordStoryTest(completedThrough(2), 2, passed, 100)
    state = recordStoryTest(state, 2, scoreStoryTest(test, {}), 200)
    expect(state.storyTests[storyTestId(2)]).toMatchObject({ attempts: 2, passed: true, passedAt: 100, lastScore: 0 })
  })
})

describe('story test gates', () => {
  beforeEach(() => localStorage.clear())

  it('opens after the last chapter of a book', () => {
    const state = completedThrough(1)
    expect(canTakeStoryTest(state, 1)).toBe(true)
    expect(canTakeStoryTest(state, 2)).toBe(false)
  })

  it('requires the story test before the next book, and recommends it first', () => {
    const state = emptyState(1, CHAPTERS[0].id)
    for (const chapter of chaptersOfBook(1)) {
      state.chapters[chapter.id] = { preparedAt: 2, prepAttempts: 1, completed: true, completedAt: 3, checksCorrect: 10, checksTotal: 10, reads: 1 }
    }
    expect(nextBestAction(state, 5)).toMatchObject({ kind: 'storyTest', book: 1 })

    const vocabularyPassed = completedThrough(1)
    const nextBookStart = chaptersOfBook(2)[0].id
    expect(canPrepareChapter(vocabularyPassed, nextBookStart)).toBe(false)
    expect(canPrepareChapter(passStory(vocabularyPassed, 1), nextBookStart)).toBe(true)
  })

  it('never relocks learners who reached the next book before story tests existed', () => {
    const legacy = completedThrough(1)
    const nextBookStart = chaptersOfBook(2)[0].id
    legacy.chapters[nextBookStart] = { preparedAt: 6, prepAttempts: 1, completed: false, checksCorrect: 0, checksTotal: 0, reads: 0 }
    expect(storyTestCleared(legacy, 1)).toBe(true)
    expect(canPrepareChapter(legacy, nextBookStart)).toBe(true)
    expect(nextBestAction(legacy, 7).kind).not.toBe('storyTest')
  })

  it('gates the final exam on the book 8 story test', () => {
    const state = completedThrough(8)
    expect(canTakeExam(state, FINAL_EXAM_ID)).toBe(false)
    expect(canTakeExam(passStory(state, 8), FINAL_EXAM_ID)).toBe(true)
  })

  it('persists story tests and drops unknown ids', () => {
    const state = passStory(completedThrough(1), 1)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, storyTests: { ...state.storyTests, 'story-9': { passed: true }, injected: {} } }))
    const loaded = loadState(20, CHAPTERS[0].id, CHAPTERS.map(chapter => chapter.id), [])
    expect(Object.keys(loaded.storyTests)).toEqual([storyTestId(1)])
    expect(loaded.storyTests[storyTestId(1)].passed).toBe(true)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, storyTests: undefined }))
    expect(loadState(20, CHAPTERS[0].id).storyTests).toEqual({})
  })
})
