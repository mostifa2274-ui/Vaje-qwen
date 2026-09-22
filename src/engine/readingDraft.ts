import type { ReadingQuestion } from './comprehension'

export interface ReadingDraft {
  version: 1
  chapterId: string
  signature: string
  checkIndex: number
  answers: Record<number, string>
  firstPassCorrect?: number
  updatedAt: number
}

const PREFIX = 'ghesse:reading-check:v1:'
const MAX_AGE_MS = 24 * 60 * 60 * 1000

function storageKey(chapterId: string): string {
  return `${PREFIX}${chapterId}`
}

export function readingQuestionSignature(questions: readonly ReadingQuestion[]): string {
  return JSON.stringify(questions.map(question => [
    question.id,
    question.prompt,
    question.context ?? '',
    question.answerId,
    question.options.map(option => [option.id, option.label]),
  ]))
}

function safeAnswers(
  raw: unknown,
  checkIndex: number,
  questions: readonly ReadingQuestion[],
  correctionMode: boolean,
): Record<number, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const answers: Record<number, string> = {}

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const index = Number(key)
    if (!Number.isInteger(index) || index < 0 || index >= questions.length || typeof value !== 'string') return undefined
    if (!correctionMode && index > checkIndex) return undefined
    const question = questions[index]
    if (!question || !question.options.some(option => option.id === value)) return undefined
    if (correctionMode && index !== checkIndex && value !== question.answerId) return undefined
    answers[index] = value
  }

  // All questions before the active question must already be answered. In a
  // correction round they must also already be corrected.
  for (let index = 0; index < checkIndex; index++) {
    if (typeof answers[index] !== 'string') return undefined
    if (correctionMode && answers[index] !== questions[index].answerId) return undefined
  }
  return answers
}

export function sanitizeReadingDraft(
  raw: unknown,
  chapterId: string,
  questions: readonly ReadingQuestion[],
  now = Date.now(),
): ReadingDraft | undefined {
  if (!raw || typeof raw !== 'object' || questions.length === 0) return undefined
  const value = raw as Partial<ReadingDraft>
  if (value.version !== 1 || value.chapterId !== chapterId) return undefined
  if (value.signature !== readingQuestionSignature(questions)) return undefined

  if (
    typeof value.checkIndex !== 'number'
    || !Number.isInteger(value.checkIndex)
    || value.checkIndex < 0
    || value.checkIndex >= questions.length
  ) return undefined

  let firstPassCorrect: number | undefined
  if (value.firstPassCorrect !== undefined) {
    if (
      typeof value.firstPassCorrect !== 'number'
      || !Number.isInteger(value.firstPassCorrect)
      || value.firstPassCorrect < 0
      || value.firstPassCorrect >= questions.length
    ) return undefined
    firstPassCorrect = value.firstPassCorrect
  }

  const correctionMode = firstPassCorrect !== undefined
  const answers = safeAnswers(value.answers, value.checkIndex, questions, correctionMode)
  if (!answers) return undefined

  if (correctionMode) {
    const currentCorrect = questions.reduce(
      (sum, question, index) => sum + (answers[index] === question.answerId ? 1 : 0),
      0,
    )
    if (currentCorrect < firstPassCorrect) return undefined
  }

  const updatedAt = typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) && value.updatedAt > 0
    ? value.updatedAt
    : now
  if (now - updatedAt > MAX_AGE_MS || updatedAt - now > 5 * 60 * 1000) return undefined

  return {
    version: 1,
    chapterId,
    signature: value.signature,
    checkIndex: value.checkIndex,
    answers,
    firstPassCorrect,
    updatedAt,
  }
}

export function loadReadingDraft(
  chapterId: string,
  questions: readonly ReadingQuestion[],
  now = Date.now(),
): ReadingDraft | undefined {
  if (typeof sessionStorage === 'undefined') return undefined
  try {
    const raw = sessionStorage.getItem(storageKey(chapterId))
    if (!raw) return undefined
    const draft = sanitizeReadingDraft(JSON.parse(raw) as unknown, chapterId, questions, now)
    if (!draft) sessionStorage.removeItem(storageKey(chapterId))
    return draft
  } catch {
    try {
      sessionStorage.removeItem(storageKey(chapterId))
    } catch {
      // Optional reader recovery only.
    }
    return undefined
  }
}

export function saveReadingDraft(
  draft: ReadingDraft,
  questions: readonly ReadingQuestion[],
  now = Date.now(),
): boolean {
  if (typeof sessionStorage === 'undefined') return false
  const normalized = sanitizeReadingDraft(draft, draft.chapterId, questions, now)
  if (!normalized) return false
  try {
    sessionStorage.setItem(storageKey(draft.chapterId), JSON.stringify(normalized))
    return true
  } catch {
    return false
  }
}

export function clearReadingDraft(chapterId: string): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(storageKey(chapterId))
  } catch {
    // Reader recovery is optional and must never block chapter completion.
  }
}
