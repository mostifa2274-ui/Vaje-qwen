import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GhesseState, SkillDimension, WordEntry } from '../engine/types'
import { stopAudio } from '../engine/audio'
import type { ClipKind } from '../engine/audioClips'
import { cancelEnglishSpeech, speakEnglishWithFallback, speechFailureNotice, type SpeechFailure } from '../engine/narration'
import { SpeakerIcon } from './Icons'
import { persianPartOfSpeech } from '../engine/partOfSpeech'
import PronunciationPractice from './PronunciationPractice'
import ActiveUsePractice from './ActiveUsePractice'
import { masteryEvidence, masteryNextRequirementFa } from '../engine/mastery'
import { faNum, percent } from '../engine/format'

interface Props {
  word: WordEntry | null
  state: GhesseState
  soundOn: boolean
  narratorVoiceURI: string
  narratorRate: number
  onClose: () => void
}

export default function GlossSheet({ word, state, soundOn, narratorVoiceURI, narratorRate, onClose }: Props) {
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
      const focusable = [...sheetRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), summary, [href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')]
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

  const progress = state.words[word.id]
  const evidence = masteryEvidence(word.id, state)
  const skillLabels: Record<SkillDimension, string> = {
    meaning: 'معنی',
    context: 'بافت',
    production: 'تولید',
    form: 'املاء',
  }
  const levelLabel = evidence.level === 'mastered'
    ? 'مسلط'
    : evidence.level === 'strong'
      ? 'قوی'
      : evidence.level === 'learning'
        ? 'در حال یادگیری'
        : evidence.level === 'seen'
          ? 'دیده‌شده'
          : 'تازه'

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
            <div id={titleId} className="font-en text-3xl font-bold" lang="en" dir="ltr">{word.word}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
              {word.ipa && <span className="font-en" lang="en" dir="ltr">/{word.ipa}/</span>}
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
        <div className="font-en text-base leading-relaxed" lang="en" dir="ltr">{word.ex}</div>
        <div className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>{word.tr}</div>

        <PronunciationPractice
          key={word.id}
          word={word.word}
          soundOn={soundOn}
          narratorVoiceURI={narratorVoiceURI}
          narratorRate={narratorRate}
        />

        <ActiveUsePractice
          key={`gloss-active-${word.id}`}
          word={word}
          soundOn={soundOn}
          narratorVoiceURI={narratorVoiceURI}
          narratorRate={narratorRate}
        />

        <details className="method-details mt-4" data-testid="mastery-evidence">
          <summary>چرا وضعیت این واژه «{levelLabel}» است؟</summary>
          <div className="pt-3 text-sm leading-7">
            <p style={{ color: 'var(--ink-soft)' }}>{masteryNextRequirementFa(word.id, state)}</p>

            {progress?.introduced && (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="metric-card"><b>{percent(evidence.accuracy)}</b><span>دقت بازیابی</span></div>
                  <div className="metric-card"><b>{faNum(evidence.successDays)}</b><span>روز موفق</span></div>
                  <div className="metric-card"><b>{faNum(evidence.productiveDays)}</b><span>روز تولیدی</span></div>
                  <div className="metric-card"><b>{faNum(evidence.spanDays)}</b><span>روز فاصلهٔ شواهد</span></div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {(Object.keys(skillLabels) as SkillDimension[]).map(dimension => {
                    const stat = progress.skillStats?.[dimension] ?? { correct: 0, wrong: 0 }
                    const total = stat.correct + stat.wrong
                    return (
                      <div key={dimension} className="paper-note">
                        <b>{skillLabels[dimension]}</b>
                        <span className="mr-1" style={{ color: 'var(--ink-soft)' }}>
                          {total ? `${faNum(stat.correct)} درست · ${faNum(stat.wrong)} خطا` : 'هنوز شواهدی ندارد'}
                        </span>
                      </div>
                    )
                  })}
                </div>

                <p className="mt-3 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
                  این اعداد فقط از پاسخ‌های مستقل ثبت‌شده می‌آیند؛ بازکردن معنی، تمرین آزاد و پاسخ درست پس از دیدن جواب، تسلط را بالا نمی‌برند.
                </p>
              </>
            )}
          </div>
        </details>

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