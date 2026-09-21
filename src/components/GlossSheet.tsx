import { useCallback, useEffect, useId, useRef } from 'react'
import type { WordEntry } from '../engine/types'
import { exampleSrc, play, stopAudio, wordSrc } from '../engine/audio'
import { selectNarrationVoice } from '../engine/narration'

interface Props {
  word: WordEntry | null
  soundOn: boolean
  narratorVoiceURI: string
  narratorRate: number
  onClose: () => void
}

export default function GlossSheet({ word, soundOn, narratorVoiceURI, narratorRate, onClose }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  const speechToken = useRef(0)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  const speakOrFallback = useCallback((text: string, fallbackSrc: string) => {
    if (!soundOn) return
    const token = ++speechToken.current
    stopAudio()
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
    synth?.cancel()
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
      play(fallbackSrc, true)
      return
    }
    try {
      const utterance = new SpeechSynthesisUtterance(text)
      const voice = selectNarrationVoice(synth.getVoices(), narratorVoiceURI)
      if (voice) {
        utterance.voice = voice
        utterance.lang = voice.lang
      } else {
        utterance.lang = 'en-US'
      }
      utterance.rate = narratorRate
      utterance.pitch = 1
      utterance.volume = 1
      utterance.onerror = () => {
        if (speechToken.current === token) play(fallbackSrc, true)
      }
      synth.speak(utterance)
    } catch {
      if (speechToken.current === token) play(fallbackSrc, true)
    }
  }, [narratorRate, narratorVoiceURI, soundOn])

  useEffect(() => {
    if (!word) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    if (soundOn) speakOrFallback(word.word, wordSrc(word.id))

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !sheetRef.current) return
      const focusable = [...sheetRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      speechToken.current++
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
      stopAudio()
      previousFocus?.focus()
    }
  }, [word, soundOn, speakOrFallback])

  if (!word) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(43,42,38,0.45)' }}
      onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}
      role="presentation"
    >
      <div
        ref={sheetRef}
        className="sheet-up paper-card mx-2 mb-2 w-full max-w-lg p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div id={titleId} className="font-en text-3xl font-bold" dir="ltr">{word.word}</div>
            <div className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }} dir="ltr">
              {word.ipa} · {word.pos}
            </div>
          </div>
          <button
            type="button"
            className="btn-paper shrink-0 px-3 py-2 text-sm"
            onClick={() => speakOrFallback(word.word, wordSrc(word.id))}
            disabled={!soundOn}
            aria-label="شنیدن تلفظ"
          >
            🔊 تلفظ
          </button>
        </div>

        <div id={descriptionId} className="mt-3 text-xl font-bold">{word.fa}</div>
        <hr className="dash-line my-4" />
        <div className="font-en text-base leading-relaxed" dir="ltr">{word.ex}</div>
        <div className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>{word.tr}</div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="btn-paper flex-1 px-3 py-2 text-sm"
            onClick={() => speakOrFallback(word.ex, exampleSrc(word.id))}
            disabled={!soundOn}
          >
            🔊 شنیدن مثال
          </button>
          <button ref={closeRef} type="button" className="btn-ink flex-1 px-3 py-2 text-sm" onClick={onClose}>
            بستن
          </button>
        </div>
      </div>
    </div>
  )
}
