import { beforeEach, describe, expect, it } from 'vitest'
import { clearPrepDraft, loadPrepDraft, sanitizePrepDraft, savePrepDraft, type PrepDraft } from './prepDraft'

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

function draft(overrides: Partial<PrepDraft> = {}): PrepDraft {
  return {
    version: 1,
    chapterId: 'b1c1',
    phase: 'written',
    teachIndex: 1,
    writtenQueue: ['dog', 'bird'],
    writtenPassed: ['cat'],
    writtenMissed: [],
    listeningQueue: [],
    listeningPassed: [],
    listeningMissed: [],
    feedback: null,
    selected: '',
    typed: '',
    updatedAt: 100,
    ...overrides,
  }
}

describe('chapter preparation drafts', () => {
  beforeEach(() => sessionStorage.clear())

  it('filters unknown and duplicate ids and clamps teach index', () => {
    const normalized = sanitizePrepDraft({
      ...draft(),
      teachIndex: 999,
      writtenQueue: ['dog', 'dog', 'injected', 'cat'],
      writtenPassed: ['cat', 'injected', 'cat'],
      writtenMissed: ['dog', 'injected'],
    }, 'b1c1', IDS)

    expect(normalized?.teachIndex).toBe(2)
    expect(normalized?.writtenPassed).toEqual(['cat'])
    expect(normalized?.writtenQueue).toEqual(['dog'])
    expect(normalized?.writtenMissed).toEqual(['dog'])
  })

  it('rebuilds an empty incomplete written queue instead of treating it as completion', () => {
    const normalized = sanitizePrepDraft(draft({
      phase: 'written',
      writtenQueue: [],
      writtenPassed: ['cat'],
    }), 'b1c1', IDS)

    expect(normalized?.writtenQueue).toEqual(['dog', 'bird'])
  })

  it('rebuilds an empty incomplete listening queue instead of treating it as completion', () => {
    const normalized = sanitizePrepDraft(draft({
      phase: 'listening',
      writtenQueue: [],
      writtenPassed: [...IDS],
      listeningQueue: [],
      listeningPassed: ['cat', 'bird'],
    }), 'b1c1', IDS)

    expect(normalized?.listeningQueue).toEqual(['dog'])
  })

  it('rejects a draft for another chapter or an invalid phase', () => {
    expect(sanitizePrepDraft(draft({ chapterId: 'b1c2' }), 'b1c1', IDS)).toBeUndefined()
    expect(sanitizePrepDraft({ ...draft(), phase: 'finished' }, 'b1c1', IDS)).toBeUndefined()
  })

  it('round-trips a validated session draft and clears it', () => {
    const value = draft({
      phase: 'listening',
      writtenQueue: [],
      writtenPassed: [...IDS],
      listeningQueue: ['dog', 'bird'],
      listeningPassed: ['cat'],
      listeningMissed: ['dog'],
      feedback: 'wrong',
      selected: 'fish',
      typed: 'گربه',
    })

    expect(savePrepDraft(value, IDS)).toBe(true)
    const loaded = loadPrepDraft('b1c1', IDS)
    expect(loaded?.phase).toBe('listening')
    expect(loaded?.writtenPassed).toEqual(IDS)
    expect(loaded?.listeningPassed).toEqual(['cat'])
    expect(loaded?.listeningQueue).toEqual(['dog', 'bird'])
    expect(loaded?.feedback).toBe('wrong')
    expect(loaded?.typed).toBe('گربه')

    clearPrepDraft('b1c1')
    expect(loadPrepDraft('b1c1', IDS)).toBeUndefined()
  })
})
