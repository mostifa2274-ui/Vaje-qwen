import { storyTestSignature, type StoryTest } from './storyTest'

// Session-only resume for an unfinished book story test, like the other drafts.
export interface StoryTestDraft {
  version: 1
  book: number
  attempt: number
  signature: string
  index: number
  answers: Record<number, string>
  updatedAt: number
}

const PREFIX = 'ghesse:story-test:v1:'
const MAX_AGE_MS = 24 * 60 * 60 * 1000

function storageKey(book: number): string {
  return `${PREFIX}${book}`
}

export function sanitizeStoryTestDraft(raw: unknown, test: StoryTest, now = Date.now()): StoryTestDraft | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as Partial<StoryTestDraft>
  if (value.version !== 1 || value.book !== test.book || value.attempt !== test.attempt) return undefined
  if (value.signature !== storyTestSignature(test)) return undefined
  if (typeof value.updatedAt !== 'number' || now - value.updatedAt > MAX_AGE_MS || value.updatedAt - now > 5 * 60 * 1000) return undefined
  if (!value.answers || typeof value.answers !== 'object' || Array.isArray(value.answers)) return undefined

  const answers: Record<number, string> = {}
  for (const [key, optionId] of Object.entries(value.answers as Record<string, unknown>)) {
    const index = Number(key)
    const question = test.questions[index]
    if (!Number.isInteger(index) || !question || typeof optionId !== 'string') return undefined
    if (!question.options.some(option => option.id === optionId)) return undefined
    answers[index] = optionId
  }
  const answered = Object.keys(answers).length
  // Answers fill the test from the start; a finished test is never a draft.
  if (answered >= test.questions.length) return undefined
  for (let index = 0; index < answered; index++) if (answers[index] === undefined) return undefined

  const index = typeof value.index === 'number' && Number.isInteger(value.index)
    ? Math.min(Math.max(0, value.index), answered)
    : answered
  return { version: 1, book: test.book, attempt: test.attempt, signature: value.signature, index, answers, updatedAt: value.updatedAt }
}

export function loadStoryTestDraft(test: StoryTest, now = Date.now()): StoryTestDraft | undefined {
  if (typeof sessionStorage === 'undefined') return undefined
  try {
    const raw = sessionStorage.getItem(storageKey(test.book))
    if (!raw) return undefined
    const draft = sanitizeStoryTestDraft(JSON.parse(raw), test, now)
    if (!draft) sessionStorage.removeItem(storageKey(test.book))
    return draft
  } catch {
    return undefined
  }
}

export function saveStoryTestDraft(test: StoryTest, index: number, answers: Record<number, string>, now = Date.now()): void {
  if (typeof sessionStorage === 'undefined') return
  const draft = sanitizeStoryTestDraft({
    version: 1,
    book: test.book,
    attempt: test.attempt,
    signature: storyTestSignature(test),
    index,
    answers,
    updatedAt: now,
  }, test, now)
  try {
    if (draft) sessionStorage.setItem(storageKey(test.book), JSON.stringify(draft))
    else sessionStorage.removeItem(storageKey(test.book))
  } catch {
    // Resume is optional resilience only.
  }
}

export function clearStoryTestDraft(book: number): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(storageKey(book))
  } catch {
    // Resume is optional resilience only.
  }
}
