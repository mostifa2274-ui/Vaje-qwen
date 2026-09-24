// Playback of the pre-recorded narration clips (see audioClips.ts). One audio
// element is reused, so starting a clip always stops the previous one.
import type { SpeechFailureHandler } from './narration'

let el: HTMLAudioElement | null = null
let request = 0

function player(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null
  if (!el) {
    el = new Audio()
    el.preload = 'auto'
  }
  return el
}

/** The recordings are made at a learner-friendly pace; the narrator-speed setting scales it. */
export function clipPlaybackRate(rate: number): number {
  const value = Number.isFinite(rate) ? rate : 0.92
  return Math.min(1.25, Math.max(0.75, value / 0.92))
}

/**
 * Plays a recorded clip. Returns false when no audio element exists at all.
 * Exactly one of onEnd or onError is called, and only for the latest clip.
 */
export function playClip(src: string, rate: number, onEnd?: () => void, onError?: SpeechFailureHandler): boolean {
  const audio = player()
  if (!audio) return false
  const current = ++request
  let settled = false
  const settle = (callback?: () => void) => {
    if (settled || current !== request) return
    settled = true
    audio.onended = null
    audio.onerror = null
    callback?.()
  }
  audio.onended = () => settle(onEnd)
  audio.onerror = () => settle(() => onError?.('unavailable'))
  try {
    audio.src = src
    audio.currentTime = 0
    audio.playbackRate = clipPlaybackRate(rate)
    const started = audio.play()
    if (started && typeof started.catch === 'function') {
      started.catch((error: unknown) => {
        settle(() => onError?.(error instanceof DOMException && error.name === 'NotAllowedError' ? 'blocked' : 'unavailable'))
      })
    }
  } catch {
    settle(() => onError?.('unavailable'))
  }
  return true
}

export function stopAudio(): void {
  request++
  if (el) {
    el.onended = null
    el.onerror = null
    el.pause()
  }
}
