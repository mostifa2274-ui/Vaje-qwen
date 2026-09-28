import { BOOK_TEST_DRAFT_PREFIX } from './store'
import { BOOK_TEST_SECTIONS, bookTestFromWords, bookTestSignature, type BookTest, type BookTestAnswers, type BookTestSection } from './bookTest'

// Resume for an unfinished end-of-book test. The tests are long (half of
// every studied book's words), so unlike the other drafts this one is kept
// in localStorage and survives closing the tab. It also holds the test's
// own word lists, so the same test comes back even after reviews change
// which words a fresh build would pick.
export interface BookTestDraft {
  version: 3
  book: number
  attempt: number
  signature: string
  section: BookTestSection
  /** The text on screen within the reading or listening section. */
  textIndex: number
  answers: BookTestAnswers
  timings: Record<string, number>
  /** Each listening text has been heard in full at least once. */
  listeningHeard: boolean[]
  /** Explore mode opened sections out of order. */
  jumped?: true
  /** The test's words, in order. */
  words: { translation: string[]; listeningWords: string[] }
  updatedAt: number
}

const PREFIX = `${BOOK_TEST_DRAFT_PREFIX}v3:`
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000
const MAX_TYPED_LENGTH = 200

function storageKey(book: number): string {
  return `${PREFIX}${book}`
}

function stringList(raw: unknown, max: number, valid: (value: string, index: number) => boolean): string[] | undefined {
  if (!Array.isArray(raw) || raw.length > max) return undefined
  for (const [index, value] of raw.entries()) if (typeof value !== 'string' || !valid(value, index)) return undefined
  return raw as string[]
}

function choiceList(raw: unknown, length: number): Array<number | null> | undefined {
  if (!Array.isArray(raw) || raw.length !== length) return undefined
  for (const value of raw) {
    if (value === null) continue
    if (!Number.isInteger(value) || value < 0 || value > 3) return undefined
  }
  return [...raw] as Array<number | null>
}

function textChoices(raw: unknown, texts: BookTest['reading']): Array<Array<number | null>> | undefined {
  if (!Array.isArray(raw) || raw.length !== texts.length) return undefined
  const result: Array<Array<number | null>> = []
  for (const [slot, text] of texts.entries()) {
    const chosen = choiceList(raw[slot], text.questions.length)
    if (!chosen) return undefined
    result.push(chosen)
  }
  return result
}

const answered = (chosen: Array<Array<number | null>>) => chosen.every(text => text.every(choice => choice !== null))
const touched = (chosen: Array<Array<number | null>>) => chosen.some(text => text.some(choice => choice !== null))

export function sanitizeBookTestDraft(raw: unknown, test: BookTest, now = Date.now()): BookTestDraft | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as Partial<BookTestDraft>
  if (value.version !== 3 || value.book !== test.book || value.attempt !== test.attempt) return undefined
  if (value.signature !== bookTestSignature(test)) return undefined
  if (typeof value.updatedAt !== 'number' || now - value.updatedAt > MAX_AGE_MS || value.updatedAt - now > 5 * 60 * 1000) return undefined
  if (!value.section || !BOOK_TEST_SECTIONS.includes(value.section)) return undefined
  const answers = value.answers
  if (!answers || typeof answers !== 'object') return undefined

  const translation = stringList(answers.translation, test.translation.length, typed => typed.length <= MAX_TYPED_LENGTH)
  const listeningWords = stringList(answers.listeningWords, test.listeningWords.length, (chosen, index) =>
    chosen === '' || test.listeningWords[index].options.some(option => option.id === chosen))
  const reading = textChoices(answers.reading, test.reading)
  const listening = textChoices(answers.listening, test.listening)
  if (!translation || !listeningWords || !reading || !listening) return undefined
  const heard = value.listeningHeard
  if (!Array.isArray(heard) || heard.length !== test.listening.length || heard.some(item => typeof item !== 'boolean')) return undefined
  const textCount = value.section === 'reading' ? test.reading.length : value.section === 'listening' ? test.listening.length : 1
  const textIndex = value.textIndex
  if (typeof textIndex !== 'number' || !Number.isInteger(textIndex) || textIndex < 0 || textIndex >= textCount) return undefined

  // Sections are taken in order: everything before the current one is done,
  // nothing after it has started. Explore mode (`jumped`) may open them in
  // any order.
  const jumped = value.jumped === true
  const sectionIndex = BOOK_TEST_SECTIONS.indexOf(value.section)
  const complete: Record<BookTestSection, boolean> = {
    translation: translation.length === test.translation.length,
    listeningWords: listeningWords.length === test.listeningWords.length,
    reading: answered(reading),
    listening: answered(listening),
  }
  const started: Record<BookTestSection, boolean> = {
    translation: translation.length > 0,
    listeningWords: listeningWords.length > 0,
    reading: touched(reading),
    listening: touched(listening),
  }
  for (const [index, section] of BOOK_TEST_SECTIONS.entries()) {
    if (jumped) break
    if (index < sectionIndex && !complete[section]) return undefined
    if (index > sectionIndex && started[section]) return undefined
  }
  // A listening text's questions open only after it was heard in full.
  if (listening.some((chosen, slot) => !heard[slot] && chosen.some(choice => choice !== null))) return undefined
  // In order, the texts of a section before the current one are answered.
  if (!jumped && (value.section === 'reading' || value.section === 'listening')) {
    const chosen = value.section === 'reading' ? reading : listening
    if (chosen.slice(0, textIndex).some(text => text.some(choice => choice === null))) return undefined
  }

  const timings: Record<string, number> = {}
  if (value.timings && typeof value.timings === 'object' && !Array.isArray(value.timings)) {
    for (const [key, ms] of Object.entries(value.timings as Record<string, unknown>)) {
      if (/^(translation|listeningWords):\d+$/.test(key) && typeof ms === 'number' && Number.isFinite(ms) && ms > 0) timings[key] = ms
    }
  }

  return {
    version: 3,
    book: test.book,
    attempt: test.attempt,
    signature: value.signature,
    words: wordsOf(test),
    section: value.section,
    textIndex,
    answers: { translation: [...translation], listeningWords: [...listeningWords], reading, listening },
    timings,
    listeningHeard: [...heard],
    ...(jumped ? { jumped: true as const } : {}),
    updatedAt: value.updatedAt,
  }
}

function wordsOf(test: BookTest): BookTestDraft['words'] {
  return { translation: test.translation.map(item => item.wordId), listeningWords: test.listeningWords.map(item => item.wordId) }
}

/** The test of an unfinished attempt, rebuilt from its saved words. */
export function savedBookTest(book: number, attempt: number, now = Date.now()): BookTest | undefined {
  if (typeof localStorage === 'undefined') return undefined
  try {
    const raw = localStorage.getItem(storageKey(book))
    if (!raw) return undefined
    const value = JSON.parse(raw) as Partial<BookTestDraft>
    if (value.version !== 3 || value.book !== book || value.attempt !== attempt || !value.words) return undefined
    const test = bookTestFromWords(book, attempt, value.words.translation, value.words.listeningWords)
    return test && sanitizeBookTestDraft(value, test, now) ? test : undefined
  } catch {
    return undefined
  }
}

export function loadBookTestDraft(test: BookTest, now = Date.now()): BookTestDraft | undefined {
  if (typeof localStorage === 'undefined') return undefined
  try {
    const raw = localStorage.getItem(storageKey(test.book))
    if (!raw) return undefined
    const draft = sanitizeBookTestDraft(JSON.parse(raw), test, now)
    if (!draft) localStorage.removeItem(storageKey(test.book))
    return draft
  } catch {
    return undefined
  }
}

export function saveBookTestDraft(
  test: BookTest,
  progress: Pick<BookTestDraft, 'section' | 'textIndex' | 'answers' | 'timings' | 'listeningHeard' | 'jumped'>,
  now = Date.now(),
): void {
  if (typeof localStorage === 'undefined') return
  const draft = sanitizeBookTestDraft({
    version: 3,
    book: test.book,
    attempt: test.attempt,
    signature: bookTestSignature(test),
    ...progress,
    updatedAt: now,
  }, test, now)
  try {
    if (draft) localStorage.setItem(storageKey(test.book), JSON.stringify(draft))
    else localStorage.removeItem(storageKey(test.book))
  } catch {
    // Resume is optional resilience only.
  }
}

export function clearBookTestDraft(book: number): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(storageKey(book))
  } catch {
    // Resume is optional resilience only.
  }
}
