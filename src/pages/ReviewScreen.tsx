import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { VOCAB, WORD_BY_ID } from '../data/chapters'
import type { GhesseState, RetrievalMode } from '../engine/types'
import { masteryCounts } from '../engine/mastery'
import {
  buildReviewQuestion,
  dimensionForMode,
  dueWordIds,
  isQuestionTypedCorrect,
  isTypedMode,
  modeForProgress,
  recordRetrieval,
  seededSample,
  selectWeakestWordIds,
  troubleWordIds,
} from '../engine/review'
import { speakEnglishWithFallback, speechFailureNotice, type SpeechFailure } from '../engine/narration'
import { examRemediationWordIds } from '../engine/gates'
import { consolidationFocus } from '../engine/analytics'
import { BackIcon, BadgeCheckIcon, CheckIcon, SpeakerIcon } from '../components/Icons'
import SpellingHint from '../components/SpellingHint'
import { clearReviewDraft, loadReviewDraft, saveReviewDraft, type ReviewSessionKind } from '../engine/reviewDraft'
import { faNum } from '../engine/format'
import { creditGradedEffort } from '../engine/activity'

interface Props {
  state: GhesseState
  now: number
  onChange: (next: GhesseState) => void
  onBack: () => void
}

function modeLabel(mode: RetrievalMode): string {
  if (mode === 'productive') return 'یادآوری معنی → واژه'
  if (mode === 'contextProductive') return 'تولید واژه در بافت'
  if (mode === 'spelling') return 'شنیدن و نوشتن'
  if (mode === 'cloze') return 'بازیابی از بافت'
  if (mode === 'reverse') return 'واژه → معنی'
  return 'معنی → واژه'
}

function weaknessLabel(mode: RetrievalMode): string {
  const dimension = dimensionForMode(mode)
  if (dimension === 'meaning') return 'معنی'
  if (dimension === 'context') return 'بافت'
  if (dimension === 'form') return 'املاء و فرم'
  return 'تولید فعال'
}

export default function ReviewScreen({ state, now, onChange, onBack }: Props) {
  const due = useMemo(() => dueWordIds(state.words, now), [state.words, now])
  const trouble = useMemo(() => troubleWordIds(state.words), [state.words])
  const remediation = useMemo(() => examRemediationWordIds(state), [state])
  const introduced = useMemo(() => VOCAB.filter(w => state.words[w.id]?.introduced).map(w => w.id), [state.words])
  // Words of the current book that can be proven on a later day than taught.
  // Once the book's chapters are done they come first, because they stand
  // between the learner and the book's test; before that they fill quiet days.
  const focus = useMemo(() => consolidationFocus(state, now), [now, state])
  const consolidation = useMemo(() => focus?.status.ready ?? [], [focus])
  const consolidationFirst = focus?.blocking === true && consolidation.length > 0
  const scheduled = useMemo(() => {
    if (remediation.length) {
      const restDue = due.filter(id => !remediation.includes(id))
      return [...remediation, ...restDue].slice(0, Math.max(state.dailyReviewGoal, Math.min(20, remediation.length)))
    }
    if (consolidationFirst) {
      const restDue = due.filter(id => !consolidation.includes(id))
      return [...consolidation, ...restDue].slice(0, Math.max(state.dailyReviewGoal, Math.min(20, consolidation.length)))
    }
    if (due.length) return due.slice(0, state.dailyReviewGoal)
    if (consolidation.length) return consolidation.slice(0, state.dailyReviewGoal)
    if (trouble.length) return trouble.slice(0, Math.min(10, state.dailyReviewGoal))
    return selectWeakestWordIds(introduced, state.words, Math.min(10, state.dailyReviewGoal), `extra:${Math.floor(now / 86_400_000)}`)
  }, [consolidation, consolidationFirst, due, introduced, now, remediation, state.dailyReviewGoal, state.words, trouble])
  // Explore mode with nothing to review yet: practise course words instead.
  // Such a session only practises; no word has progress to record.
  const initial = useMemo(
    () => scheduled.length || !state.exploreAll
      ? scheduled
      : seededSample(VOCAB.map(w => w.id), state.dailyReviewGoal, `explore:${Math.floor(now / 86_400_000)}`),
    [now, scheduled, state.dailyReviewGoal, state.exploreAll],
  )
  const suggestedKind: ReviewSessionKind = remediation.length
    ? 'remediation'
    : consolidationFirst || (!due.length && consolidation.length) ? 'consolidation' : due.length ? 'due' : trouble.length ? 'trouble' : 'extra'

  const [initialDraft] = useState(() => loadReviewDraft(introduced))
  const [practiceSession] = useState(() => !initialDraft && scheduled.length === 0 && initial.length > 0)
  const [resumedDraft, setResumedDraft] = useState(Boolean(initialDraft))
  const [queue, setQueue] = useState<string[]>(() => initialDraft?.queue ?? initial)
  const [sessionTotal] = useState(() => initialDraft?.sessionTotal ?? initial.length)
  const [sessionKind] = useState<ReviewSessionKind>(() => initialDraft?.kind ?? suggestedKind)
  const [completed, setCompleted] = useState(() => initialDraft?.completed ?? 0)
  const [correctCount, setCorrectCount] = useState(() => initialDraft?.correctCount ?? 0)
  const [relearnedCount, setRelearnedCount] = useState(() => initialDraft?.relearnedCount ?? 0)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(() => initialDraft?.feedback ?? null)
  const [selected, setSelected] = useState(() => initialDraft?.selected ?? '')
  const [typed, setTyped] = useState(() => initialDraft?.typed ?? '')
  const [attemptNumber, setAttemptNumber] = useState<Record<string, number>>(() => initialDraft?.attemptNumber ?? {})
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [audioNotice, setAudioNotice] = useState('')
  const [audioReady, setAudioReady] = useState(false)
  const [gradedCard, setGradedCard] = useState<{ key: string; mode: RetrievalMode } | null>(null)
  const startedAtRef = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const answerInputRef = useRef<HTMLInputElement>(null)
  const nextCardRef = useRef<HTMLButtonElement>(null)
  const focusNextCardRef = useRef(false)
  const mountedRef = useRef(false)

  const currentId = queue[0]
  const currentWord = currentId ? WORD_BY_ID.get(currentId) : undefined
  const progress = currentId ? state.words[currentId] : undefined
  const cardKey = currentId ? `${currentId}:${attemptNumber[currentId] ?? 0}` : ''
  // Grading writes the word's new progress immediately, which usually moves it
  // to a different retrieval mode. The answered card must not change under
  // the feedback, so its mode stays frozen until the learner moves on.
  const mode = gradedCard?.key === cardKey
    ? gradedCard.mode
    : progress ? modeForProgress(progress) : 'recognition'
  const question = useMemo(
    () => currentWord ? buildReviewQuestion(currentWord, VOCAB, mode, `review:${cardKey}`) : undefined,
    [cardKey, currentWord, mode],
  )
  const counts = useMemo(() => masteryCounts(state, VOCAB.map(w => w.id)), [state])

  useEffect(() => {
    startedAtRef.current = Date.now()
  }, [currentId, attemptNumber])

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    if (currentId) cardRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }, [currentId])

  const typedMode = isTypedMode(mode)
  const answerLocked = mode === 'spelling' && (audioBlocked || !audioReady)

  useEffect(() => {
    if (!typedMode || feedback || answerLocked) return
    const frame = window.requestAnimationFrame(() => answerInputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [answerLocked, cardKey, feedback, typedMode])

  useEffect(() => {
    if (!feedback || !focusNextCardRef.current) return
    focusNextCardRef.current = false
    // Next frame: moving focus inside the Enter keydown that submitted the
    // answer would let the same keystroke activate "next card".
    const frame = window.requestAnimationFrame(() => nextCardRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [feedback])

  useEffect(() => {
    if (sessionTotal === 0 || practiceSession) {
      clearReviewDraft()
      return
    }
    const meaningful = completed > 0
      || Object.keys(attemptNumber).length > 0
      || typed.length > 0
      || selected.length > 0
      || feedback !== null
    if (!meaningful) {
      clearReviewDraft()
      return
    }
    saveReviewDraft({
      version: 1,
      kind: sessionKind,
      queue,
      sessionTotal,
      completed,
      correctCount,
      relearnedCount,
      attemptNumber,
      feedback,
      selected,
      typed,
      updatedAt: Date.now(),
    }, introduced)
  }, [
    attemptNumber,
    completed,
    correctCount,
    feedback,
    introduced,
    practiceSession,
    queue,
    relearnedCount,
    selected,
    sessionKind,
    sessionTotal,
    typed,
  ])

  const speakCurrent = useCallback(() => {
    if (!currentWord || !state.soundOn) return
    const unavailable = (failure: SpeechFailure = 'unavailable') => {
      setAudioReady(false)
      setAudioBlocked(true)
      setAudioNotice(speechFailureNotice(failure, 'پخش تلفظ انگلیسی در دسترس نیست. صدای English Text-to-Speech مرورگر یا سیستم را فعال کن و دوباره امتحان کن.'))
    }
    const ended = () => {
      setAudioReady(true)
      setAudioBlocked(false)
      setAudioNotice('')
    }
    const started = speakEnglishWithFallback(
      currentWord.word,
      state.narratorVoiceURI,
      state.narratorRate,
      'w',
      ended,
      unavailable,
    )
    if (!started) unavailable()
  }, [currentWord, state.narratorRate, state.narratorVoiceURI, state.soundOn])

  // A spelling card is unanswerable until its word is heard, so it speaks on
  // arrival like the prep listening test; the play button remains for replays.
  useEffect(() => {
    if (mode !== 'spelling' || feedback) return
    const timer = window.setTimeout(speakCurrent, 90)
    return () => window.clearTimeout(timer)
  }, [cardKey, feedback, mode, speakCurrent])

  function commit(correct: boolean) {
    if (!currentId || !currentWord || feedback) return
    if (!progress && !practiceSession) return
    if (answerLocked) return
    if (resumedDraft) setResumedDraft(false)
    const elapsedMs = Date.now() - startedAtRef.current
    const source = (attemptNumber[currentId] ?? 0) > 0 ? 'relearn' : 'review'
    const nextCorrectCount = correct && source === 'review' ? correctCount + 1 : correctCount
    const nextRelearnedCount = correct && source === 'relearn' ? relearnedCount + 1 : relearnedCount

    if (!progress) {
      setGradedCard({ key: cardKey, mode })
      focusNextCardRef.current = true
      setFeedback(correct ? 'correct' : 'wrong')
      setCorrectCount(nextCorrectCount)
      setRelearnedCount(nextRelearnedCount)
      return
    }

    // Persist the already-graded transition before permanent word state changes.
    // The draft sanitizer settles this feedback to the next safe queue state, so
    // a reload cannot grade the same retrieval twice.
    saveReviewDraft({
      version: 1,
      kind: sessionKind,
      queue,
      sessionTotal,
      completed,
      correctCount: nextCorrectCount,
      relearnedCount: nextRelearnedCount,
      attemptNumber,
      feedback: correct ? 'correct' : 'wrong',
      selected,
      typed,
      updatedAt: Date.now(),
    }, introduced)

    const gradedAt = Date.now()
    const nextProgress = recordRetrieval(progress, correct, mode, gradedAt, source, elapsedMs)
    let candidate = { ...state, words: { ...state.words, [currentId]: nextProgress } }
    if (source === 'relearn') candidate = creditGradedEffort(candidate, gradedAt)
    onChange(candidate)
    setGradedCard({ key: cardKey, mode })
    focusNextCardRef.current = true
    setFeedback(correct ? 'correct' : 'wrong')
    setCorrectCount(nextCorrectCount)
    setRelearnedCount(nextRelearnedCount)
  }

  function submitTyped() {
    if (!currentWord || !typed.trim()) return
    if (!question) return
    commit(isQuestionTypedCorrect(typed, question))
  }

  function nextCard() {
    if (!currentId || !feedback) return
    const correct = feedback === 'correct'
    const rest = queue.slice(1)
    const attempts = (attemptNumber[currentId] ?? 0) + 1
    setAttemptNumber(previous => ({ ...previous, [currentId]: attempts }))
    setQueue(correct ? rest : [...rest, currentId])
    if (correct) setCompleted(value => value + 1)
    setFeedback(null)
    setSelected('')
    setTyped('')
    setAudioBlocked(false)
    setAudioNotice('')
    setAudioReady(false)
  }

  const sessionLabel = practiceSession
    ? 'تمرین آزاد در حالت کاوش'
    : sessionKind === 'remediation'
    ? 'ترمیم آزمون'
    : sessionKind === 'consolidation'
    ? 'تثبیت واژه‌های دیروز و پیش‌تر'
    : sessionKind === 'due'
      ? 'مرورهای سررسید'
      : sessionKind === 'trouble'
        ? 'واژه‌های سخت'
        : 'تمرین تقویتی'

  return (
    <div className="app-page page-in mx-auto max-w-3xl px-4 pb-28 pt-5">
      <header className="flex items-center gap-3">
        <button type="button" className="btn-paper reader-header-button" onClick={onBack} aria-label="بازگشت به نقشه"><BackIcon className="h-5 w-5" /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold">مرور هوشمند</h1>
          <p className="mt-1 text-xs" style={{ color: 'var(--ink-soft)' }}>هر کارت ضعیف‌ترین مهارت همان واژه را هدف می‌گیرد</p>
        </div>
        <span className="mastery-chip">هدف {faNum(state.dailyReviewGoal)}</span>
      </header>

      <div className="compact-summary mt-5" aria-label="خلاصهٔ مرور">
        <div><b>{faNum(due.length)}</b><span>سررسید</span></div>
        <div><b>{faNum(remediation.length)}</b><span>ترمیم آزمون</span></div>
        <div><b>{faNum(counts.mastered)}</b><span>مسلط</span></div>
      </div>

      {resumedDraft && sessionTotal > 0 && (
        <div className="prep-resume-row mt-3" role="status">
          <span>جلسهٔ مرور بازیابی شد؛ پاسخ‌های قبلاً ثبت‌شده دوباره شمرده نمی‌شوند.</span>
        </div>
      )}

      {sessionTotal === 0 ? (
        <div className="learning-focus-card mt-6 p-6 text-center">
          <CheckIcon className="mx-auto h-9 w-9" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-extrabold">مرور ضروری نداری</h2>
          <p className="mt-2 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>اگر واژه‌ای معرفی شده باشد، تمرین تقویتی روی ضعیف‌ترین واژه‌ها به‌صورت خودکار ساخته می‌شود.</p>
        </div>
      ) : !currentWord || !question ? (
        <div className="learning-focus-card mt-6 p-6 text-center" role="status">
          <BadgeCheckIcon className="mx-auto h-10 w-10" aria-hidden="true" />
          <h2 className="mt-3 text-2xl font-extrabold">جلسه تمام شد</h2>
          <p className="mt-2 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
            {practiceSession
              ? `${faNum(correctCount)} پاسخ درست در اولین تلاش. این تمرین در حالت کاوش بود و در پیشرفتت ثبت نمی‌شود.`
              : `${faNum(correctCount)} بازیابی مستقل ثبت شد و ${faNum(relearnedCount)} واژه بعد از بازخورد دوباره ساخته شد. پاسخ درست پس از دیدن جواب عمداً شواهد تسلط محسوب نمی‌شود.`}
          </p>
          <button type="button" className="btn-ink mt-5 w-full py-3" onClick={() => { clearReviewDraft(); onBack() }}>بازگشت به مسیر</button>
        </div>
      ) : (
        <div ref={cardRef} className="learning-focus-card review-focus-card mt-6 p-5 sm:p-6">
          <div className="flex items-center justify-between text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>
            <span>{sessionLabel}</span>
            <span>{faNum(completed)} از {faNum(sessionTotal)}</span>
          </div>
          <div className="mastery-progress mt-3"><span style={{ width: `${Math.min(100, (completed / sessionTotal) * 100)}%` }} /></div>

          <div className="mt-5 flex items-center justify-between gap-2">
            <span className="mastery-chip">مهارت هدف: {weaknessLabel(mode)}</span>
            <span className="text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>{modeLabel(mode)}</span>
          </div>

          <div className="mt-6 text-center">
            {mode === 'spelling' ? (
              <>
                <div className="text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>واژه را گوش کن؛ متن انگلیسی پنهان می‌ماند.</div>
                {question.hintFa && <SpellingHint meaning={question.hintFa} />}
                <button type="button" className="btn-paper mt-4 px-5 py-3 text-lg" onClick={() => { setAudioReady(false); speakCurrent() }}><span className="inline-flex items-center gap-2"><SpeakerIcon className="h-5 w-5" />پخش واژه</span></button>
                {audioNotice && <div className="paper-note mt-3 text-right" role="alert">{audioNotice}</div>}
                {!audioReady && !audioNotice && <div className="mt-3 text-xs leading-6" role="status" style={{ color: 'var(--ink-soft)' }}>برای پاسخ، ابتدا واژه را کامل گوش کن.</div>}
              </>
            ) : (
              <div data-testid="review-prompt" className={`text-2xl font-extrabold ${question.promptDir === 'ltr' ? 'font-en' : ''}`} dir={question.promptDir}>{question.prompt}</div>
            )}
          </div>

          {typedMode ? (
            <div className="mt-6">
              <label htmlFor="review-answer" className="block text-sm font-bold">
                {mode === 'spelling' ? 'آنچه شنیدی را به انگلیسی بنویس' : mode === 'contextProductive' ? 'واژهٔ جاافتاده را بنویس' : 'واژهٔ انگلیسی را از حافظه بنویس'}
              </label>
              <input
                id="review-answer"
                ref={answerInputRef}
                className="answer-input mt-2 w-full"
                dir="ltr"
                autoFocus
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="done"
                disabled={Boolean(feedback) || answerLocked}
                value={typed}
                onChange={event => setTyped(event.target.value)}
                onKeyDown={event => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  submitTyped()
                }}
              />
              {!feedback && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" className="btn-quiet py-3 text-sm" disabled={answerLocked} onClick={() => commit(false)}>نمی‌دانم</button>
                  <button type="button" className="btn-ink py-3" disabled={!typed.trim() || answerLocked} onClick={submitTyped}>ثبت پاسخ</button>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6" dir={mode === 'reverse' ? 'rtl' : 'ltr'}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {question.options?.map(option => {
                  const isAnswer = option.id === question.answerId
                  const isSelected = selected === option.id
                  let cls = 'btn-paper min-h-14 px-3 py-3'
                  if (mode !== 'reverse') cls += ' font-en'
                  if (feedback && isAnswer) cls += ' answer-correct'
                  else if (feedback && isSelected) cls += ' answer-wrong'
                  return (
                    <button key={option.id} type="button" className={cls} disabled={Boolean(feedback)} onClick={() => { setSelected(option.id); commit(option.id === question.answerId) }}>
                      {option.label}
                    </button>
                  )
                })}
              </div>
              {!feedback && <button type="button" className="btn-quiet mt-3 w-full py-2.5 text-sm" onClick={() => commit(false)}>نمی‌دانم — پاسخ را نشان بده</button>}
            </div>
          )}

          {feedback && (
            <div className={`feedback-panel mt-4 p-3 text-sm ${feedback === 'correct' ? 'feedback-correct' : 'feedback-wrong'}`} role="status">
              {feedback === 'correct' ? (
                practiceSession ? <><b>درست.</b> این تمرین ثبت نمی‌شود.</> : (
                <>
                  <b>درست.</b> این پاسخ به مهارت «{weaknessLabel(mode)}» همان واژه اضافه شد. اگر بازیابی مستقل و در یک روز جدید باشد، زمان مرور بعدی بر اساس مدل حافظه تنظیم می‌شود.
                </>
                )
              ) : (
                <div>
                  <div className="text-xs font-bold" style={{ color: 'var(--crimson-deep)' }}>ترمیم ضعف: {weaknessLabel(mode)}</div>
                  <div className="mt-1">پاسخ درست: <b className="font-en text-base" dir="ltr">{currentWord.word}</b> — <b>{currentWord.fa}</b></div>
                  {mode === 'spelling' && currentWord.ipa && <div className="mt-2 font-en" dir="ltr">/{currentWord.ipa}/</div>}
                  {currentWord.ex && <div className="mt-2 font-en" dir="ltr">{currentWord.ex}</div>}
                  {currentWord.tr && <div className="mt-1" dir="rtl" style={{ color: 'var(--ink-soft)' }}>{currentWord.tr}</div>}
                  <button type="button" className="btn-paper mt-3 px-3 py-2 text-xs" onClick={speakCurrent}><span className="inline-flex items-center gap-2"><SpeakerIcon className="h-4 w-4" />شنیدن واژه</span></button>
                  {audioNotice && <div className="paper-note mt-2" role="alert">{audioNotice}</div>}
                  <div className="mt-2 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>این کارت در انتهای همین جلسه برمی‌گردد، اما پاسخ بعد از این بازخورد شواهد مستقل تسلط نیست.</div>
                </div>
              )}
            </div>
          )}
          {feedback && <button ref={nextCardRef} type="button" className="btn-ink mt-4 w-full py-3" onClick={nextCard}>کارت بعدی ←</button>}
        </div>
      )}
    </div>
  )
}