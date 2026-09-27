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

import { clearSessionDrafts, emptyState, importStateJson, resetState, saveState, summarizeProgress } from './store'

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

  it('reset clears saved progress and resumable drafts together', () => {
    const state = emptyState(1, 'b1c1')
    state.chapters.b1c1 = { preparedAt: 2, prepAttempts: 1, completed: true, checksCorrect: 10, checksTotal: 10, reads: 1 }
    expect(saveState(state)).toBe(true)
    sessionStorage.setItem('ghesse:prep:v1:b1c2', '{}')

    const fresh = resetState('b1c1')

    expect(fresh.chapters).toEqual({})
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
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
})
