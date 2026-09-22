// Optional bundled-audio fallback. Production uses the selected system English voice;
// set VITE_BUNDLED_AUDIO=1 only in builds that actually ship the MP3 pack.

let el: HTMLAudioElement | null = null
let currentSrc = ''
const bundledAudioAvailable = import.meta.env.VITE_BUNDLED_AUDIO === '1'

function player(): HTMLAudioElement {
  if (!el) el = new Audio()
  return el
}

export function sentenceSrc(chapterId: string, index: number): string {
  return `${import.meta.env.BASE_URL}audio/sentences/${chapterId}_${String(index).padStart(3, '0')}.mp3`
}

export function wordSrc(wordId: string): string {
  return `${import.meta.env.BASE_URL}audio/words/${wordId}.mp3`
}

export function exampleSrc(wordId: string): string {
  return `${import.meta.env.BASE_URL}audio/examples/${wordId}.mp3`
}

export function bundledAudioEnabled(): boolean {
  return bundledAudioAvailable
}

export function play(
  src: string,
  enabled: boolean,
  onEnd?: () => void,
  onError?: () => void,
): boolean {
  if (!enabled || !bundledAudioAvailable) return false
  const a = player()
  if (currentSrc !== src) {
    a.src = src
    currentSrc = src
  }
  a.currentTime = 0
  a.onended = onEnd ?? null
  a.onerror = () => onError?.()
  void a.play().catch(() => onError?.())
  return true
}

export function stopAudio(): void {
  if (el) {
    el.onended = null
    el.onerror = null
    el.pause()
  }
}
