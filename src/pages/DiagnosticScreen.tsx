import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CHAPTER_BY_ID, VOCAB, WORD_BY_ID } from '../data/chapters'
import { LuxuryAudioOrb, LuxuryChoice, LuxuryPageHeader, LuxuryProgress } from '../components/LuxuryUI'
import { faNum } from '../engine/format'
import { listeningChoiceOptions, isTypedCorrect } from '../engine/review'
import { buildPrepTestOrders } from '../engine/prepOrder'
import { recordDiagnosticPreparedChapter } from '../engine/progress'
import { cancelEnglishSpeech, speakEnglishWithFallback, speechFailureNotice, type SpeechFailure } from '../engine/narration'
import { stopAudio } from '../engine/audio'
import { clearDiagnosticDraft, loadDiagnosticDraft, markDiagnosticFailed, saveDiagnosticDraft, type DiagnosticPhase } from '../engine/diagnosticDraft'
import type { GhesseState } from '../engine/types'

interface Props {
  chapterId: string
  state: GhesseState
  onChange: (next: GhesseState) => void
  onBack: () => void
  onTeach: () => void
  onReady: () => void
  now: number
}

type Failure = { wordId: string; phase: DiagnosticPhase } | null

export default function DiagnosticScreen({ chapterId, state, onChange, onBack, onTeach, onReady, now }: Props) {
  const chapter = CHAPTER_BY_ID.get(chapterId)!
  const { writtenOrder: productiveOrder, listeningOrder } = useMemo(
    () => buildPrepTestOrders(`${chapterId}:diagnostic`, chapter.new),
    [chapter.new, chapterId],
  )
  const [initialDraft] = useState(() => loadDiagnosticDraft(chapterId, chapter.new))
  const [started, setStarted] = useState(Boolean(initialDraft))
  const [phase, setPhase] = useState<DiagnosticPhase>(() => initialDraft?.phase ?? 'productive')
  const [productivePassed, setProductivePassed] = useState<string[]>(() => initialDraft?.productivePassed ?? [])
  const [listeningPassed, setListeningPassed] = useState<string[]>(() => initialDraft?.listeningPassed ?? [])
  const [typed, setTyped] = useState('')
  const [failure, setFailure] = useState<Failure>(null)
  const [listeningReady, setListeningReady] = useState(false)
  const [audioNotice, setAudioNotice] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const productiveId = productiveOrder.find(id => !productivePassed.includes(id))
  const productiveWord = productiveId ? WORD_BY_ID.get(productiveId) : undefined
  const listeningId = listeningOrder[listeningPassed.length]
  const listeningWord = listeningId ? WORD_BY_ID.get(listeningId) : undefined
  const listeningOptions = useMemo(
    () => listeningWord
      ? listeningChoiceOptions(listeningWord, VOCAB, `${chapterId}:known:${listeningPassed.length}:${listeningId}`)
      : [],
    [chapterId, listeningId, listeningPassed.length, listeningWord],
  )

  const speakListening = useCallback(() => {
    if (!listeningWord || !state.soundOn) return
    setListeningReady(false)
    setAudioNotice('')
    const unavailable = (reason: SpeechFailure = 'unavailable') => {
      setListeningReady(false)
      setAudioNotice(speechFailureNotice(reason, 'صدای واژه پخش نشد. برای حفظ اعتبار تعیین سطح، تا پخش موفق امکان پاسخ وجود ندارد.'))
    }
    const startedSpeech = speakEnglishWithFallback(
      listeningWord.word,
      state.narratorVoiceURI,
      state.narratorRate,
      'w',
      () => setListeningReady(true),
      unavailable,
    )
    if (!startedSpeech) unavailable()
  }, [listeningWord, state.narratorRate, state.narratorVoiceURI, state.soundOn])

  useEffect(() => () => {
    cancelEnglishSpeech()
    stopAudio()
  }, [])

  useEffect(() => {
    if (!started || failure || phase !== 'productive') return
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [failure, phase, productiveId, started])

  useEffect(() => {
    if (!started || failure || phase !== 'listening' || !listeningWord || !state.soundOn) return
    const timer = window.setTimeout(speakListening, 100)
    return () => window.clearTimeout(timer)
  }, [failure, listeningWord, phase, speakListening, started, state.soundOn])

  useEffect(() => {
    if (!started || failure) return
    saveDiagnosticDraft({
      version: 1,
      chapterId,
      phase,
      productivePassed,
      listeningPassed,
      updatedAt: Date.now(),
    }, chapter.new)
  }, [chapter.new, chapterId, failure, listeningPassed, phase, productivePassed, started])

  function fail(wordId: string, failedPhase: DiagnosticPhase) {
    clearDiagnosticDraft(chapterId)
    markDiagnosticFailed(chapterId)
    setFailure({ wordId, phase: failedPhase })
    setTyped('')
    setListeningReady(false)
  }

  function submitProductive() {
    if (!productiveWord || !typed.trim() || failure) return
    // Some legitimate synonyms share the same Persian prompt. Accept whichever
    // unresolved chapter word the learner actually typed, then require the
    // remaining synonym separately later. This keeps the test strict without
    // making the prompt ambiguous.
    const unresolvedSameGloss = productiveOrder
      .filter(id => !productivePassed.includes(id))
      .map(id => WORD_BY_ID.get(id))
      .filter((word): word is NonNullable<typeof word> => Boolean(word && word.fa === productiveWord.fa))
    const matched = unresolvedSameGloss.find(word => isTypedCorrect(typed, word))
    if (!matched) {
      fail(productiveWord.id, 'productive')
      return
    }
    const next = [...productivePassed, matched.id]
    setProductivePassed(next)
    setTyped('')
    if (next.length === chapter.new.length) {
      setPhase('listening')
      setListeningPassed([])
    }
  }

  function chooseListening(id: string) {
    if (!listeningWord || failure || !listeningReady) return
    if (id !== listeningWord.id) {
      fail(listeningWord.id, 'listening')
      return
    }
    const next = [...listeningPassed, listeningWord.id]
    setListeningPassed(next)
    setListeningReady(false)
    if (next.length !== chapter.new.length) return

    const prepared = recordDiagnosticPreparedChapter(
      state,
      chapterId,
      chapter.new,
      productivePassed,
      next,
      now,
    )
    clearDiagnosticDraft(chapterId)
    onChange(prepared)
    onReady()
  }

  if (!started) {
    return (
      <div className="app-page luxury-exam page-in mx-auto max-w-3xl px-4 pb-28 pt-5">
        <LuxuryPageHeader
          title="تعیین سطح این فصل"
          eyebrow={`فصل ${faNum(chapter.n)} · کتاب ${faNum(chapter.book)}`}
          subtitle="فقط برای واژه‌هایی که واقعاً از قبل بلدی"
          onBack={onBack}
          backLabel="بازگشت به نقشه"
        />
        <section className="learning-focus-card mt-5 p-5 sm:p-6">
          <h2 className="text-xl font-extrabold">فقط اگر این واژه‌ها را از قبل بلدی</h2>
          <p className="mt-3 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
            این مسیر آموزش را حذف نمی‌کند مگر این‌که همهٔ {faNum(chapter.new.length)} واژه را بدون کمک در دو بخش، همان بار اول درست پاسخ بدهی: اول واژهٔ انگلیسی را از معنی فارسی تولید می‌کنی، سپس واژه را فقط می‌شنوی و معنی‌اش را تشخیص می‌دهی.
          </p>
          <p className="mt-2 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
            با اولین اشتباه، تعیین سطح تمام می‌شود و به آموزش معمولی برمی‌گردی. حتی قبولی کامل هم «تسلط» محسوب نمی‌شود؛ مرور فاصله‌دار بعدی همچنان لازم است.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" className="btn-paper py-3" onClick={onTeach}>آموزش معمولی</button>
            <button type="button" className="btn-ink py-3" onClick={() => setStarted(true)}>شروع تعیین سطح</button>
          </div>
        </section>
      </div>
    )
  }

  if (failure) {
    const word = WORD_BY_ID.get(failure.wordId)!
    return (
      <div className="app-page luxury-exam page-in mx-auto max-w-3xl px-4 pb-28 pt-5">
        <LuxuryPageHeader
          title="تعیین سطح این فصل"
          eyebrow={`فصل ${faNum(chapter.n)} · کتاب ${faNum(chapter.book)}`}
          subtitle="نتیجهٔ تعیین سطح"
          onBack={onBack}
          backLabel="بازگشت به نقشه"
        />
        <section className="learning-focus-card mt-5 p-5 sm:p-6" role="status">
          <h2 className="text-xl font-extrabold">این فصل بهتر است آموزش داده شود</h2>
          <p className="mt-3 text-sm leading-7">
            در واژهٔ <b className="font-en" lang="en" dir="ltr">{word.word}</b> نیاز به کمک بود. هیچ پیشرفتی از تعیین سطح ثبت نشد.
          </p>
          <button type="button" className="btn-ink mt-5 w-full py-3" onClick={onTeach}>شروع آموزش معمولی</button>
        </section>
      </div>
    )
  }

  const done = phase === 'productive' ? productivePassed.length : listeningPassed.length

  return (
    <div className="app-page page-in">
      <LuxuryPageHeader
        title="تعیین سطح این فصل"
        eyebrow={`فصل ${faNum(chapter.n)} · کتاب ${faNum(chapter.book)}`}
        subtitle={phase === 'productive' ? 'تولید واژه' : 'تشخیص شنیداری'}
        onBack={onBack}
        backLabel="بازگشت به نقشه"
        sticky
      />

      <div className="mx-auto max-w-3xl px-4 pb-28 pt-5">
        {initialDraft && (
          <div className="prep-resume-row mb-4" role="status">
            تعیین سطح از آخرین پاسخ قطعی ادامه پیدا کرد.
          </div>
        )}
        <div className="learning-focus-card p-5 sm:p-6">
          <div className="flex items-center justify-between text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>
            <span>{phase === 'productive' ? 'بخش ۱ از ۲ · تولید انگلیسی' : 'بخش ۲ از ۲ · شنیداری'}</span>
            <span>{faNum(done)} از {faNum(chapter.new.length)}</span>
          </div>
          <LuxuryProgress className="mt-3" value={done} max={chapter.new.length} label="پیشرفت تعیین سطح" />

          {phase === 'productive' && productiveWord && (
            <>
              <div className="mt-7 text-center">
                <div className="text-sm" style={{ color: 'var(--ink-soft)' }}>واژهٔ انگلیسی این معنی را بنویس</div>
                <div className="mt-3 text-3xl font-extrabold" dir="rtl">{productiveWord.fa}</div>
              </div>
              <label htmlFor="diagnostic-answer" className="mt-6 block text-sm font-bold">واژهٔ انگلیسی</label>
              <input
                id="diagnostic-answer"
                ref={inputRef}
                className="answer-input mt-2 w-full font-en"
                lang="en"
                dir="ltr"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={typed}
                onChange={event => setTyped(event.target.value)}
                onKeyDown={event => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  submitProductive()
                }}
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" className="btn-paper py-3" onClick={() => fail(productiveWord.id, 'productive')}>نمی‌دانم</button>
                <button type="button" className="btn-ink py-3" disabled={!typed.trim()} onClick={submitProductive}>ثبت پاسخ</button>
              </div>
            </>
          )}

          {phase === 'listening' && listeningWord && (
            <>
              <div className="mt-7 text-center">
                <div className="text-sm" style={{ color: 'var(--ink-soft)' }}>فقط گوش کن و معنی درست را انتخاب کن</div>
                {!state.soundOn ? (
                  <p className="paper-note mt-4" role="alert">برای این بخش صدا باید روشن باشد. از نقشه وارد آموزش معمولی شو یا صدا را در تنظیمات روشن کن.</p>
                ) : (
                  <div className="mt-5">
                    <LuxuryAudioOrb label="پخش دوبارهٔ واژه" helper="گوش کن، سپس معنی را انتخاب کن" onClick={speakListening} />
                  </div>
                )}
              </div>
              {audioNotice && <p className="paper-note mt-3" role="alert">{audioNotice}</p>}
              <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="diagnostic-listening-options">
                {listeningOptions.map(option => (
                  <LuxuryChoice
                    key={option.id}
                    disabled={!state.soundOn || !listeningReady}
                    onClick={() => chooseListening(option.id)}
                  >
                    {option.label}
                  </LuxuryChoice>
                ))}
              </div>
              <button type="button" className="btn-quiet mt-3 w-full py-2.5 text-sm" disabled={!listeningReady} onClick={() => fail(listeningWord.id, 'listening')}>
                نمی‌دانم
              </button>
            </>
          )}

          <p className="mt-5 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
            هیچ پاسخ اصلاح‌شده‌ای در تعیین سطح قبول نمی‌شود. با اولین خطا، مسیر آموزش عادی شروع می‌شود.
          </p>
        </div>
      </div>
    </div>
  )
}
