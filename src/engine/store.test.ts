import { beforeEach, describe, expect, it } from 'vitest'

function memoryStorage(): Storage {
  const mem = new Map<string, string>()
  return {
    getItem: (key: string) => mem.get(key) ?? null,
    setItem: (key: string, value: string) => void mem.set(key, value),
    removeItem: (key: string) => void mem.delete(key),
    clear: () => mem.clear(),
    key: (index: number) => [...mem.keys()][index] ?? null,
    get length() { return mem.size },
  } as Storage
}

globalThis.localStorage = memoryStorage()
globalThis.sessionStorage = memoryStorage()

import { clearSessionDrafts, emptyState, importStateJson, loadPersistedState, mergeConcurrentState, replacePersistedState, requestDurableStorage, resetState, saveState, summarizeProgress } from './store'

describe('progress replacement', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('drops every in-progress session draft but leaves unrelated keys', () => {
    sessionStorage.setItem('ghesse:prep:v1:b1c1', '{}')
    sessionStorage.setItem('ghesse:reading-check:v1:b1c1', '{}')
    sessionStorage.setItem('ghesse:review:v1', '{}')
    sessionStorage.setItem('ghesse:exam:v1:book-1', '{}')
    sessionStorage.setItem('other-app', 'keep')

    clearSessionDrafts()

    expect(sessionStorage.length).toBe(1)
    expect(sessionStorage.getItem('other-app')).toBe('keep')
  })

  it('constructs reset state without emitting an unmarked storage replacement first', () => {
    const state = emptyState(1, 'b1c1')
    state.chapters.b1c1 = { preparedAt: 2, prepAttempts: 1, completed: true, checksCorrect: 10, checksTotal: 10, reads: 1 }
    expect(saveState(state)).toBe(true)
    sessionStorage.setItem('ghesse:prep:v1:b1c2', '{}')

    const before = localStorage.getItem('ghesse:state:v6')
    const fresh = resetState('b1c1')

    expect(fresh.chapters).toEqual({})
    // App owns the explicit replacement transaction so the authoritative
    // storage event can carry its in-band lineage token from the first write.
    expect(localStorage.getItem('ghesse:state:v6')).toBe(before)
    expect(sessionStorage.getItem('ghesse:prep:v1:b1c2')).not.toBeNull()
  })

  it('repairs a corrupted primary without overwriting the last-known good backup', () => {
    const first = emptyState(1, 'b1c1')
    first.currentChapter = 'b1c1'
    expect(saveState(first)).toBe(true)

    const second = { ...first, currentChapter: 'b1c2' }
    expect(saveState(second)).toBe(true)
    const goodBackup = localStorage.getItem('ghesse:state:v6:backup')
    expect(goodBackup).toContain('"currentChapter":"b1c1"')

    localStorage.setItem('ghesse:state:v6', '{broken')
    const recovered = { ...second, currentChapter: 'b1c3' }
    expect(saveState(recovered)).toBe(true)

    expect(localStorage.getItem('ghesse:state:v6:backup')).toBe(goodBackup)
    expect(localStorage.getItem('ghesse:state:v6')).toContain('"currentChapter":"b1c3"')
  })

  it('falls back from parseable structural corruption and preserves that backup during repair', () => {
    const first = emptyState(1, 'b1c1')
    first.chapters.b1c1 = {
      preparedAt: 2,
      prepAttempts: 1,
      completed: true,
      checksCorrect: 10,
      checksTotal: 10,
      reads: 1,
    }
    expect(saveState(first)).toBe(true)

    const second = { ...first, currentChapter: 'b1c2' }
    expect(saveState(second)).toBe(true)
    const goodBackup = localStorage.getItem('ghesse:state:v6:backup')
    expect(goodBackup).toContain('"completed":true')

    // Valid JSON, but not a recognizable Ghesse state. This must not mask the
    // rolling backup or be promoted into that backup during startup repair.
    localStorage.setItem('ghesse:state:v6', '{}')
    const recovered = loadPersistedState(100, 'b1c1', ['b1c1', 'b1c2'], [])
    expect(recovered?.chapters.b1c1?.completed).toBe(true)
    expect(recovered?.currentChapter).toBe('b1c1')

    expect(saveState(recovered!)).toBe(true)
    expect(localStorage.getItem('ghesse:state:v6:backup')).toBe(goodBackup)
    expect(JSON.parse(localStorage.getItem('ghesse:state:v6') ?? '{}').chapters.b1c1.completed).toBe(true)
  })

  it('explicit replacement aligns primary and backup and discards stale legacy fallbacks', () => {
    const old = emptyState(1, 'b1c1')
    old.chapters.b1c1 = {
      preparedAt: 2,
      prepAttempts: 1,
      completed: true,
      checksCorrect: 10,
      checksTotal: 10,
      reads: 1,
    }
    expect(saveState(old)).toBe(true)

    const newerOld = { ...old, currentChapter: 'b1c2' }
    expect(saveState(newerOld)).toBe(true)
    localStorage.setItem('ghesse:state:v5', JSON.stringify(old))

    const replacement = emptyState(100, 'b1c1')
    replacement.currentChapter = 'b1c2'
    replacement.dailyReviewGoal = 20
    expect(replacePersistedState(replacement)).toBe(true)

    const primary = localStorage.getItem('ghesse:state:v6')
    const backup = localStorage.getItem('ghesse:state:v6:backup')
    expect(primary).toBe(JSON.stringify(replacement))
    expect(backup).toBe(JSON.stringify(replacement))
    expect(localStorage.getItem('ghesse:state:v5')).toBeNull()

    // If the new primary is later damaged, recovery must restore the explicit
    // replacement, never the progress that existed before the replacement.
    localStorage.setItem('ghesse:state:v6', '{}')
    const recovered = loadPersistedState(200, 'b1c1', ['b1c1', 'b1c2'], [])
    expect(recovered?.currentChapter).toBe('b1c2')
    expect(recovered?.dailyReviewGoal).toBe(20)
    expect(recovered?.chapters).toEqual({})
  })

  it('keeps a verified replacement successful when auxiliary cleanup rejects removals', () => {
    const originalStorage = globalThis.localStorage
    const backing = memoryStorage()
    const flakyStorage = {
      getItem: (key: string) => backing.getItem(key),
      setItem: (key: string, value: string) => backing.setItem(key, value),
      removeItem: (key: string) => {
        if (key === 'ghesse:state:v5' || key === 'ghesse:state:v6:backup') {
          throw new DOMException('cleanup blocked', 'SecurityError')
        }
        backing.removeItem(key)
      },
      clear: () => backing.clear(),
      key: (index: number) => backing.key(index),
      get length() { return backing.length },
    } as Storage

    const old = emptyState(1, 'b1c1')
    backing.setItem('ghesse:state:v6', JSON.stringify(old))
    backing.setItem('ghesse:state:v5', JSON.stringify(old))
    backing.setItem('ghesse:state:v6:backup', JSON.stringify(old))

    const replacement = emptyState(100, 'b1c1')
    replacement.currentChapter = 'b1c2'
    replacement.dailyReviewGoal = 20

    globalThis.localStorage = flakyStorage
    try {
      // The primary write is the commit point. Auxiliary cleanup must not make
      // App suppress the replacement marker after that point.
      expect(replacePersistedState(replacement)).toBe(true)
      expect(backing.getItem('ghesse:state:v6')).toBe(JSON.stringify(replacement))
      // When removeItem is blocked but writes work, stale fallbacks are
      // neutralized by overwriting them with the authoritative replacement.
      expect(backing.getItem('ghesse:state:v6:backup')).toBe(JSON.stringify(replacement))
      expect(backing.getItem('ghesse:state:v5')).toBe(JSON.stringify(replacement))
    } finally {
      globalThis.localStorage = originalStorage
    }
  })

  it('summarizes progress for an import confirmation', () => {
    const state = emptyState(1, 'b1c1')
    state.chapters.b1c1 = { preparedAt: 2, prepAttempts: 1, completed: true, checksCorrect: 10, checksTotal: 10, reads: 1 }
    state.chapters.b1c2 = { preparedAt: 3, prepAttempts: 1, completed: false, checksCorrect: 0, checksTotal: 0, reads: 0 }
    state.exams['book-1'] = { attempts: 1, passed: true, lastScore: 0.9, bestScore: 0.9, lastProductiveScore: 1, bestProductiveScore: 1, missedWordIds: [], testedWordIds: [] }

    expect(summarizeProgress(state)).toEqual({ completedChapters: 1, introducedWords: 0, passedExams: 1 })
  })
})


describe('progress import validation', () => {
  const chapters = ['b1c1', 'b1c2']
  const words = ['w1', 'w2']

  it('rejects unrelated JSON instead of converting it into empty progress', () => {
    expect(() => importStateJson(
      JSON.stringify({ version: 6, theme: 'dark', preferences: {} }),
      100,
      'b1c1',
      chapters,
      words,
    )).toThrow('این فایل پشتیبان معتبر قصه نیست.')
  })

  it('rejects backups from an unsupported future state version', () => {
    expect(() => importStateJson(
      JSON.stringify({ version: 99, currentChapter: 'b1c1', chapters: {}, words: {}, exams: {} }),
      100,
      'b1c1',
      chapters,
      words,
    )).toThrow('این فایل پشتیبان معتبر قصه نیست.')
  })

  it('normalizes impossible zero-attempt exam evidence to an unattempted state', () => {
    const imported = importStateJson(
      JSON.stringify({
        version: 6,
        dayEvidenceVersion: 1,
        currentChapter: 'b1c1',
        chapters: {},
        words: { w1: { introduced: true } },
        exams: {
          'book-1': {
            attempts: 0,
            passed: true,
            passedAt: 50,
            lastAttemptAt: 50,
            lastScore: 1,
            bestScore: 1,
            lastProductiveScore: 1,
            bestProductiveScore: 1,
            missedWordIds: ['w1'],
            testedWordIds: ['w1'],
          },
        },
      }),
      100,
      'b1c1',
      chapters,
      words,
    )

    expect(imported.exams['book-1']).toEqual({
      attempts: 0,
      passed: false,
      passedAt: undefined,
      lastAttemptAt: undefined,
      lastScore: 0,
      bestScore: 0,
      lastProductiveScore: 0,
      bestProductiveScore: 0,
      missedWordIds: [],
      testedWordIds: [],
    })
    expect(imported.exams['book-1'].remediationAfter).toBeUndefined()
    expect(summarizeProgress(imported).passedExams).toBe(0)
  })

  it('still accepts a recognizable supported legacy backup', () => {
    const imported = importStateJson(
      JSON.stringify({
        version: 5,
        currentChapter: 'b1c2',
        chapters: {},
        words: { w1: { introduced: true } },
      }),
      100,
      'b1c1',
      chapters,
      words,
    )

    expect(imported.version).toBe(6)
    expect(imported.currentChapter).toBe('b1c2')
    expect(imported.words.w1?.introduced).toBe(true)
  })

  it('preserves only a bounded valid replacement-lineage token on import', () => {
    const valid = importStateJson(
      JSON.stringify({
        version: 6,
        dayEvidenceVersion: 1,
        progressReplacementToken: 'mabc123:lineage',
        currentChapter: 'b1c1',
        chapters: {},
        words: {},
        exams: {},
      }),
      100,
      'b1c1',
      chapters,
      words,
    )
    expect(valid.progressReplacementToken).toBe('mabc123:lineage')

    const invalid = importStateJson(
      JSON.stringify({
        version: 6,
        dayEvidenceVersion: 1,
        progressReplacementToken: '<script>'.repeat(30),
        currentChapter: 'b1c1',
        chapters: {},
        words: {},
        exams: {},
      }),
      100,
      'b1c1',
      chapters,
      words,
    )
    expect(invalid.progressReplacementToken).toBeUndefined()
  })

  it('clamps malformed first-pass acquisition counters during import', () => {
    const state = emptyState(100, 'b1c1')
    state.chapters.b1c1 = {
      preparedAt: 110,
      prepAttempts: 1,
      prepWrittenCorrect: 4,
      prepWrittenTotal: 4,
      prepWrittenFirstPassCorrect: 99,
      prepListeningCorrect: 4,
      prepListeningTotal: 4,
      prepListeningFirstPassCorrect: 99,
      completed: false,
      checksCorrect: 0,
      checksTotal: 0,
      reads: 0,
    }

    const imported = importStateJson(
      JSON.stringify(state),
      200,
      'b1c1',
      chapters,
      words,
    )

    expect(imported.chapters.b1c1.prepWrittenFirstPassCorrect).toBe(4)
    expect(imported.chapters.b1c1.prepListeningFirstPassCorrect).toBe(4)
  })

  it('does not let impossible future timestamps fabricate or postpone learning evidence', () => {
    const now = new Date(2026, 0, 10, 12, 0, 0).getTime()
    const farFuture = new Date(2099, 0, 1, 12, 0, 0).getTime()
    const today = '2026-01-10'

    const imported = importStateJson(
      JSON.stringify({
        version: 6,
        dayEvidenceVersion: 1,
        currentChapter: 'b1c1',
        created: farFuture,
        chapters: {
          b1c1: {
            preparedAt: farFuture,
            prepAttempts: 1,
            completed: true,
            completedAt: farFuture,
            lastReadAt: farFuture,
            checksCorrect: 2,
            checksTotal: 2,
            reads: 1,
          },
        },
        words: {
          w1: {
            introduced: true,
            firstSeenAt: farFuture,
            lastCheckAt: farFuture,
            dueAt: farFuture,
            lastReviewedAt: farFuture,
            lastIndependentSuccessAt: farFuture,
            lastProductiveSuccessAt: farFuture,
            successDays: [today, '2099-01-01'],
            productiveSuccessDays: [today, '2099-01-01'],
          },
        },
        exams: {
          'book-1': {
            attempts: 1,
            passed: true,
            passedAt: farFuture,
            lastAttemptAt: farFuture,
            lastScore: 1,
            bestScore: 1,
            lastProductiveScore: 1,
            bestProductiveScore: 1,
            missedWordIds: ['w1'],
            testedWordIds: ['w1'],
          },
        },
      }),
      now,
      'b1c1',
      chapters,
      words,
    )

    expect(imported.created).toBe(now)
    expect(imported.chapters.b1c1).toMatchObject({ completed: true, preparedAt: 1 })
    expect(imported.chapters.b1c1.completedAt).toBeUndefined()
    expect(imported.chapters.b1c1.lastReadAt).toBeUndefined()
    expect(imported.words.w1.firstSeenAt).toBeUndefined()
    expect(imported.words.w1.lastReviewedAt).toBeUndefined()
    expect(imported.words.w1.lastIndependentSuccessAt).toBeUndefined()
    expect(imported.words.w1.lastProductiveSuccessAt).toBeUndefined()
    expect(imported.words.w1.dueAt).toBe(now)
    expect(imported.words.w1.successDays).toEqual([today])
    expect(imported.words.w1.productiveSuccessDays).toEqual([today])
    expect(imported.exams['book-1'].passedAt).toBeUndefined()
    expect(imported.exams['book-1'].lastAttemptAt).toBeUndefined()
    expect(imported.exams['book-1'].remediationAfter).toBe(now)
    expect(imported.exams['book-1'].missedWordIds).toEqual(['w1'])
  })

  it('preserves first-pass acquisition evidence through backup import', () => {
    const state = emptyState(100, 'b1c1')
    state.chapters.b1c1 = {
      preparedAt: 110,
      prepAttempts: 1,
      prepWrittenCorrect: 4,
      prepWrittenTotal: 4,
      prepWrittenFirstPassCorrect: 2,
      prepListeningCorrect: 4,
      prepListeningTotal: 4,
      prepListeningFirstPassCorrect: 3,
      completed: false,
      checksCorrect: 0,
      checksTotal: 0,
      reads: 0,
    }

    const imported = importStateJson(
      JSON.stringify(state),
      200,
      'b1c1',
      chapters,
      words,
    )

    expect(imported.chapters.b1c1.prepWrittenFirstPassCorrect).toBe(2)
    expect(imported.chapters.b1c1.prepListeningFirstPassCorrect).toBe(3)
  })
})


describe('concurrent progress reconciliation', () => {
  const chapterProgress = () => ({
    prepAttempts: 0,
    completed: false,
    checksCorrect: 0,
    checksTotal: 0,
    reads: 0,
  })

  it('preserves independent changes made by a stale tab and the persisted tab', () => {
    const base = emptyState(100, 'b1c1')
    const local = { ...base, dailyReviewGoal: 20 as const, chapters: { b1c1: chapterProgress() } }
    const remote = { ...base, showFaDefault: true, chapters: { b1c2: chapterProgress() } }

    const merged = mergeConcurrentState(base, local, remote)

    expect(merged).toBeDefined()
    expect(merged?.dailyReviewGoal).toBe(20)
    expect(merged?.showFaDefault).toBe(true)
    expect(Object.keys(merged?.chapters ?? {}).sort()).toEqual(['b1c1', 'b1c2'])
  })

  it('preserves replacement lineage across an ordinary concurrent merge', () => {
    const base = { ...emptyState(100, 'b1c1'), progressReplacementToken: 'lineage:one' }
    const local = { ...base, dailyReviewGoal: 20 as const }
    const remote = { ...base, showFaDefault: true }

    const merged = mergeConcurrentState(base, local, remote)

    expect(merged?.progressReplacementToken).toBe('lineage:one')
    expect(merged?.dailyReviewGoal).toBe(20)
    expect(merged?.showFaDefault).toBe(true)
  })

  it('rejects every stale write across an explicit replacement lineage boundary', () => {
    const base = { ...emptyState(100, 'b1c1'), progressReplacementToken: 'lineage:old' }
    const staleSettings = { ...base, dailyReviewGoal: 20 as const }
    const replacement = {
      ...emptyState(200, 'b1c1'),
      progressReplacementToken: 'lineage:new',
    }

    expect(mergeConcurrentState(base, staleSettings, replacement)).toBeUndefined()
  })

  it('rejects divergent edits to the same learning record', () => {
    const original = chapterProgress()
    const base = { ...emptyState(100, 'b1c1'), chapters: { b1c1: original } }
    const local = {
      ...base,
      chapters: { b1c1: { ...original, checksCorrect: 1 } },
    }
    const remote = {
      ...base,
      chapters: { b1c1: { ...original, reads: 1 } },
    }

    expect(mergeConcurrentState(base, local, remote)).toBeUndefined()
  })

  it('does not let a stale tab restore a learning record removed by reset', () => {
    const original = chapterProgress()
    const base = { ...emptyState(100, 'b1c1'), chapters: { b1c1: original } }
    const staleLocal = {
      ...base,
      chapters: { b1c1: { ...original, checksCorrect: 1 } },
    }
    const resetRemote = emptyState(200, 'b1c1')

    expect(mergeConcurrentState(base, staleLocal, resetRemote)).toBeUndefined()
  })

  it('lets a stale settings-only change coexist with a reset without restoring progress', () => {
    const original = chapterProgress()
    const base = { ...emptyState(100, 'b1c1'), chapters: { b1c1: original } }
    const staleLocal = { ...base, dailyReviewGoal: 20 as const }
    const resetRemote = emptyState(200, 'b1c1')

    const merged = mergeConcurrentState(base, staleLocal, resetRemote)

    expect(merged).toBeDefined()
    expect(merged?.chapters).toEqual({})
    expect(merged?.dailyReviewGoal).toBe(20)
    expect(merged?.created).toBe(200)
  })
})

describe('durable storage', () => {
  it('asks the browser once per session to keep progress, only when not yet durable', async () => {
    const calls: string[] = []
    const manager = {
      persisted: async () => { calls.push('persisted'); return false },
      persist: async () => { calls.push('persist'); return true },
    } as unknown as StorageManager
    requestDurableStorage(manager)
    requestDurableStorage(manager)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(calls).toEqual(['persisted', 'persist'])
  })
})
