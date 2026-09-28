import { beforeEach, describe, expect, it } from 'vitest'
import { CHAPTERS } from '../data/chapters'
import { clearSessionDrafts, emptyState } from './store'
import { blankWordProgress, recordRetrieval } from './review'
import { bookTestSignature, buildBookTest, emptyBookTestAnswers, type BookTest } from './bookTest'
import { clearBookTestDraft, loadBookTestDraft, sanitizeBookTestDraft, saveBookTestDraft, savedBookTest, type BookTestDraft } from './bookTestDraft'

function memoryStorage(mem: Map<string, string>): Storage {
  return {
    getItem: (key: string) => mem.get(key) ?? null,
    setItem: (key: string, value: string) => void mem.set(key, value),
    removeItem: (key: string) => void mem.delete(key),
    clear: () => mem.clear(),
    key: (index: number) => [...mem.keys()][index] ?? null,
    get length() { return mem.size },
  } as Storage
}
const sessionMem = new Map<string, string>()
const localMem = new Map<string, string>()
globalThis.sessionStorage = memoryStorage(sessionMem)
globalThis.localStorage = memoryStorage(localMem)

function bookOneState() {
  const state = emptyState(1, 'b1c1')
  for (const chapter of CHAPTERS.filter(ch => ch.book === 1)) for (const id of chapter.new) state.words[id] = blankWordProgress(1)
  return state
}

function bookOneTest(attempt = 1): BookTest {
  return buildBookTest(1, bookOneState(), attempt)!
}

function draft(test: BookTest, overrides: Partial<BookTestDraft> = {}): BookTestDraft {
  const answers = emptyBookTestAnswers(test)
  answers.translation = test.translation.map(() => 'پاسخ')
  answers.listeningWords = test.listeningWords.slice(0, 3).map(item => item.wordId)
  return {
    version: 3,
    book: 1,
    attempt: test.attempt,
    signature: bookTestSignature(test),
    words: { translation: test.translation.map(item => item.wordId), listeningWords: test.listeningWords.map(item => item.wordId) },
    section: 'listeningWords',
    textIndex: 0,
    answers,
    timings: { 'translation:0': 1200, 'listeningWords:1': 800 },
    listeningHeard: test.listening.map(() => false),
    updatedAt: 1_000,
    ...overrides,
  }
}

describe('end-of-book test drafts', () => {
  beforeEach(() => {
    sessionMem.clear()
    localMem.clear()
  })

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
    expect(sanitizeBookTestDraft(draft(test), test, 1_000 + 15 * 24 * 60 * 60 * 1000)).toBeUndefined()
  })

  it('rejects answers that skip or run ahead of the section order', () => {
    const test = bookOneTest()
    const incomplete = draft(test)
    incomplete.answers.translation = incomplete.answers.translation.slice(0, 5)
    expect(sanitizeBookTestDraft(incomplete, test, 1_000)).toBeUndefined()

    const ahead = draft(test)
    ahead.answers.reading[0][0] = 1
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
    jumped.answers.reading[0][0] = 1
    saveBookTestDraft(test, jumped, 1_000)
    expect(loadBookTestDraft(test, 2_000)).toEqual(jumped)
    expect(sanitizeBookTestDraft({ ...jumped, jumped: undefined }, test, 1_000)).toBeUndefined()
    // Listening answers still need the text to have been heard.
    const unheard = draft(test, { section: 'reading', jumped: true })
    unheard.answers.listening[0][0] = 2
    expect(sanitizeBookTestDraft(unheard, test, 1_000)).toBeUndefined()
  })

  it('keeps listening answers only once the text was heard', () => {
    const test = bookOneTest()
    const listening = draft(test, { section: 'listening' })
    listening.answers.listeningWords = test.listeningWords.map(() => '')
    listening.answers.reading = test.reading.map(text => text.questions.map(() => 0))
    listening.answers.listening[0][0] = 2
    expect(sanitizeBookTestDraft(listening, test, 1_000)).toBeUndefined()
    expect(sanitizeBookTestDraft({ ...listening, listeningHeard: [true] }, test, 1_000)?.answers.listening[0][0]).toBe(2)
    // One flag per listening text.
    expect(sanitizeBookTestDraft({ ...listening, listeningHeard: [true, true] }, test, 1_000)).toBeUndefined()
  })

  it('keeps the text position within a section and the texts before it answered', () => {
    const state = emptyState(1, 'b1c1')
    for (const chapter of CHAPTERS.filter(ch => ch.book <= 3)) for (const id of chapter.new) state.words[id] = blankWordProgress(1)
    const test = buildBookTest(3, state, 1)!
    expect(test.reading).toHaveLength(2)
    const answers = emptyBookTestAnswers(test)
    answers.translation = test.translation.map(() => 'پاسخ')
    answers.listeningWords = test.listeningWords.map(() => '')
    answers.reading[0] = test.reading[0].questions.map(() => 1)
    const value: BookTestDraft = {
      version: 3, book: 3, attempt: 1, signature: bookTestSignature(test), section: 'reading', textIndex: 1,
      answers, timings: {}, listeningHeard: [false, false], updatedAt: 1_000,
      words: { translation: test.translation.map(item => item.wordId), listeningWords: test.listeningWords.map(item => item.wordId) },
    }
    expect(sanitizeBookTestDraft(value, test, 1_000)).toMatchObject({ textIndex: 1 })
    expect(sanitizeBookTestDraft({ ...value, textIndex: 2 }, test, 1_000)).toBeUndefined()
    const gap = { ...value, answers: { ...answers, reading: [test.reading[0].questions.map(() => null), answers.reading[1]] } }
    expect(sanitizeBookTestDraft(gap, test, 1_000)).toBeUndefined()
  })

  it('drops malformed timings but keeps the rest', () => {
    const test = bookOneTest()
    const loaded = sanitizeBookTestDraft(draft(test, { timings: { 'translation:0': 900, 'reading:0': 5, 'listeningWords:1': -3 } }), test, 1_000)
    expect(loaded?.timings).toEqual({ 'translation:0': 900 })
  })

  it('keeps an unfinished test across tabs, with its own words even after reviews', () => {
    const state = bookOneState()
    const test = buildBookTest(1, state, 1)!
    saveBookTestDraft(test, draft(test), 1_000)
    expect(sessionMem.size).toBe(0)
    expect(localMem.size).toBe(1)

    // Reviews change which words are the weakest, so a fresh build differs.
    const reviewed = structuredClone(state)
    for (const item of test.translation.slice(0, 40)) {
      reviewed.words[item.wordId] = recordRetrieval(reviewed.words[item.wordId], true, 'reverse', 5_000, 'review')
    }
    expect(bookTestSignature(buildBookTest(1, reviewed, 1)!)).not.toBe(bookTestSignature(test))
    const resumed = savedBookTest(1, 1, 2_000)!
    expect(resumed).toEqual(test)
    expect(loadBookTestDraft(resumed, 2_000)?.answers.translation).toHaveLength(test.translation.length)
    expect(savedBookTest(1, 2, 2_000)).toBeUndefined()

    // A tampered word list is refused.
    const stored = JSON.parse(localMem.values().next().value!)
    stored.words.translation[0] = 'not-a-word'
    localMem.set([...localMem.keys()][0], JSON.stringify(stored))
    expect(savedBookTest(1, 1, 2_000)).toBeUndefined()
  })

  it('is dropped with the other drafts on a reset or an import', () => {
    const test = bookOneTest()
    saveBookTestDraft(test, draft(test), Date.now())
    localMem.set('ghesse:state:v6', '{}')
    clearSessionDrafts()
    expect([...localMem.keys()]).toEqual(['ghesse:state:v6'])
  })
})
