import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CHAPTER_BY_ID, VOCAB, WORD_BY_ID } from '../data/chapters'
import type { GhesseState } from '../engine/types'
import { listeningChoiceOptions } from '../engine/review'
import { buildPrepTestOrders } from '../engine/prepOrder'
import { canPrepareChapter, chapterPrepared } from '../engine/gates'
import { recordPreparedChapter } from '../engine/progress'
import { speakEnglishWithFallback, speechFailureNotice, type SpeechFailure } from '../engine/narration'
import { BackIcon, PauseIcon, PlayIcon, SpeakerIcon } from '../components/Icons'
import { clearPrepDraft, loadPrepDraft, savePrepDraft, type PrepFeedback, type PrepPhase } from '../engine/prepDraft'
import { isHeadwordTranslationCorrect } from '../engine/persianTranslation'
import { persianPartOfSpeech } from '../engine/partOfSpeech'
import { faNum } from '../engine/format'
import { autoTeachReflectionPauseMs } from '../engine/teachTiming'
import { clearDiagnosticFailure } from '../engine/diagnosticDraft'
import PronunciationPractice from '../components/PronunciationPractice'
import ActiveUsePractice from '../components/ActiveUsePractice'

interface Props {
  chapterId: string
  state: GhesseState
  onChange: (next: GhesseState) => void
  onBack: () => void
  onReady: () => void
}

const PREP_STEPS: { label: string; target: PrepPhase | 'story' }[] = [
  { label: 'آموزش', target: 'teach' },
  { label: 'ترجمهٔ نوشتاری', target: 'written' },
  { label: 'شنیداری', target: 'listening' },
  { label: 'قصه', target: 'story' },
]

export default function WordPrepScreen({ chapterId, state, onChange, onBack, onReady }: Props) {
  const chapter = CHAPTER_BY_ID.get(chapterId)!
  const alreadyPrepared = chapterPrepared(state, chapterId)
  // Opened through explore mode before the learner reached it: the lessons
  // and tests work as practice, but passing them records nothing.
  const [preview] = useState(() => !canPrepareChapter(state, chapterId))
  // Explore mode opens every step of the prep at once: the lesson cards move
  // on without waiting for audio and the stepper jumps to any step. Passing
  // still records only when both tests were fully passed (recordPreparedChapter).
  const explore = state.exploreAll
  const { writtenOrder, listeningOrder } = useMemo(
    () => buildPrepTestOrders(chapterId, chapter.new),
    [chapter.new, chapterId],
  )

  const [initialDraft] = useState(() => alreadyPrepared ? undefined : loadPrepDraft(chapterId, chapter.new))
  const [resumedDraft, setResumedDraft] = useState(Boolean(initialDraft))
  const [phase, setPhase] = useState<PrepPhase>(() => initialDraft?.phase ?? 'teach')
  const [teachIndex, setTeachIndex] = useState(() => initialDraft?.teachIndex ?? 0)

  const [writtenQueue, setWrittenQueue] = useState<string[]>(() => initialDraft?.writtenQueue ?? [...writtenOrder])
  const [writtenPassed, setWrittenPassed] = useState<Set<string>>(() => new Set(initialDraft?.writtenPassed ?? []))
  const [writtenMissed, setWrittenMissed] = useState<Set<string>>(() => new Set(initialDraft?.writtenMissed ?? []))

  const [listeningQueue, setListeningQueue] = useState<string[]>(() => initialDraft?.listeningQueue ?? [])
  const [listeningPassed, setListeningPassed] = useState<Set<string>>(() => new Set(initialDraft?.listeningPassed ?? []))
  const [listeningMissed, setListeningMissed] = useState<Set<string>>(() => new Set(initialDraft?.listeningMissed ?? []))

  const [feedback, setFeedback] = useState<PrepFeedback>(() => initialDraft?.feedback ?? null)
  const [selected, setSelected] = useState(() => initialDraft?.selected ?? '')
  const [typed, setTyped] = useState(() => initialDraft?.typed ?? '')
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [audioNotice, setAudioNotice] = useState('')
  const [listeningReady, setListeningReady] = useState(false)
  // Counts listening items shown. A missed word goes back into the queue and,
  // when it is the only one left, returns at once with the same id; the new
  // turn still speaks it again, so its answers unlock without a manual replay.
  const [listeningTurn, setListeningTurn] = useState(0)
  const [teachAudioReady, setTeachAudioReady] = useState(false)
  const [teachAutoPlay, setTeachAutoPlay] = useState(false)
  const [teachAutoExampleDone, setTeachAutoExampleDone] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const writtenInputRef = useRef<HTMLInputElement>(null)
  const retryContinueRef = useRef<HTMLButtonElement>(null)
  const focusRetryContinueRef = useRef(false)
  const continueTeachRef = useRef<() => void>(() => {})
  const continueWrittenRef = useRef<() => void>(() => {})
  const continueListeningRef = useRef<() => void>(() => {})
  const hasMountedRef = useRef(false)

  const currentTeachId = chapter.new[teachIndex]
  const currentTeachWord = currentTeachId ? WORD_BY_ID.get(currentTeachId) : undefined

  const currentWrittenId = writtenQueue[0]
  const currentWrittenWord = currentWrittenId ? WORD_BY_ID.get(currentWrittenId) : undefined

  const currentListeningId = listeningQueue[0]
  const currentListeningWord = currentListeningId ? WORD_BY_ID.get(currentListeningId) : undefined
  const listeningOptions = useMemo(
    () => currentListeningWord
      ? listeningChoiceOptions(
          currentListeningWord,
          VOCAB,
          `${chapterId}:prep-listening:${listeningPassed.size}:${listeningQueue.length}:${currentListeningId}`,
        )
      : undefined,
    [chapterId, currentListeningId, currentListeningWord, listeningPassed.size, listeningQueue.length],
  )

  const speak = useCallback((word: string, unlockListening = false, unlockTeach = false) => {
    if (!state.soundOn) return
    const unavailable = (failure: SpeechFailure = 'unavailable') => {
      if (unlockListening) setListeningReady(false)
      if (unlockTeach) {
        setTeachAudioReady(true)
        setTeachAutoPlay(false)
      }
      setAudioBlocked(true)
      setAudioNotice(speechFailureNotice(failure, 'پخش تلفظ انگلیسی روی این دستگاه در دسترس نیست. صدای English Text-to-Speech مرورگر یا سیستم را فعال کن و دوباره «پخش» را بزن.'))
    }
    const ended = () => {
      if (unlockListening) setListeningReady(true)
      if (unlockTeach) setTeachAudioReady(true)
      setAudioBlocked(false)
      setAudioNotice('')
    }
    const started = speakEnglishWithFallback(
      word,
      state.narratorVoiceURI,
      state.narratorRate,
      'w',
      ended,
      unavailable,
    )
    if (!started) unavailable()
  }, [state.narratorRate, state.narratorVoiceURI, state.soundOn])

  const speakExample = useCallback((autoCycle = false) => {
    if (!currentTeachWord || !state.soundOn) return
    setTeachAudioReady(false)
    setAudioBlocked(false)
    setAudioNotice('')
    const unavailable = (failure: SpeechFailure = 'unavailable') => {
      setTeachAudioReady(true)
      setTeachAutoPlay(false)
      setAudioBlocked(true)
      setAudioNotice(speechFailureNotice(failure, 'پخش مثال انگلیسی روی این دستگاه در دسترس نیست. صدای English Text-to-Speech مرورگر یا سیستم را فعال کن و دوباره امتحان کن.'))
    }
    const started = speakEnglishWithFallback(
      currentTeachWord.ex,
      state.narratorVoiceURI,
      state.narratorRate,
      's',
      () => {
        if (autoCycle) setTeachAutoExampleDone(true)
        setTeachAudioReady(true)
        setAudioBlocked(false)
        setAudioNotice('')
      },
      unavailable,
    )
    if (!started) unavailable()
  }, [currentTeachWord, state.narratorRate, state.narratorVoiceURI, state.soundOn])

  useEffect(() => {
    const word = phase === 'teach'
      ? currentTeachWord
      : phase === 'listening'
        ? currentListeningWord
        : undefined
    if (!word || !state.soundOn) return
    const timer = window.setTimeout(() => {
      setAudioBlocked(false)
      setAudioNotice('')
      if (phase === 'listening') setListeningReady(false)
      if (phase === 'teach') {
        setTeachAudioReady(false)
        setTeachAutoExampleDone(false)
      }
      speak(word.word, phase === 'listening', phase === 'teach')
    }, 90)
    return () => window.clearTimeout(timer)
  }, [currentListeningWord, currentTeachWord, listeningTurn, phase, speak, state.soundOn])

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    stageRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }, [phase, teachIndex, currentWrittenId, currentListeningId])

  useEffect(() => {
    if (phase !== 'written' || feedback) return
    const frame = window.requestAnimationFrame(() => writtenInputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [currentWrittenId, feedback, phase])

  // A miss disables the answer controls, so hand focus to the retry button
  // instead of dropping it to the page (Enter -> read correction -> Enter).
  useEffect(() => {
    if (feedback !== 'wrong' || !focusRetryContinueRef.current) return
    focusRetryContinueRef.current = false
    // Next frame, so the Enter that submitted the answer cannot also
    // activate the retry button.
    const frame = window.requestAnimationFrame(() => retryContinueRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [feedback])

  useEffect(() => {
    if (alreadyPrepared || (phase === 'teach' && teachIndex === 0)) {
      clearPrepDraft(chapterId)
      return
    }
    savePrepDraft({
      version: 1,
      chapterId,
      phase,
      teachIndex,
      writtenQueue,
      writtenPassed: [...writtenPassed],
      writtenMissed: [...writtenMissed],
      listeningQueue,
      listeningPassed: [...listeningPassed],
      listeningMissed: [...listeningMissed],
      feedback,
      selected,
      typed,
      updatedAt: Date.now(),
    }, chapter.new)
  }, [
    alreadyPrepared,
    chapter.new,
    chapterId,
    feedback,
    listeningMissed,
    listeningPassed,
    listeningQueue,
    phase,
    selected,
    teachIndex,
    typed,
    writtenMissed,
    writtenPassed,
    writtenQueue,
  ])

  function enableSound() {
    onChange({ ...state, soundOn: true })
  }

  function restartPrep() {
    clearPrepDraft(chapterId)
    setResumedDraft(false)
    setPhase('teach')
    setTeachIndex(0)
    setWrittenQueue([...writtenOrder])
    setWrittenPassed(new Set())
    setWrittenMissed(new Set())
    setListeningQueue([])
    setListeningPassed(new Set())
    setListeningMissed(new Set())
    setFeedback(null)
    setSelected('')
    setTyped('')
    setAudioBlocked(false)
    setAudioNotice('')
    setListeningReady(false)
    setTeachAudioReady(false)
    setTeachAutoPlay(false)
    setTeachAutoExampleDone(false)
  }

  function jumpTo(target: PrepPhase | 'story') {
    setFeedback(null)
    setSelected('')
    setTyped('')
    setAudioBlocked(false)
    setAudioNotice('')
    setTeachAutoPlay(false)
    setTeachAutoExampleDone(false)
    if (target === 'story') {
      onReady()
      return
    }
    if (target === 'teach') {
      setTeachIndex(0)
      setTeachAudioReady(false)
    }
    if (target === 'written') {
      setWrittenQueue([...writtenOrder])
      setWrittenPassed(new Set())
      setWrittenMissed(new Set())
    }
    if (target === 'listening') {
      setListeningQueue([...listeningOrder])
      setListeningPassed(new Set())
      setListeningMissed(new Set())
      setListeningReady(false)
    }
    setPhase(target)
  }

  function previousTeach() {
    if ((!teachAudioReady && !explore) || teachIndex === 0) return
    setTeachAutoPlay(false)
    setTeachAudioReady(false)
    setTeachAutoExampleDone(false)
    setTeachIndex(index => Math.max(0, index - 1))
  }

  function continueTeach() {
    if (!currentTeachWord || (!teachAudioReady && !explore)) return
    if (teachIndex + 1 < chapter.new.length) {
      setTeachAudioReady(false)
      setTeachAutoExampleDone(false)
      setTeachIndex(index => index + 1)
      return
    }
    setWrittenQueue([...writtenOrder])
    setWrittenPassed(new Set())
    setWrittenMissed(new Set())
    setTyped('')
    setFeedback(null)
    setTeachAutoPlay(false)
    setTeachAutoExampleDone(false)
    setPhase('written')
  }

  function submitWritten() {
    if (!currentWrittenWord || !currentWrittenId || !typed.trim() || feedback) return
    const correct = isHeadwordTranslationCorrect(typed, currentWrittenWord, VOCAB)
    if (!correct) setWrittenMissed(previous => new Set(previous).add(currentWrittenId))
    focusRetryContinueRef.current = !correct
    setFeedback(correct ? 'correct' : 'wrong')
  }

  function dontKnowWritten() {
    if (!currentWrittenId || feedback) return
    setWrittenMissed(previous => new Set(previous).add(currentWrittenId))
    setTyped('')
    focusRetryContinueRef.current = true
    setFeedback('wrong')
  }

  function continueWritten() {
    if (!currentWrittenId || !feedback) return
    const correct = feedback === 'correct'
    const passed = new Set(writtenPassed)
    if (correct) passed.add(currentWrittenId)
    const rest = writtenQueue.slice(1)
    const nextQueue = correct ? rest : [...rest, currentWrittenId]

    setWrittenPassed(passed)
    setWrittenQueue(nextQueue)
    setFeedback(null)
    setTyped('')

    if (nextQueue.length === 0) {
      setListeningQueue([...listeningOrder])
      setListeningPassed(new Set())
      setListeningMissed(new Set())
      setSelected('')
      setListeningReady(false)
      setPhase('listening')
    }
  }

  function chooseListening(optionId: string) {
    if (!listeningOptions || !currentListeningId || feedback || !state.soundOn || audioBlocked || !listeningReady) return
    const correct = optionId === currentListeningId
    setSelected(optionId)
    if (!correct) setListeningMissed(previous => new Set(previous).add(currentListeningId))
    focusRetryContinueRef.current = !correct
    setFeedback(correct ? 'correct' : 'wrong')
  }

  function dontKnowListening() {
    if (!currentListeningId || feedback || !state.soundOn || audioBlocked || !listeningReady) return
    setSelected('')
    setListeningMissed(previous => new Set(previous).add(currentListeningId))
    focusRetryContinueRef.current = true
    setFeedback('wrong')
  }

  function continueListening() {
    if (!currentListeningId || !feedback) return
    const correct = feedback === 'correct'
    const passed = new Set(listeningPassed)
    if (correct) passed.add(currentListeningId)
    const rest = listeningQueue.slice(1)
    const nextQueue = correct ? rest : [...rest, currentListeningId]

    setListeningPassed(passed)
    setListeningQueue(nextQueue)
    setListeningTurn(turn => turn + 1)
    setFeedback(null)
    setSelected('')
    setListeningReady(false)

    if (nextQueue.length === 0 && preview) {
      clearPrepDraft(chapterId)
      onReady()
      return
    }
    if (nextQueue.length === 0) {
      const nextState = recordPreparedChapter(
        state,
        chapterId,
        chapter.new,
        [...writtenPassed],
        [...passed],
        [...writtenMissed],
        [...listeningMissed],
        Date.now(),
      )
      clearPrepDraft(chapterId)
      clearDiagnosticFailure(chapterId)
      onChange(nextState)
      onReady()
    }
  }

  useEffect(() => {
    continueTeachRef.current = continueTeach
    continueWrittenRef.current = continueWritten
    continueListeningRef.current = continueListening
  })

  useEffect(() => {
    if (phase !== 'teach' || !teachAutoPlay || !teachAudioReady || audioBlocked) return

    if (!teachAutoExampleDone) {
      const exampleTimer = window.setTimeout(() => {
        speakExample(true)
      }, 450)
      return () => window.clearTimeout(exampleTimer)
    }

    const advanceTimer = window.setTimeout(() => {
      continueTeachRef.current()
    }, autoTeachReflectionPauseMs(currentTeachWord?.tr ?? ''))

    return () => window.clearTimeout(advanceTimer)
  }, [
    audioBlocked,
    currentTeachId,
    currentTeachWord,
    phase,
    speakExample,
    teachAutoExampleDone,
    teachAudioReady,
    teachAutoPlay,
  ])

  useEffect(() => {
    if (feedback !== 'correct') return
    if (phase !== 'written' && phase !== 'listening') return

    const timer = window.setTimeout(() => {
      if (phase === 'written') continueWrittenRef.current()
      else continueListeningRef.current()
    }, 650)

    return () => window.clearTimeout(timer)
  }, [currentListeningId, currentWrittenId, feedback, phase])

  const step = phase === 'teach' ? 1 : phase === 'written' ? 2 : 3

  return (
    <div className="app-page page-in">
      <header className="sticky top-0 z-40 app-task-header">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <button type="button" className="btn-paper reader-header-button" onClick={onBack} aria-label="بازگشت به نقشه"><BackIcon className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1">
            <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>آمادگی فصل {faNum(chapter.n)} · کتاب {faNum(chapter.book)}</div>
            <h1 className="truncate text-lg font-extrabold">واژه‌های تازه: {chapter.titleFa}</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pb-28 pt-5">
        {preview && (
          <div className="explore-note mb-4" role="status">
            <span><b>پیش‌نمایش در حالت کاوش.</b> هنوز به این فصل نرسیده‌ای؛ آموزش و آزمون‌های اینجا تمرین‌اند و ثبت نمی‌شوند.</span>
          </div>
        )}

        {alreadyPrepared && phase === 'teach' && (
          <div className="paper-note mb-4">
            آمادگی این فصل کامل است.
            <button type="button" className="btn-ink mt-3 w-full py-2.5" onClick={onReady}>ورود مستقیم به قصه ←</button>
          </div>
        )}

        <ol className="prep-stepper" aria-label="مرحله‌های آمادگی">
          {PREP_STEPS.map(({ label, target }, index) => (
            <li
              key={label}
              className={step === index + 1 ? 'active' : step > index + 1 ? 'done' : ''}
              aria-current={step === index + 1 ? 'step' : undefined}
            >
              {explore
                ? <button type="button" className="prep-step-jump" onClick={() => jumpTo(target)}>{faNum(index + 1)}. {label}</button>
                : <>{faNum(index + 1)}. {label}</>}
            </li>
          ))}
        </ol>
        {explore && (
          <p className="mt-2 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
            برای دیدن هر مرحله، نام آن را انتخاب کن.
          </p>
        )}

        {resumedDraft && !alreadyPrepared && (
          <div className="prep-resume-row mt-3" role="status">
            <span>پیشرفت این جلسه بازیابی شد؛ از همان‌جایی که رها کردی ادامه بده.</span>
            <button type="button" className="btn-quiet shrink-0 px-3 text-xs" onClick={restartPrep}>شروع از اول</button>
          </div>
        )}

        {audioNotice && phase !== 'written' && (
          <div className="paper-note mt-3" role="alert">
            {audioNotice}
            {phase === 'listening' && <div className="mt-1 text-xs">تا یک پخش موفق، گزینه‌های آزمون شنیداری غیرفعال می‌مانند.</div>}
          </div>
        )}

        {phase === 'teach' && currentTeachWord && (
          <div ref={stageRef} className="learning-focus-card mt-5 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>واژهٔ {faNum(teachIndex + 1)} از {faNum(chapter.new.length)}</span>
              <button
                type="button"
                className={teachAutoPlay ? 'btn-ink px-3 py-2.5 text-sm' : 'btn-quiet px-3 py-2.5 text-sm'}
                aria-pressed={teachAutoPlay}
                aria-label={teachAutoPlay ? 'توقف آموزش خودکار' : 'شروع آموزش خودکار'}
                disabled={!state.soundOn || audioBlocked}
                onClick={() => setTeachAutoPlay(value => !value)}
              >
                <span className="inline-flex items-center gap-2">
                  {teachAutoPlay ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
                  {teachAutoPlay ? 'توقف خودکار' : 'آموزش خودکار'}
                </span>
              </button>
            </div>
            <div className="mastery-progress mt-2">
              <span style={{ width: `${((teachIndex + 1) / chapter.new.length) * 100}%` }} />
            </div>
            {!state.soundOn && (
              <div className="paper-note mt-4">
                {explore
                  ? 'برای شنیدن تلفظ و مثال‌ها صدا را روشن کن.'
                  : 'آموزش هر واژه با شنیدن تلفظ آن کامل می‌شود؛ تا صدا روشن نشود، واژهٔ بعدی باز نمی‌شود.'}
                <button type="button" className="btn-ink mt-2 w-full py-2.5" onClick={enableSound}>روشن کردن صدا</button>
              </div>
            )}

            <div className="mt-5 text-center">
              <div data-testid="teach-headword" className="font-en text-4xl font-bold" lang="en" dir="ltr">{currentTeachWord.word}</div>
              {currentTeachWord.ipa && <div className="mt-2 font-en text-sm" lang="en" dir="ltr">/{currentTeachWord.ipa}/</div>}
              <div className="mt-3 flex justify-center">
                <span className="lexical-role-chip">{persianPartOfSpeech(currentTeachWord.pos)}</span>
              </div>
              <div className="mt-4 text-3xl font-extrabold">{currentTeachWord.fa}</div>
              <button
                type="button"
                className="btn-quiet mt-3 px-4 py-2.5 text-sm"
                onClick={() => {
                  setTeachAutoPlay(false)
                  setTeachAudioReady(false)
                  setTeachAutoExampleDone(false)
                  speak(currentTeachWord.word, false, true)
                }}
                disabled={!state.soundOn || !teachAudioReady}
                aria-label="پخش دوبارهٔ تلفظ واژه"
              >
                <span className="inline-flex items-center gap-2"><SpeakerIcon className="h-5 w-5" />پخش دوباره</span>
              </button>
            </div>

            <div className="learning-example mt-5 pt-4">
              <div className="font-en text-lg leading-8" lang="en" dir="ltr">{currentTeachWord.ex}</div>
              <div className="mt-2 text-sm leading-7" dir="rtl" style={{ color: 'var(--ink-soft)' }}>{currentTeachWord.tr}</div>
              <button
                type="button"
                className="btn-quiet mt-3 px-3 py-2.5 text-sm"
                onClick={() => { setTeachAutoPlay(false); speakExample() }}
                disabled={!state.soundOn || !teachAudioReady}
                aria-label="شنیدن مثال"
              >
                <span className="inline-flex items-center gap-2"><SpeakerIcon className="h-4 w-4" />شنیدن مثال</span>
              </button>

              <PronunciationPractice
                key={currentTeachWord.id}
                word={currentTeachWord.word}
                soundOn={state.soundOn}
                narratorVoiceURI={state.narratorVoiceURI}
                narratorRate={state.narratorRate}
                disabled={!teachAudioReady || teachAutoPlay || audioBlocked}
              />

              <ActiveUsePractice
                key={`active-${currentTeachWord.id}`}
                word={currentTeachWord}
                soundOn={state.soundOn}
                narratorVoiceURI={state.narratorVoiceURI}
                narratorRate={state.narratorRate}
                disabled={!teachAudioReady || teachAutoPlay || audioBlocked}
              />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <button
                type="button"
                className="btn-quiet py-3 text-sm"
                disabled={(!teachAudioReady && !explore) || teachIndex === 0}
                onClick={previousTeach}
              >
                قبلی
              </button>
              <button type="button" className="btn-ink col-span-2 py-3" disabled={!teachAudioReady && !explore} onClick={continueTeach}>
                {teachIndex + 1 < chapter.new.length ? 'واژهٔ بعدی ←' : 'شروع آزمون ترجمهٔ نوشتاری ←'}
              </button>
            </div>
          </div>
        )}

        {phase === 'written' && currentWrittenWord && (
          <div ref={stageRef} className="learning-focus-card mt-5 p-5 sm:p-6">
            <div className="flex items-center justify-between text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>
              <span>ترجمهٔ نوشتاری · ۱۰۰٪</span>
              <span>{faNum(writtenPassed.size)} از {faNum(chapter.new.length)}</span>
            </div>
            <div className="mastery-progress mt-3">
              <span style={{ width: `${(writtenPassed.size / chapter.new.length) * 100}%` }} />
            </div>

            <div className="mt-7 text-center">
              <div className="text-sm" style={{ color: 'var(--ink-soft)' }}>یک معنی درست را به فارسی بنویس</div>
              <div data-testid="written-headword" className="mt-2 font-en text-4xl font-bold" lang="en" dir="ltr">{currentWrittenWord.word}</div>
            </div>

            <label htmlFor="prep-written" className="mt-6 block text-sm font-bold">ترجمهٔ فارسی</label>
            <input
              id="prep-written"
              ref={writtenInputRef}
              className="answer-input mt-2 w-full"
              dir="rtl"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              disabled={Boolean(feedback)}
              value={typed}
              onChange={event => setTyped(event.target.value)}
              onKeyDown={event => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                submitWritten()
              }}
            />

            {!feedback && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" className="btn-quiet py-3 text-sm" onClick={dontKnowWritten}>نمی‌دانم</button>
                <button type="button" className="btn-ink py-3" disabled={!typed.trim()} onClick={submitWritten}>ثبت پاسخ</button>
              </div>
            )}

            {feedback && (
              <div className={`feedback-panel mt-4 p-3 text-sm ${feedback === 'correct' ? 'feedback-correct' : 'feedback-wrong'}`} role="status">
                {feedback === 'correct'
                  ? 'درست ✓ · رفتن به واژهٔ بعدی…'
                  : <>معنی درست: <b>{currentWrittenWord.fa}</b>. این واژه دوباره در همین آزمون می‌آید.</>}
              </div>
            )}

            {feedback === 'wrong' && (
              <button ref={retryContinueRef} type="button" className="btn-ink mt-4 w-full py-3" onClick={continueWritten}>
                ادامه و تکرار این واژه ←
              </button>
            )}
          </div>
        )}

        {phase === 'listening' && currentListeningWord && listeningOptions && (
          <div ref={stageRef} className="learning-focus-card mt-5 p-5 sm:p-6">
            <div className="flex items-center justify-between text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>
              <span>شنیداری · ۱۰۰٪</span>
              <span>{faNum(listeningPassed.size)} از {faNum(chapter.new.length)}</span>
            </div>
            <div className="mastery-progress mt-3">
              <span style={{ width: `${(listeningPassed.size / chapter.new.length) * 100}%` }} />
            </div>

            {!state.soundOn ? (
              <div className="paper-note mt-5">
                آزمون شنیداری بدون صدا قابل انجام نیست.
                <button type="button" className="btn-ink mt-3 w-full py-2.5" onClick={enableSound}>روشن کردن صدا و پخش واژه</button>
              </div>
            ) : (
              <>
                <div className="mt-7 text-center">
                  <div className="text-sm" style={{ color: 'var(--ink-soft)' }}>واژه را گوش کن و معنی درست را انتخاب کن</div>
                  <button
                    type="button"
                    className="btn-paper mt-4 min-h-20 w-full text-2xl"
                    onClick={() => { setListeningReady(false); speak(currentListeningWord.word, true) }}
                    aria-label="پخش دوبارهٔ واژه"
                  >
                    <span className="inline-flex items-center justify-center gap-2"><SpeakerIcon className="h-6 w-6" />پخش دوباره</span>
                  </button>
                  {!listeningReady && !audioNotice && (
                    <div className="mt-3 text-xs leading-6" role="status" style={{ color: 'var(--ink-soft)' }}>
                      برای پاسخ، ابتدا واژه را تا پایان گوش کن.
                    </div>
                  )}
                </div>

                <div data-testid="listening-options" className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2" dir="rtl">
                  {listeningOptions.map(option => {
                    const isAnswer = option.id === currentListeningId
                    const isSelected = selected === option.id
                    let className = 'btn-paper min-h-14 px-3 py-3'
                    if (feedback && isAnswer) className += ' answer-correct'
                    else if (feedback && isSelected) className += ' answer-wrong'
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={className}
                        disabled={Boolean(feedback) || audioBlocked || !listeningReady}
                        onClick={() => chooseListening(option.id)}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>

                {!feedback && (
                  <button type="button" className="btn-quiet mt-3 w-full py-2.5 text-sm" disabled={audioBlocked || !listeningReady} onClick={dontKnowListening}>
                    نمی‌دانم — نشان بده و دوباره بپرس
                  </button>
                )}
              </>
            )}

            {feedback && (
              <div className={`feedback-panel mt-4 p-3 text-sm ${feedback === 'correct' ? 'feedback-correct' : 'feedback-wrong'}`} role="status">
                {feedback === 'correct'
                  ? <><b className="font-en" lang="en" dir="ltr">{currentListeningWord.word}</b> — {currentListeningWord.fa} ✓ · بعدی…</>
                  : <>پاسخ درست: <b className="font-en" lang="en" dir="ltr">{currentListeningWord.word}</b> — {currentListeningWord.fa}. دوباره در همین آزمون می‌آید.</>}
              </div>
            )}

            {feedback === 'wrong' && (
              <button ref={retryContinueRef} type="button" className="btn-ink mt-4 w-full py-3" onClick={continueListening}>
                ادامه و تکرار این واژه ←
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
