import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { speakEnglish, speechWatchdogMs } from './narration'

class FakeUtterance {
  text: string
  voice: unknown = null
  lang = ''
  rate = 1
  pitch = 1
  volume = 1
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(text: string) {
    this.text = text
  }
}

const neuralVoice = {
  voiceURI: 'neural-en-us',
  name: 'Neural English',
  lang: 'en-US',
  default: true,
  localService: false,
}

function installSpeech() {
  const spoken: FakeUtterance[] = []
  const synth = {
    cancel: vi.fn(),
    getVoices: () => [neuralVoice],
    speak: (utterance: FakeUtterance) => { spoken.push(utterance) },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal('window', globalThis)
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  return { synth, spoken }
}

describe('speech completion guarantees', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('treats a started utterance whose end event is lost as finished', () => {
    const { spoken } = installSpeech()
    const onEnd = vi.fn()
    const onError = vi.fn()

    expect(speakEnglish('cat', '', 0.92, onEnd, onError)).toBe(true)
    spoken[0].onstart?.()
    vi.advanceTimersByTime(speechWatchdogMs('cat', 0.92))

    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
  })

  it('clears a stuck engine and reports failure when speech never starts', () => {
    const { synth } = installSpeech()
    const onEnd = vi.fn()
    const onError = vi.fn()

    speakEnglish('cat', '', 0.92, onEnd, onError)
    synth.cancel.mockClear()
    vi.advanceTimersByTime(speechWatchdogMs('cat', 0.92))

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onEnd).not.toHaveBeenCalled()
    expect(synth.cancel).toHaveBeenCalledTimes(1)
  })

  it('reports each utterance outcome at most once', () => {
    const { spoken } = installSpeech()
    const onEnd = vi.fn()
    const onError = vi.fn()

    speakEnglish('cat', '', 0.92, onEnd, onError)
    spoken[0].onstart?.()
    spoken[0].onend?.()
    spoken[0].onerror?.()
    vi.advanceTimersByTime(speechWatchdogMs('cat', 0.92))

    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
  })

  it('ignores a superseded utterance even when cancel reports its error synchronously', () => {
    const { synth, spoken } = installSpeech()
    const firstError = vi.fn()
    const firstEnd = vi.fn()

    speakEnglish('cat', '', 0.92, firstEnd, firstError)
    synth.cancel.mockImplementation(() => spoken[0]?.onerror?.())
    speakEnglish('dog', '', 0.92)
    vi.advanceTimersByTime(speechWatchdogMs('cat', 0.92))

    expect(firstError).not.toHaveBeenCalled()
    expect(firstEnd).not.toHaveBeenCalled()
  })

  it('scales the watchdog with text length and narrator rate', () => {
    expect(speechWatchdogMs('a much longer English sentence for the story', 0.75))
      .toBeGreaterThan(speechWatchdogMs('cat', 1.1))
  })
})
