import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clipPlaybackRate, RECORDED_CLIP_WATCHDOG_MS } from './audio'
import { clipId, loadClipIndex, recordedClip, setClipIndex } from './audioClips'
import { speakEnglishWithFallback } from './narration'

class FakeAudio {
  static instances: FakeAudio[] = []
  static playResult: () => Promise<void> = () => Promise.resolve()
  src = ''
  currentTime = 0
  playbackRate = 1
  preload = ''
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  pause = vi.fn()
  play = vi.fn(() => FakeAudio.playResult())

  constructor() {
    FakeAudio.instances.push(this)
  }
}

class FakeUtterance {
  text: string
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onerror: ((event?: { error: string }) => void) | null = null
  voice: unknown = null
  lang = ''
  rate = 1
  pitch = 1
  volume = 1

  constructor(text: string) {
    this.text = text
  }
}

// audio.ts keeps one element for the whole session, so the newest instance is the player.
function player(): FakeAudio {
  return FakeAudio.instances[FakeAudio.instances.length - 1]
}

function installSpeech() {
  const spoken: FakeUtterance[] = []
  vi.stubGlobal('window', globalThis)
  vi.stubGlobal('speechSynthesis', {
    cancel: vi.fn(),
    getVoices: () => [{ voiceURI: 'neural-en-us', name: 'Neural English', lang: 'en-US', default: true, localService: false }],
    speak: (utterance: FakeUtterance) => { spoken.push(utterance) },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  return spoken
}

describe('clip naming', () => {
  it('matches the ids written by scripts/audio/generate_audio.py', () => {
    expect(clipId('w', 'cat')).toBe('effe6cb2b6475943')
    expect(clipId('s', 'Nino is at home.')).toBe('0dff949253a24ebd')
    // Curly apostrophes and runs of spaces are normalised the same way.
    expect(clipId('s', 'It’s  a  cat.')).toBe('5b4d39005acef8ed')
    expect(clipId('s', "It's a cat.")).toBe('5b4d39005acef8ed')
  })

  it('keeps words and sentences apart', () => {
    expect(clipId('w', 'cat')).not.toBe(clipId('s', 'cat'))
  })
})

describe('recorded clip lookup', () => {
  afterEach(() => setClipIndex(null))

  it('only returns clips listed in the index', () => {
    setClipIndex([clipId('w', 'cat')])
    expect(recordedClip('w', 'cat')).toBe('/audio/effe6cb2b6475943.mp3')
    expect(recordedClip('w', 'dog')).toBeUndefined()
    expect(recordedClip('s', 'cat')).toBeUndefined()
  })

  it('treats a missing index as no recordings', async () => {
    setClipIndex(null)
    await loadClipIndex(() => Promise.resolve(new Response('', { status: 404 })))
    expect(recordedClip('w', 'cat')).toBeUndefined()
  })

  it('reads the clip list from index.json', async () => {
    setClipIndex(null)
    const body = JSON.stringify({ voice: 'test', clips: [clipId('w', 'cat'), 7] })
    await loadClipIndex(() => Promise.resolve(new Response(body, { status: 200 })))
    expect(recordedClip('w', 'cat')).toBe('/audio/effe6cb2b6475943.mp3')
  })

  it('retries the catalogue after a transient HTTP failure', async () => {
    setClipIndex(null)
    let attempts = 0
    const fetcher = () => {
      attempts++
      if (attempts === 1) return Promise.resolve(new Response('', { status: 503 }))
      const body = JSON.stringify({ voice: 'test', clips: [clipId('w', 'cat')] })
      return Promise.resolve(new Response(body, { status: 200 }))
    }

    await loadClipIndex(fetcher)
    expect(recordedClip('w', 'cat')).toBeUndefined()

    await loadClipIndex(fetcher)
    expect(attempts).toBe(2)
    expect(recordedClip('w', 'cat')).toBe('/audio/effe6cb2b6475943.mp3')
  })
})

describe('narration prefers recordings', () => {
  beforeEach(() => {
    FakeAudio.playResult = () => Promise.resolve()
    vi.stubGlobal('Audio', FakeAudio)
    setClipIndex([clipId('w', 'cat')])
  })

  afterEach(() => {
    setClipIndex(null)
    vi.unstubAllGlobals()
  })

  it('plays the recorded clip instead of the device voice', () => {
    const spoken = installSpeech()
    const onEnd = vi.fn()

    expect(speakEnglishWithFallback('cat', '', 0.92, 'w', onEnd)).toBe(true)
    const audio = player()
    expect(audio.src).toBe('/audio/effe6cb2b6475943.mp3')
    expect(audio.playbackRate).toBe(1)
    expect(spoken).toHaveLength(0)

    audio.onended?.()
    audio.onended?.()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('scales the recording with the narrator speed, within limits', () => {
    expect(clipPlaybackRate(0.92)).toBe(1)
    expect(clipPlaybackRate(0.5)).toBe(0.75)
    expect(clipPlaybackRate(2)).toBe(1.25)
  })

  it('falls back to the device voice when a clip fails to load', () => {
    const spoken = installSpeech()
    const onEnd = vi.fn()

    speakEnglishWithFallback('cat', '', 0.92, 'w', onEnd)
    player().onerror?.()

    expect(spoken.map(utterance => utterance.text)).toEqual(['cat'])
  })

  it('falls back instead of hanging when a recorded clip never finishes', () => {
    vi.useFakeTimers()
    try {
      const spoken = installSpeech()
      const onEnd = vi.fn()

      speakEnglishWithFallback('cat', '', 0.92, 'w', onEnd)
      expect(spoken).toHaveLength(0)

      vi.advanceTimersByTime(RECORDED_CLIP_WATCHDOG_MS)

      expect(player().pause).toHaveBeenCalled()
      expect(spoken.map(utterance => utterance.text)).toEqual(['cat'])
      expect(onEnd).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports an autoplay refusal as blocked without trying the device voice', async () => {
    const spoken = installSpeech()
    const failure = vi.fn()
    FakeAudio.playResult = () => Promise.reject(new DOMException('no gesture', 'NotAllowedError'))

    speakEnglishWithFallback('cat', '', 0.92, 'w', undefined, failure)
    await Promise.resolve()
    await Promise.resolve()

    expect(failure).toHaveBeenCalledWith('blocked')
    expect(spoken).toHaveLength(0)
  })

  it('ignores the end of a clip that a newer prompt replaced', () => {
    installSpeech()
    setClipIndex([clipId('w', 'cat'), clipId('w', 'dog')])
    const first = vi.fn()
    const second = vi.fn()

    speakEnglishWithFallback('cat', '', 0.92, 'w', first)
    const audio = player()
    const staleEnd = audio.onended
    speakEnglishWithFallback('dog', '', 0.92, 'w', second)
    staleEnd?.()
    audio.onended?.()

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('uses the device voice for prompts that have no recording', () => {
    const spoken = installSpeech()
    speakEnglishWithFallback('dog', '', 0.92, 'w')
    expect(spoken.map(utterance => utterance.text)).toEqual(['dog'])
  })

  it('returns false without reporting when nothing can speak, so the caller reports once', () => {
    setClipIndex(null)
    const unavailable = vi.fn()

    expect(speakEnglishWithFallback('cat', '', 0.92, 'w', undefined, unavailable)).toBe(false)
    expect(unavailable).not.toHaveBeenCalled()
  })
})
