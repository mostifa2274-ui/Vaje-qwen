import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearReviewDraft,
  loadReviewDraft,
  sanitizeReviewDraft,
  saveReviewDraft,
  type ReviewDraft,
} from './reviewDraft'

const sessionMem = new Map<string, string>()
globalThis.sessionStorage = {
  getItem: (key: string) => sessionMem.get(key) ?? null,
  setItem: (key: string, value: string) => void sessionMem.set(key, value),
  removeItem: (key: string) => void sessionMem.delete(key),
  clear: () => sessionMem.clear(),
  key: (index: number) => [...sessionMem.keys()][index] ?? null,
  get length() { return sessionMem.size },
} as Storage

const IDS = ['cat', 'dog', 'bird'] as const
const NOW = 1_900_000_000_000

function draft(overrides: Partial<ReviewDraft> = {}): ReviewDraft {
  return {
    version: 1,
    kind: 'due',
    queue: ['cat', 'dog', 'bird'],
    sessionTotal: 3,
    completed: 0,
    correctCount: 0,
    relearnedCount: 0,
    attemptNumber: {},
    feedback: null,
    selected: '',
    typed: '',
    updatedAt: NOW,
    ...overrides,
  }
}

describe('review session drafts', () => {
  beforeEach(() => sessionStorage.clear())

  it('round-trips an unanswered in-progress card', () => {
    const value = draft({ typed: 'ca' })
    expect(saveReviewDraft(value, IDS, NOW)).toBe(true)

    const loaded = loadReviewDraft(IDS, NOW)
    expect(loaded?.queue).toEqual(['cat', 'dog', 'bird'])
    expect(loaded?.typed).toBe('ca')
    expect(loaded?.completed).toBe(0)
  })

  it('settles an already-recorded correct card so reload cannot count it twice', () => {
    const normalized = sanitizeReviewDraft(draft({
      feedback: 'correct',
      correctCount: 1,
      selected: 'cat',
    }), IDS, NOW)

    expect(normalized?.queue).toEqual(['dog', 'bird'])
    expect(normalized?.completed).toBe(1)
    expect(normalized?.correctCount).toBe(1)
    expect(normalized?.attemptNumber).toEqual({ cat: 1 })
    expect(normalized?.feedback).toBeNull()
    expect(normalized?.selected).toBe('')
  })

  it('settles an already-recorded wrong card by moving it to the end', () => {
    const normalized = sanitizeReviewDraft(draft({
      feedback: 'wrong',
      typed: 'wrong answer',
    }), IDS, NOW)

    expect(normalized?.queue).toEqual(['dog', 'bird', 'cat'])
    expect(normalized?.completed).toBe(0)
    expect(normalized?.attemptNumber).toEqual({ cat: 1 })
    expect(normalized?.feedback).toBeNull()
    expect(normalized?.typed).toBe('')
  })

  it('preserves relearn attempt counts when a wrong card is revisited', () => {
    const normalized = sanitizeReviewDraft(draft({
      queue: ['cat', 'dog'],
      sessionTotal: 3,
      completed: 1,
      correctCount: 1,
      attemptNumber: { cat: 1, bird: 1 },
      feedback: 'wrong',
    }), IDS, NOW)

    expect(normalized?.queue).toEqual(['dog', 'cat'])
    expect(normalized?.completed).toBe(1)
    expect(normalized?.attemptNumber.cat).toBe(2)
  })

  it('rejects unknown queue ids, duplicate ids, and inconsistent session totals', () => {
    expect(sanitizeReviewDraft(draft({ queue: ['cat', 'injected', 'bird'] }), IDS, NOW)).toBeUndefined()
    expect(sanitizeReviewDraft(draft({ queue: ['cat', 'cat', 'bird'] }), IDS, NOW)).toBeUndefined()
    expect(sanitizeReviewDraft(draft({ sessionTotal: 2 }), IDS, NOW)).toBeUndefined()
  })

  it('rejects inconsistent correct counters around pending feedback', () => {
    expect(sanitizeReviewDraft(draft({ correctCount: 1 }), IDS, NOW)).toBeUndefined()
    expect(sanitizeReviewDraft(draft({ feedback: 'correct', correctCount: 0 }), IDS, NOW)).toBeUndefined()
  })

  it('expires stale sessions instead of reviving an old due queue', () => {
    const stale = draft({ updatedAt: NOW - (13 * 60 * 60 * 1000) })
    expect(sanitizeReviewDraft(stale, IDS, NOW)).toBeUndefined()
  })

  it('clears persisted review recovery state', () => {
    expect(saveReviewDraft(draft({ typed: 'c' }), IDS, NOW)).toBe(true)
    clearReviewDraft()
    expect(loadReviewDraft(IDS, NOW)).toBeUndefined()
  })
})
