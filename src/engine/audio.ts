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

export function play(src: string, enabled: boolean): void {
  if (!enabled || !bundledAudioAvailable) return
  const a = player()
  if (currentSrc !== src) {
    a.src = src
    currentSrc = src
  }
  a.currentTime = 0
  void a.play().catch(() => { /* autoplay blocked — ignore */ })
}

export function stopAudio(): void {
  if (el) el.pause()
}
