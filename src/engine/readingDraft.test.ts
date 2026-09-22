import { beforeEach, describe, expect, it } from 'vitest'
import type { ReadingQuestion } from './comprehension'
import {
  clearReadingDraft,
  loadReadingDraft,
  readingQuestionSignature,
  sanitizeReadingDraft,
  saveReadingDraft,
  type ReadingDraft,
} from './readingDraft'

const sessionMem = new Map<string, string>()
globalThis.sessionStorage = {
  getItem: (key: string) => sessionMem.get(key) ?? null,
  setItem: (key: string, value: string) => void sessionMem.set(key, value),
  removeItem: (key: string) => void sessionMem.delete(key),
  clear: () => sessionMem.clear(),
  key: (index: number) => [...sessionMem.keys()][index] ?? null,
  get length() { return sessionMem.size },
} as Storage

const NOW = 1_900_000_000_000

function questions(): ReadingQuestion[] {
  return Array.from({ length: 3 }, (_, index) => ({
    id: `q-${index}`,
    prompt: `prompt-${index}`,
    context: index === 1 ? 'context' : undefined,
    contextDir: index === 1 ? 'ltr' as const : undefined,
    optionDir: 'ltr' as const,
    options: Array.from({ length: 4 }, (_, optionIndex) => ({
      id: `q-${index}-o-${optionIndex}`,
      label: `option-${index}-${optionIndex}`,
    })),
    answerId: `q-${index}-o-0`,
    evidenceWordId: index < 2 ? `word-${index}` : undefined,
  }))
}

function draft(qs: ReadingQuestion[], overrides: Partial<ReadingDraft> = {}): ReadingDraft {
  return {
    version: 1,
    chapterId: 'b1c1',
    signature: readingQuestionSignature(qs),
    checkIndex: 1,
    answers: { 0: 'q-0-o-0' },
    updatedAt: NOW,
    ...overrides,
  }
}

describe('reading comprehension drafts', () => {
  beforeEach(() => sessionStorage.clear())

  it('round-trips an unanswered active question', () => {
    const qs = questions()
    expect(saveReadingDraft(draft(qs), qs, NOW)).toBe(true)
    const loaded = loadReadingDraft('b1c1', qs, NOW)
    expect(loaded?.checkIndex).toBe(1)
    expect(loaded?.answers).toEqual({ 0: 'q-0-o-0' })
  })

  it('restores an answered active question in feedback state', () => {
    const qs = questions()
    const normalized = sanitizeReadingDraft(draft(qs, {
      checkIndex: 1,
      answers: {
        0: 'q-0-o-0',
        1: 'q-1-o-2',
      },
    }), 'b1c1', qs, NOW)

    expect(normalized?.checkIndex).toBe(1)
    expect(normalized?.answers[1]).toBe('q-1-o-2')
  })

  it('rejects a changed question bank signature', () => {
    const qs = questions()
    const changed = questions()
    changed[1] = { ...changed[1], prompt: 'changed prompt' }

    expect(sanitizeReadingDraft(draft(qs), 'b1c1', changed, NOW)).toBeUndefined()
  })

  it('rejects an option id that is not part of the regenerated question', () => {
    const qs = questions()
    expect(sanitizeReadingDraft(draft(qs, {
      answers: { 0: 'injected-option' },
    }), 'b1c1', qs, NOW)).toBeUndefined()
  })

  it('rejects non-sequential progress that skips an earlier question', () => {
    const qs = questions()
    expect(sanitizeReadingDraft(draft(qs, {
      checkIndex: 2,
      answers: { 1: 'q-1-o-0' },
    }), 'b1c1', qs, NOW)).toBeUndefined()
  })

  it('restores a correction round with later already-correct questions intact', () => {
    const qs = questions()
    const normalized = sanitizeReadingDraft(draft(qs, {
      checkIndex: 1,
      firstPassCorrect: 2,
      answers: {
        0: 'q-0-o-0',
        2: 'q-2-o-0',
      },
    }), 'b1c1', qs, NOW)

    expect(normalized?.firstPassCorrect).toBe(2)
    expect(normalized?.checkIndex).toBe(1)
    expect(normalized?.answers).toEqual({
      0: 'q-0-o-0',
      2: 'q-2-o-0',
    })
  })

  it('rejects a correction draft that stores an incorrect future answer', () => {
    const qs = questions()
    expect(sanitizeReadingDraft(draft(qs, {
      checkIndex: 1,
      firstPassCorrect: 1,
      answers: {
        0: 'q-0-o-0',
        2: 'q-2-o-2',
      },
    }), 'b1c1', qs, NOW)).toBeUndefined()
  })

  it('rejects an impossible first-pass score in correction mode', () => {
    const qs = questions()
    expect(sanitizeReadingDraft(draft(qs, {
      checkIndex: 1,
      firstPassCorrect: 3,
    }), 'b1c1', qs, NOW)).toBeUndefined()
  })

  it('rejects another chapter and stale drafts', () => {
    const qs = questions()
    expect(sanitizeReadingDraft(draft(qs, { chapterId: 'b1c2' }), 'b1c1', qs, NOW)).toBeUndefined()
    expect(sanitizeReadingDraft(draft(qs, {
      updatedAt: NOW - (25 * 60 * 60 * 1000),
    }), 'b1c1', qs, NOW)).toBeUndefined()
  })

  it('clears persisted reading recovery state', () => {
    const qs = questions()
    expect(saveReadingDraft(draft(qs), qs, NOW)).toBe(true)
    clearReadingDraft('b1c1')
    expect(loadReadingDraft('b1c1', qs, NOW)).toBeUndefined()
  })
})
