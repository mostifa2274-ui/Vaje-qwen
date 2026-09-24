import { playClip, stopAudio } from './audio'
import { recordedClip, type ClipKind } from './audioClips'

/**
 * Why a spoken prompt could not play. 'blocked': the browser refused audio
 * without a recent tap (autoplay policy, e.g. after Android reloads a
 * discarded tab), so one tap on a play button fixes it. 'unavailable': no
 * working English speech path exists on this device.
 */
export type SpeechFailure = 'blocked' | 'unavailable'
export type SpeechFailureHandler = (failure: SpeechFailure) => void

export const BLOCKED_AUDIO_NOTICE = 'مرورگر پخش خودکار صدا را متوقف کرد. یک‌بار روی دکمهٔ پخش بزن تا صدا فعال شود.'

export function speechFailureNotice(failure: SpeechFailure, unavailableNotice: string): string {
  return failure === 'blocked' ? BLOCKED_AUDIO_NOTICE : unavailableNotice
}

function failureFromSpeechError(event: unknown): SpeechFailure {
  return (event as { error?: unknown } | undefined)?.error === 'not-allowed' ? 'blocked' : 'unavailable'
}

// Consistent English narration for words, examples and story text.
// We prefer the best natural/neural English voice exposed by the browser/OS
// and briefly wait for Chrome's asynchronous voice catalogue before falling
// back to its default English voice.

export interface VoiceLike {
  voiceURI: string
  name: string
  lang: string
  default: boolean
  localService: boolean
}

let speechRequestId = 0
// Chrome can garbage-collect an utterance nothing else references and then
// never fire its end event. Holding the active one keeps its callbacks alive.
let activeUtterance: SpeechSynthesisUtterance | null = null
let qualityVoiceKnown = false
let initialVoiceGraceElapsed = false
let warmVoiceListenerAttached = false

function isEnglish(lang: string): boolean {
  return /^en(?:-|_|$)/i.test(lang)
}

function normalizedName(name: string): string {
  return name.trim().toLowerCase()
}

export function voiceQualityScore(voice: VoiceLike): number {
  const lang = voice.lang.replace('_', '-').toLowerCase()
  const name = normalizedName(voice.name)
  let score = 0

  if (lang === 'en-us') score += 120
  else if (lang === 'en-gb') score += 112
  else if (lang === 'en-au' || lang === 'en-ca' || lang === 'en-ie') score += 100
  else if (lang.startsWith('en-')) score += 88
  else if (lang === 'en') score += 80

  // These labels are used by the major browser/OS speech engines for their
  // higher-fidelity voices. Remote voices are often neural on Android/Chrome.
  if (/natural|neural|premium|enhanced|online/.test(name)) score += 150
  if (/google.*english|microsoft.*(aria|jenny|guy|sonia|ryan|libby)|samantha|siri/.test(name)) score += 90
  if (!voice.localService) score += 28
  if (voice.default) score += 10

  // Avoid obviously synthetic legacy engines when a better voice exists.
  if (/espeak|festival|compact|robot|novelty/.test(name)) score -= 180

  return score
}

function scoreVoice(voice: VoiceLike): number {
  return voiceQualityScore(voice)
}

export function englishNarrationVoices<T extends VoiceLike>(voices: readonly T[]): T[] {
  return voices
    .filter(voice => isEnglish(voice.lang))
    .slice()
    .sort((a, b) => scoreVoice(b) - scoreVoice(a) || a.name.localeCompare(b.name))
}

export function selectNarrationVoice<T extends VoiceLike>(voices: readonly T[], preferredVoiceURI = ''): T | undefined {
  if (preferredVoiceURI) {
    const preferred = voices.find(voice => voice.voiceURI === preferredVoiceURI && isEnglish(voice.lang))
    if (preferred) return preferred
  }
  return englishNarrationVoices(voices)[0]
}

const READY_VOICE_SCORE = 180

/**
 * Chrome/Android can expose an incomplete speech catalogue before its better
 * English voices arrive. Wait briefly only when the currently available best
 * English voice is below Ghesse's quality floor. Explicitly selected voices
 * that are already available always start immediately.
 */
export function shouldWaitForHigherQualityVoice<T extends VoiceLike>(
  voices: readonly T[],
  preferredVoiceURI = '',
): boolean {
  if (preferredVoiceURI) {
    const preferred = voices.find(voice => voice.voiceURI === preferredVoiceURI && isEnglish(voice.lang))
    if (preferred) return false
  }
  const best = englishNarrationVoices(voices)[0]
  if (!best) return true
  return voiceQualityScore(best) < READY_VOICE_SCORE
}

export type NarrationLaunchDecision = 'ready' | 'wait' | 'fallback'

/**
 * Cold-start policy:
 * - ready: a selected or quality English voice is already available
 * - wait: give Chrome/Android one short grace period for its async catalogue
 * - fallback: grace already elapsed; speak immediately with the best current voice
 *
 * A later voiceschanged event can still promote future utterances to a better
 * Natural/Neural voice even after the first generic fallback was used.
 */
export function narrationLaunchDecision<T extends VoiceLike>(
  voices: readonly T[],
  preferredVoiceURI = '',
  graceElapsed = false,
): NarrationLaunchDecision {
  if (!shouldWaitForHigherQualityVoice(voices, preferredVoiceURI)) return 'ready'
  return graceElapsed ? 'fallback' : 'wait'
}

export function clampNarrationRate(rate: number): number {
  if (!Number.isFinite(rate)) return 0.92
  return Math.min(1.1, Math.max(0.75, rate))
}

/**
 * Upper bound for one utterance. Some engines (notably after Android
 * backgrounding) drop end events, which would otherwise leave a listening gate
 * or teaching card waiting forever. The bound is generous: roughly three times
 * the spoken length at the slowest narrator rate, plus a cloud-voice start-up
 * allowance.
 */
export function speechWatchdogMs(text: string, rate: number): number {
  return Math.round(8_000 + text.length * 140 / clampNarrationRate(rate))
}

export function cancelEnglishSpeech(): void {
  speechRequestId++
  activeUtterance = null
  stopAudio()
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
}

export function warmEnglishVoices(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const synth = window.speechSynthesis

  const refreshQualityState = () => {
    const voices = synth.getVoices()
    if (!shouldWaitForHigherQualityVoice(voices)) qualityVoiceKnown = true
  }

  // Chrome populates the list lazily. Calling getVoices during app startup
  // encourages the higher-quality catalogue to be ready before the lesson.
  refreshQualityState()

  // Keep one app-lifetime listener so a better Android/Chrome voice that
  // appears after the first 650 ms fallback can still upgrade later words.
  if (!warmVoiceListenerAttached) {
    warmVoiceListenerAttached = true
    synth.addEventListener('voiceschanged', refreshQualityState)
  }
}

function speakWithAvailableVoices(
  requestId: number,
  text: string,
  voiceURI: string,
  rate: number,
  onEnd?: () => void,
  onError?: SpeechFailureHandler,
): void {
  if (typeof window === 'undefined' || requestId !== speechRequestId) return
  const synth = window.speechSynthesis
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
    onError?.('unavailable')
    return
  }

  try {
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = selectNarrationVoice(synth.getVoices(), voiceURI)
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    } else {
      utterance.lang = 'en-US'
    }
    utterance.rate = clampNarrationRate(rate)
    utterance.pitch = 1
    utterance.volume = 1

    let started = false
    let settled = false
    let watchdog = 0
    // Each utterance reports exactly one outcome, and only while it is still
    // the current request.
    const settle = (callback?: () => void, cancelEngine = false) => {
      if (settled) return
      settled = true
      window.clearTimeout(watchdog)
      if (activeUtterance === utterance) activeUtterance = null
      if (requestId !== speechRequestId) return
      if (cancelEngine) synth.cancel()
      callback?.()
    }
    utterance.onstart = () => { started = true }
    utterance.onend = () => settle(onEnd)
    utterance.onerror = event => settle(() => onError?.(failureFromSpeechError(event)))
    activeUtterance = utterance
    synth.speak(utterance)
    watchdog = window.setTimeout(() => {
      // Audio started but its end event was lost: the learner heard it.
      // It never started: the engine is stuck, so clear it and report failure
      // to let the caller fall back or offer a replay.
      if (started) settle(onEnd)
      else settle(() => onError?.('unavailable'), true)
    }, speechWatchdogMs(text, rate))
  } catch {
    onError?.('unavailable')
  }
}

export function speakEnglish(
  text: string,
  voiceURI: string,
  rate: number,
  onEnd?: () => void,
  onError?: SpeechFailureHandler,
): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') return false

  const synth = window.speechSynthesis
  // Supersede the previous request before cancelling it: some engines fire
  // the cancelled utterance's error event synchronously inside cancel().
  const requestId = ++speechRequestId
  synth.cancel()
  const voices = synth.getVoices()
  const decision = voiceURI
    ? narrationLaunchDecision(voices, voiceURI, initialVoiceGraceElapsed)
    : qualityVoiceKnown
      ? 'ready'
      : narrationLaunchDecision(voices, '', initialVoiceGraceElapsed)

  if (decision !== 'wait') {
    if (!voiceURI && decision === 'ready') qualityVoiceKnown = true
    speakWithAvailableVoices(requestId, text, voiceURI, rate, onEnd, onError)
    return true
  }

  // On a cold Chrome/Android start the first catalogue may be empty or may
  // contain only a generic/legacy English voice. Give voiceschanged a short
  // grace period to expose a Natural/Neural/Premium voice, then fall back so
  // pronunciation never becomes blocked.
  let launched = false
  let timer = 0
  const cleanup = () => {
    synth.removeEventListener('voiceschanged', maybeLaunch)
    if (timer) window.clearTimeout(timer)
  }
  const launch = () => {
    if (launched) return
    if (requestId !== speechRequestId) {
      launched = true
      cleanup()
      return
    }
    launched = true
    if (!voiceURI && !shouldWaitForHigherQualityVoice(synth.getVoices())) qualityVoiceKnown = true
    cleanup()
    speakWithAvailableVoices(requestId, text, voiceURI, rate, onEnd, onError)
  }
  const maybeLaunch = () => {
    if (launched) return
    if (requestId !== speechRequestId) {
      launched = true
      cleanup()
      return
    }
    if (!shouldWaitForHigherQualityVoice(synth.getVoices(), voiceURI)) launch()
  }

  synth.addEventListener('voiceschanged', maybeLaunch)
  timer = window.setTimeout(() => {
    initialVoiceGraceElapsed = true
    launch()
  }, 650)
  return true
}


/**
 * Speak a course prompt. The natural pre-recorded clip plays when one exists
 * for exactly this text; otherwise, or if the clip cannot load, the device's
 * best English voice reads it. A clip the browser blocks (autoplay policy)
 * is reported as blocked, because the device voice would be blocked too.
 * Returns false only when neither path can even start.
 */
export function speakEnglishWithFallback(
  text: string,
  voiceURI: string,
  rate: number,
  kind: ClipKind,
  onEnd?: () => void,
  onUnavailable?: SpeechFailureHandler,
): boolean {
  const clip = recordedClip(kind, text)
  if (clip) {
    speechRequestId++
    activeUtterance = null
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    const started = playClip(clip, rate, onEnd, failure => {
      if (failure === 'blocked') {
        onUnavailable?.('blocked')
        return
      }
      if (!speakEnglish(text, voiceURI, rate, onEnd, onUnavailable)) onUnavailable?.('unavailable')
    })
    if (started) return true
  }
  stopAudio()
  return speakEnglish(text, voiceURI, rate, onEnd, onUnavailable)
}
