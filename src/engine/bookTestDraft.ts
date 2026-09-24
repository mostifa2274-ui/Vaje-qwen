import { BOOK_TEST_SECTIONS, bookTestSignature, type BookTest, type BookTestAnswers, type BookTestSection } from './bookTest'

// Session-only resume for an unfinished end-of-book test, like the other drafts.
export interface BookTestDraft {
  version: 1
  book: number
  attempt: number
  signature: string
  section: BookTestSection
  answers: BookTestAnswers
  timings: Record<string, number>
  /** The listening text has been heard in full at least once. */
  listeningHeard: boolean
  updatedAt: number
}

const PREFIX = 'ghesse:book-test:v1:'
const MAX_AGE_MS = 24 * 60 * 60 * 1000
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
  return raw as Array<number | null>
}

export function sanitizeBookTestDraft(raw: unknown, test: BookTest, now = Date.now()): BookTestDraft | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as Partial<BookTestDraft>
  if (value.version !== 1 || value.book !== test.book || value.attempt !== test.attempt) return undefined
  if (value.signature !== bookTestSignature(test)) return undefined
  if (typeof value.updatedAt !== 'number' || now - value.updatedAt > MAX_AGE_MS || value.updatedAt - now > 5 * 60 * 1000) return undefined
  if (!value.section || !BOOK_TEST_SECTIONS.includes(value.section)) return undefined
  const answers = value.answers
  if (!answers || typeof answers !== 'object') return undefined

  const translation = stringList(answers.translation, test.translation.length, typed => typed.length <= MAX_TYPED_LENGTH)
  const listeningWords = stringList(answers.listeningWords, test.listeningWords.length, (chosen, index) =>
    chosen === '' || test.listeningWords[index].options.some(option => option.id === chosen))
  const reading = choiceList(answers.reading, test.reading.questions.length)
  const listening = choiceList(answers.listening, test.listening.questions.length)
  if (!translation || !listeningWords || !reading || !listening) return undefined

  // Sections are taken in order: everything before the current one is done,
  // nothing after it has started.
  const sectionIndex = BOOK_TEST_SECTIONS.indexOf(value.section)
  const complete: Record<BookTestSection, boolean> = {
    translation: translation.length === test.translation.length,
    listeningWords: listeningWords.length === test.listeningWords.length,
    reading: reading.every(choice => choice !== null),
    listening: listening.every(choice => choice !== null),
  }
  const started: Record<BookTestSection, boolean> = {
    translation: translation.length > 0,
    listeningWords: listeningWords.length > 0,
    reading: reading.some(choice => choice !== null),
    listening: listening.some(choice => choice !== null),
  }
  for (const [index, section] of BOOK_TEST_SECTIONS.entries()) {
    if (index < sectionIndex && !complete[section]) return undefined
    if (index > sectionIndex && started[section]) return undefined
  }
  if (value.section === 'listening' && started.listening && value.listeningHeard !== true) return undefined

  const timings: Record<string, number> = {}
  if (value.timings && typeof value.timings === 'object' && !Array.isArray(value.timings)) {
    for (const [key, ms] of Object.entries(value.timings as Record<string, unknown>)) {
      if (/^(translation|listeningWords):\d+$/.test(key) && typeof ms === 'number' && Number.isFinite(ms) && ms > 0) timings[key] = ms
    }
  }

  return {
    version: 1,
    book: test.book,
    attempt: test.attempt,
    signature: value.signature,
    section: value.section,
    answers: { translation: [...translation], listeningWords: [...listeningWords], reading: [...reading], listening: [...listening] },
    timings,
    listeningHeard: value.listeningHeard === true,
    updatedAt: value.updatedAt,
  }
}

export function loadBookTestDraft(test: BookTest, now = Date.now()): BookTestDraft | undefined {
  if (typeof sessionStorage === 'undefined') return undefined
  try {
    const raw = sessionStorage.getItem(storageKey(test.book))
    if (!raw) return undefined
    const draft = sanitizeBookTestDraft(JSON.parse(raw), test, now)
    if (!draft) sessionStorage.removeItem(storageKey(test.book))
    return draft
  } catch {
    return undefined
  }
}

export function saveBookTestDraft(
  test: BookTest,
  progress: Pick<BookTestDraft, 'section' | 'answers' | 'timings' | 'listeningHeard'>,
  now = Date.now(),
): void {
  if (typeof sessionStorage === 'undefined') return
  const draft = sanitizeBookTestDraft({
    version: 1,
    book: test.book,
    attempt: test.attempt,
    signature: bookTestSignature(test),
    ...progress,
    updatedAt: now,
  }, test, now)
  try {
    if (draft) sessionStorage.setItem(storageKey(test.book), JSON.stringify(draft))
    else sessionStorage.removeItem(storageKey(test.book))
  } catch {
    // Resume is optional resilience only.
  }
}

export function clearBookTestDraft(book: number): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(storageKey(book))
  } catch {
    // Resume is optional resilience only.
  }
}
