import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { WordEntry } from '../engine/types'
import { stopAudio } from '../engine/audio'
import type { ClipKind } from '../engine/audioClips'
import { cancelEnglishSpeech, speakEnglishWithFallback, speechFailureNotice, type SpeechFailure } from '../engine/narration'
import { SpeakerIcon } from './Icons'
import { persianPartOfSpeech } from '../engine/partOfSpeech'

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
  const [audioNotice, setAudioNotice] = useState('')
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  const speakOrFallback = useCallback((text: string, kind: ClipKind) => {
    if (!soundOn) return
    setAudioNotice('')
    stopAudio()
    const unavailable = (failure: SpeechFailure = 'unavailable') => {
      setAudioNotice(speechFailureNotice(failure, 'پخش تلفظ انگلیسی روی این دستگاه در دسترس نیست. صدای English Text-to-Speech مرورگر یا سیستم را فعال کن.'))
    }
    const started = speakEnglishWithFallback(
      text,
      narratorVoiceURI,
      narratorRate,
      kind,
      () => setAudioNotice(''),
      unavailable,
    )
    if (!started) unavailable()
  }, [narratorRate, narratorVoiceURI, soundOn])

  useEffect(() => {
    if (!word) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // The sheet slides in from below the viewport. Without preventScroll the
    // browser scrolls the whole story toward the still off-screen button,
    // and jumps back again when focus returns on close.
    closeRef.current?.focus({ preventScroll: true })
    const autoSpeakTimer = soundOn
      ? window.setTimeout(() => speakOrFallback(word.word, 'w'), 0)
      : 0

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
      if (autoSpeakTimer) window.clearTimeout(autoSpeakTimer)
      cancelEnglishSpeech()
      stopAudio()
      previousFocus?.focus({ preventScroll: true })
    }
  }, [word, soundOn, speakOrFallback])

  if (!word) return null

  // Rendered at the document root so the sheet always rises from the bottom
  // of the viewport, whatever the story page's own layout or animation does.
  return createPortal(
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
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
              {word.ipa && <span className="font-en" dir="ltr">/{word.ipa}/</span>}
              <span className="lexical-role-chip">{persianPartOfSpeech(word.pos)}</span>
            </div>
          </div>
          <button
            type="button"
            className="btn-paper shrink-0 px-3 py-2 text-sm"
            onClick={() => speakOrFallback(word.word, 'w')}
            disabled={!soundOn}
            aria-label="شنیدن تلفظ"
          >
            <span className="inline-flex items-center gap-2"><SpeakerIcon className="h-4 w-4" />تلفظ</span>
          </button>
        </div>

        <div id={descriptionId} className="mt-3 text-xl font-bold">{word.fa}</div>
        {audioNotice && <div className="paper-note mt-3" role="alert">{audioNotice}</div>}
        <hr className="dash-line my-4" />
        <div className="font-en text-base leading-relaxed" dir="ltr">{word.ex}</div>
        <div className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>{word.tr}</div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="btn-paper flex-1 px-3 py-2 text-sm"
            onClick={() => speakOrFallback(word.ex, 's')}
            disabled={!soundOn}
          >
            <span className="inline-flex items-center justify-center gap-2"><SpeakerIcon className="h-4 w-4" />شنیدن مثال</span>
          </button>
          <button ref={closeRef} type="button" className="btn-ink flex-1 px-3 py-2 text-sm" onClick={onClose}>
            بستن
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}