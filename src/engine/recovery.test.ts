import { describe, expect, it } from 'vitest'
import { AUTO_RELOAD_WINDOW_MS, isChunkLoadError, shouldAutoReload } from './recovery'

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } }
}

describe('route recovery', () => {
  it('recognizes a screen script that failed to load in each browser', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/ExamScreen-1.js'))).toBe(true)
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: https://x/a.js'))).toBe(true)
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/index.css'))).toBe(true)
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'box')"))).toBe(false)
    expect(isChunkLoadError('boom')).toBe(false)
  })

  it('reloads once, never offline, and never twice within the window', () => {
    const storage = memoryStorage()
    expect(shouldAutoReload(storage, false, 1_000)).toBe(false)
    expect(shouldAutoReload(storage, true, 1_000)).toBe(true)
    expect(shouldAutoReload(storage, true, 1_000 + AUTO_RELOAD_WINDOW_MS - 1)).toBe(false)
    expect(shouldAutoReload(storage, true, 1_000 + AUTO_RELOAD_WINDOW_MS)).toBe(true)
    expect(shouldAutoReload(undefined, true, 1_000)).toBe(false)
    const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => {} }
    expect(shouldAutoReload(blocked, true, 1_000)).toBe(false)
  })
})
