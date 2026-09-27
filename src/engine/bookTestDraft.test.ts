import { beforeEach, describe, expect, it } from 'vitest'
import { CHAPTERS } from '../data/chapters'
import { emptyState } from './store'
import { blankWordProgress } from './review'
import { bookTestSignature, buildBookTest, emptyBookTestAnswers, type BookTest } from './bookTest'
import { clearBookTestDraft, loadBookTestDraft, sanitizeBookTestDraft, saveBookTestDraft, type BookTestDraft } from './bookTestDraft'

const sessionMem = new Map<string, string>()
globalThis.sessionStorage = {
  getItem: (key: string) => sessionMem.get(key) ?? null,
  setItem: (key: string, value: string) => void sessionMem.set(key, value),
  removeItem: (key: string) => void sessionMem.delete(key),
  clear: () => sessionMem.clear(),
  key: (index: number) => [...sessionMem.keys()][index] ?? null,
  get length() { return sessionMem.size },
} as Storage

function bookOneTest(attempt = 1): BookTest {
  const state = emptyState(1, 'b1c1')
  for (const chapter of CHAPTERS.filter(ch => ch.book === 1)) for (const id of chapter.new) state.words[id] = blankWordProgress(1)
  return buildBookTest(1, state, attempt)!
}

function draft(test: BookTest, overrides: Partial<BookTestDraft> = {}): BookTestDraft {
  const answers = emptyBookTestAnswers(test)
  answers.translation = test.translation.map(() => 'پاسخ')
  answers.listeningWords = test.listeningWords.slice(0, 3).map(item => item.wordId)
  return {
    version: 1,
    book: 1,
    attempt: test.attempt,
    signature: bookTestSignature(test),
    section: 'listeningWords',
    answers,
    timings: { 'translation:0': 1200, 'listeningWords:1': 800 },
    listeningHeard: false,
    updatedAt: 1_000,
    ...overrides,
  }
}

describe('end-of-book test drafts', () => {
  beforeEach(() => sessionMem.clear())

  it('round-trips unfinished progress for the same test', () => {
    const test = bookOneTest()
    const value = draft(test)
    saveBookTestDraft(test, value, 1_000)
    expect(loadBookTestDraft(test, 2_000)).toEqual(value)
    clearBookTestDraft(1)
    expect(loadBookTestDraft(test, 2_000)).toBeUndefined()
  })

  it('never attaches to another attempt or a changed test', () => {
    const test = bookOneTest()
    expect(sanitizeBookTestDraft(draft(test), bookOneTest(2), 1_000)).toBeUndefined()
    expect(sanitizeBookTestDraft(draft(test, { signature: 'tampered' }), test, 1_000)).toBeUndefined()
    expect(sanitizeBookTestDraft(draft(test), test, 1_000 + 25 * 60 * 60 * 1000)).toBeUndefined()
  })

  it('rejects answers that skip or run ahead of the section order', () => {
    const test = bookOneTest()
    const incomplete = draft(test)
    incomplete.answers.translation = incomplete.answers.translation.slice(0, 5)
    expect(sanitizeBookTestDraft(incomplete, test, 1_000)).toBeUndefined()

    const ahead = draft(test)
    ahead.answers.reading[0] = 1
    expect(sanitizeBookTestDraft(ahead, test, 1_000)).toBeUndefined()

    const unknownOption = draft(test)
    unknownOption.answers.listeningWords[0] = 'not-an-option'
    expect(sanitizeBookTestDraft(unknownOption, test, 1_000)).toBeUndefined()
  })

  it('keeps sections opened out of order only in a draft marked by explore mode', () => {
    const test = bookOneTest()
    const jumped = draft(test, { section: 'reading', jumped: true })
    jumped.answers.translation = []
    jumped.answers.listeningWords = []
    jumped.answers.reading[0] = 1
    saveBookTestDraft(test, jumped, 1_000)
    expect(loadBookTestDraft(test, 2_000)).toEqual(jumped)
    expect(sanitizeBookTestDraft({ ...jumped, jumped: undefined }, test, 1_000)).toBeUndefined()
    // Listening answers still need the text to have been heard.
    const unheard = draft(test, { section: 'reading', jumped: true })
    unheard.answers.listening[0] = 2
    expect(sanitizeBookTestDraft(unheard, test, 1_000)).toBeUndefined()
  })

  it('keeps listening answers only once the text was heard', () => {
    const test = bookOneTest()
    const listening = draft(test, { section: 'listening' })
    listening.answers.listeningWords = test.listeningWords.map(() => '')
    listening.answers.reading = test.reading.questions.map(() => 0)
    listening.answers.listening[0] = 2
    expect(sanitizeBookTestDraft(listening, test, 1_000)).toBeUndefined()
    expect(sanitizeBookTestDraft({ ...listening, listeningHeard: true }, test, 1_000)?.answers.listening[0]).toBe(2)
  })

  it('drops malformed timings but keeps the rest', () => {
    const test = bookOneTest()
    const loaded = sanitizeBookTestDraft(draft(test, { timings: { 'translation:0': 900, 'reading:0': 5, 'listeningWords:1': -3 } }), test, 1_000)
    expect(loaded?.timings).toEqual({ 'translation:0': 900 })
  })
})
