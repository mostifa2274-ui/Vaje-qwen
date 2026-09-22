import { describe, expect, it, vi } from 'vitest'
import { bundledAudioEnabled, play } from './audio'
import { speakEnglishWithFallback } from './narration'

describe('word audio fallback contract', () => {
  it('reports when bundled audio is not enabled in the default build', () => {
    expect(bundledAudioEnabled()).toBe(false)
    expect(play('/audio/words/cat.mp3', true)).toBe(false)
  })

  it('reports unavailable exactly once when neither speech synthesis nor bundled audio can start', () => {
    const unavailable = vi.fn()
    const started = speakEnglishWithFallback(
      'cat',
      '',
      0.92,
      '/audio/words/cat.mp3',
      undefined,
      unavailable,
    )

    expect(started).toBe(false)
    expect(unavailable).toHaveBeenCalledTimes(1)
  })
})
