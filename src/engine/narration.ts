// Consistent story narration using the browser/OS English speech engine.
// Bundled MP3 remains a fallback in ReaderScreen for browsers without Web Speech.

export interface VoiceLike {
  voiceURI: string
  name: string
  lang: string
  default: boolean
  localService: boolean
}

function isEnglish(lang: string): boolean {
  return /^en(?:-|_|$)/i.test(lang)
}

function scoreVoice(voice: VoiceLike): number {
  const lang = voice.lang.replace('_', '-').toLowerCase()
  let score = 0
  if (lang === 'en-us') score += 100
  else if (lang.startsWith('en-')) score += 50
  else if (lang === 'en') score += 40
  if (/natural|neural|premium|enhanced/i.test(voice.name)) score += 24
  if (voice.default) score += 8
  if (voice.localService) score += 4
  return score
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

export function speakEnglish(text: string, voiceURI: string, rate: number, onEnd?: () => void): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') return false
  try {
    const synth = window.speechSynthesis
    synth.cancel()
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
    if (onEnd) {
      utterance.onend = onEnd
      utterance.onerror = onEnd
    }
    synth.speak(utterance)
    return true
  } catch {
    return false
  }
}
