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

export function clampNarrationRate(rate: number): number {
  if (!Number.isFinite(rate)) return 0.92
  return Math.min(1.1, Math.max(0.75, rate))
}

export function cancelEnglishSpeech(): void {
  speechRequestId++
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
}

export function warmEnglishVoices(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  // Chrome populates the list lazily. Calling getVoices during app startup
  // encourages the higher-quality catalogue to be ready before the lesson.
  window.speechSynthesis.getVoices()
}

function speakWithAvailableVoices(
  requestId: number,
  text: string,
  voiceURI: string,
  rate: number,
  onEnd?: () => void,
  onError?: () => void,
): void {
  if (typeof window === 'undefined' || requestId !== speechRequestId) return
  const synth = window.speechSynthesis
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
    onError?.()
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
    utterance.onend = () => {
      if (requestId === speechRequestId) onEnd?.()
    }
    utterance.onerror = () => {
      if (requestId === speechRequestId) onError?.()
    }
    synth.speak(utterance)
  } catch {
    onError?.()
  }
}

export function speakEnglish(
  text: string,
  voiceURI: string,
  rate: number,
  onEnd?: () => void,
  onError?: () => void,
): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') return false

  const synth = window.speechSynthesis
  synth.cancel()
  const requestId = ++speechRequestId
  const voices = synth.getVoices()

  if (voices.length > 0) {
    speakWithAvailableVoices(requestId, text, voiceURI, rate, onEnd, onError)
    return true
  }

  // Chrome/Android can return [] on the first getVoices() call. Wait briefly
  // for voiceschanged so we do not lock the learner into the robotic default.
  let launched = false
  const launch = () => {
    if (launched || requestId !== speechRequestId) return
    launched = true
    synth.removeEventListener('voiceschanged', launch)
    speakWithAvailableVoices(requestId, text, voiceURI, rate, onEnd, onError)
  }

  synth.addEventListener('voiceschanged', launch)
  window.setTimeout(launch, 280)
  return true
}
