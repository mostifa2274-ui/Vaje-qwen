export type ReviewFeedback = 'correct' | 'wrong' | null
export type ReviewSessionKind = 'remediation' | 'due' | 'trouble' | 'extra'

export interface ReviewDraft {
  version: 1
  kind: ReviewSessionKind
  queue: string[]
  sessionTotal: number
  completed: number
  correctCount: number
  relearnedCount: number
  attemptNumber: Record<string, number>
  feedback: ReviewFeedback
  selected: string
  typed: string
  updatedAt: number
}

const STORAGE_KEY = 'ghesse:review:v1'
const MAX_TEXT = 300
const MAX_AGE_MS = 12 * 60 * 60 * 1000

function isKind(value: unknown): value is ReviewSessionKind {
  return value === 'remediation' || value === 'due' || value === 'trouble' || value === 'extra'
}

function isFeedback(value: unknown): value is ReviewFeedback {
  return value === null || value === 'correct' || value === 'wrong'
}

function safeCount(value: unknown, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) return undefined
  return value
}

function safeQueue(value: unknown, allowed: ReadonlySet<string>): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const result: string[] = []
  const seen = new Set<string>()
  for (const id of value) {
    if (typeof id !== 'string' || !allowed.has(id) || seen.has(id)) return undefined
    seen.add(id)
    result.push(id)
  }
  return result
}

function safeAttempts(value: unknown, allowed: ReadonlySet<string>): Record<string, number> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const result: Record<string, number> = {}
  for (const [id, attempts] of Object.entries(value as Record<string, unknown>)) {
    if (!allowed.has(id) || typeof attempts !== 'number' || !Number.isInteger(attempts) || attempts < 0 || attempts > 100) {
      return undefined
    }
    if (attempts > 0) result[id] = attempts
  }
  return result
}

/**
 * Review retrieval evidence is written to permanent word progress as soon as an
 * answer is graded. A persisted draft with feedback therefore represents an
 * already-recorded card waiting for the learner to tap "next".
 *
 * Sanitization settles that transition immediately. This prevents a reload
 * between feedback and "next" from grading the same retrieval a second time.
 */
export function sanitizeReviewDraft(
  raw: unknown,
  introducedWordIds: readonly string[],
  now = Date.now(),
): ReviewDraft | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as Partial<ReviewDraft>
  if (value.version !== 1 || !isKind(value.kind) || !isFeedback(value.feedback)) return undefined

  const allowed = new Set(introducedWordIds)
  if (allowed.size === 0) return undefined

  const sessionTotal = safeCount(value.sessionTotal, allowed.size)
  if (!sessionTotal || sessionTotal < 1) return undefined
  let completed = safeCount(value.completed, sessionTotal)
  let correctCount = safeCount(value.correctCount, sessionTotal)
  let relearnedCount = safeCount(value.relearnedCount, sessionTotal)
  let queue = safeQueue(value.queue, allowed)
  const attemptNumber = safeAttempts(value.attemptNumber, allowed)
  if (completed === undefined || correctCount === undefined || relearnedCount === undefined || !queue || !attemptNumber) return undefined
  if (completed + queue.length !== sessionTotal) return undefined

  const updatedAt = typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) && value.updatedAt > 0
    ? value.updatedAt
    : now
  if (now - updatedAt > MAX_AGE_MS || updatedAt - now > 5 * 60 * 1000) return undefined

  const expectedCorrectTotal = completed + (value.feedback === 'correct' ? 1 : 0)
  if (correctCount + relearnedCount !== expectedCorrectTotal) return undefined

  const selected = typeof value.selected === 'string' ? value.selected.slice(0, MAX_TEXT) : ''
  const typed = typeof value.typed === 'string' ? value.typed.slice(0, MAX_TEXT) : ''

  if (value.feedback) {
    const currentId = queue[0]
    if (!currentId) return undefined
    const rest = queue.slice(1)
    attemptNumber[currentId] = (attemptNumber[currentId] ?? 0) + 1
    if (value.feedback === 'correct') {
      completed += 1
      queue = rest
    } else {
      queue = [...rest, currentId]
    }
  }

  return {
    version: 1,
    kind: value.kind,
    queue,
    sessionTotal,
    completed,
    correctCount,
    relearnedCount,
    attemptNumber,
    feedback: null,
    selected: value.feedback ? '' : selected,
    typed: value.feedback ? '' : typed,
    updatedAt,
  }
}

export function loadReviewDraft(introducedWordIds: readonly string[], now = Date.now()): ReviewDraft | undefined {
  if (typeof sessionStorage === 'undefined') return undefined
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as unknown
    const draft = sanitizeReviewDraft(parsed, introducedWordIds, now)
    if (!draft) sessionStorage.removeItem(STORAGE_KEY)
    return draft
  } catch {
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // Optional session recovery only.
    }
    return undefined
  }
}

export function saveReviewDraft(
  draft: ReviewDraft,
  introducedWordIds: readonly string[],
  now = Date.now(),
): boolean {
  if (typeof sessionStorage === 'undefined') return false
  const normalized = sanitizeReviewDraft(draft, introducedWordIds, now)
  if (!normalized) return false
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    return true
  } catch {
    return false
  }
}

export function clearReviewDraft(): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Review recovery is optional and must never block learning.
  }
}
