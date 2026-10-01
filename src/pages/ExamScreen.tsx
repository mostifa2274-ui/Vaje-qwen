import { useCallback, useEffect, useRef, useState } from 'react'
import type { GhesseState, RetrievalMode, SkillDimension } from '../engine/types'
import { buildExam, emptyComprehensionAnswers, examPool, scoreExam, type BuiltExam, type ExamComprehensionAnswers, type ExamResult } from '../engine/exams'
import { canTakeExam, examDefinition } from '../engine/gates'
import { CHAPTERS, WORD_BY_ID } from '../data/chapters'
import { isQuestionTypedCorrect, isTypedMode, recordRetrieval } from '../engine/review'
import { speakEnglishWithFallback, speechFailureNotice, type SpeechFailure } from '../engine/narration'
import { BackIcon, BadgeCheckIcon, CirclePauseIcon, RefreshCcwIcon, SpeakerIcon } from '../components/Icons'
import SpellingHint from '../components/SpellingHint'
import { ListeningText, ListeningTextReview, Passage, Questions, ReadingTextReview } from '../components/TestPassage'
import type { TestText } from '../data/bookTests'
import { clearExamDraft, EXAM_BREAK_EVERY, examSignature, loadExamDraft, saveExamDraft } from '../engine/examDraft'
import { faNum, percent } from '../engine/format'
import ChapterIllustration from '../components/ChapterIllustration'

interface Props {
  examId: string
  state: GhesseState
  onChange: (next: GhesseState) => void
  onBack: () => void
  onReview: () => void
}

function modeLabel(mode: RetrievalMode): string {
  if (mode === 'productive') return 'معنی → واژه، بدون گزینه'
  if (mode === 'contextProductive') return 'جای خالی، بدون گزینه'
  if (mode === 'spelling') return 'شنیدن و نوشتن'
  if (mode === 'cloze') return 'واژه در بافت'
  if (mode === 'reverse') return 'واژه → معنی'
  return 'معنی → واژه'
}

const SKILL_LABELS: Record<SkillDimension, string> = {
  meaning: 'معنی',
  context: 'بافت',
  production: 'تولید',
  form: 'املاء',
}

type ExamText = { kind: 'reading' | 'listening'; text: TestText; slot: number }

function examTexts(exam: BuiltExam): ExamText[] {
  return [
    ...exam.reading.map((text, slot) => ({ kind: 'reading' as const, text, slot })),
    ...exam.listening.map((text, slot) => ({ kind: 'listening' as const, text, slot })),
  ]
}

function textAnswered(chosen: Array<number | null>): boolean {
  return chosen.every(choice => choice !== null)
}

function wallClockNow(): number {
  return Date.now()
}

export default function ExamScreen({ examId, state, onChange, onBack, onReview }: Props) {
  const previousExam = state.exams[examId]
  const [attempt, setAttempt] = useState(() => (state.exams[examId]?.attempts ?? 0) + 1)
  const [exam, setExam] = useState(() => buildExam(examId, state, (state.exams[examId]?.attempts ?? 0) + 1))
  const [previewRuns, setPreviewRuns] = useState(0)
  // Opened through explore mode before the learner reached it: a preview
  // whose answers are never recorded.
  const [preview] = useState(() => !canTakeExam(state, examId))
  // Explore mode can move between questions without answering. An attempt
  // with a skipped question is practice: scored, but never recorded.
  const explore = state.exploreAll
  const [practice, setPractice] = useState(false)
  const unrecorded = preview || practice
  const [initialDraft] = useState(() => exam ? loadExamDraft(examId, attempt, exam) : undefined)
  const [resumedDraft, setResumedDraft] = useState(Boolean(initialDraft))
  // Set once a question is skipped: the saved draft may then have gaps.
  const [skipped, setSkipped] = useState(() => initialDraft?.skipped === true)
  const [index, setIndex] = useState(() => initialDraft?.index ?? 0)
  const [answers, setAnswers] = useState<Record<number, boolean>>(() => initialDraft?.answers ?? {})
  const [timings, setTimings] = useState<Record<number, number>>(() => initialDraft?.timings ?? {})
  const [typed, setTyped] = useState(() => initialDraft?.typed ?? '')
  const [result, setResult] = useState<ExamResult | null>(null)
  const [onBreak, setOnBreak] = useState(() => initialDraft?.onBreak ?? false)
  // After the word questions: the reading texts, then the listening ones.
  const [stage, setStage] = useState<'words' | 'texts'>(() => initialDraft?.stage === 'texts' ? 'texts' : 'words')
  const [textIndex, setTextIndex] = useState(() => initialDraft?.textIndex ?? 0)
  const [comprehension, setComprehension] = useState<ExamComprehensionAnswers>(() => initialDraft?.comprehension ?? (exam ? emptyComprehensionAnswers(exam) : { reading: [], listening: [] }))
  const [heard, setHeard] = useState<boolean[]>(() => initialDraft?.heard ?? exam?.listening.map(() => false) ?? [])
  const textHeadingRef = useRef<HTMLHeadingElement>(null)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [audioNotice, setAudioNotice] = useState('')
  const [audioReady, setAudioReady] = useState(false)
  const questionStartedAt = useRef(0)
  const questionRef = useRef<HTMLDivElement>(null)
  const answerInputRef = useRef<HTMLInputElement>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    questionStartedAt.current = wallClockNow()
  }, [index, onBreak])

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    if (stage === 'texts') {
      window.scrollTo({ top: 0, behavior: 'auto' })
      textHeadingRef.current?.focus({ preventScroll: true })
      return
    }
    if (!onBreak) questionRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }, [index, onBreak, stage, textIndex])

  useEffect(() => {
    if (!exam || result) return
    const hasMeaningfulProgress = index > 0 || typed.length > 0 || onBreak || stage === 'texts' || Object.keys(answers).length > 0
    if (!hasMeaningfulProgress) {
      clearExamDraft(examId)
      return
    }
    saveExamDraft({
      version: 1,
      examId,
      attempt,
      signature: examSignature(exam),
      index,
      answers,
      timings,
      typed,
      onBreak,
      ...(skipped ? { skipped: true as const } : {}),
      ...(stage === 'texts' ? { stage, textIndex, comprehension, heard } : {}),
      updatedAt: wallClockNow(),
    }, exam)
  }, [answers, attempt, comprehension, exam, examId, heard, index, onBreak, result, skipped, stage, textIndex, timings, typed])

  const question = stage === 'words' ? exam?.questions[index] : undefined
  const word = question ? WORD_BY_ID.get(question.wordId) : undefined

  const speakCurrent = useCallback(() => {
    if (!word || !state.soundOn) return
    const unavailable = (failure: SpeechFailure = 'unavailable') => {
      setAudioReady(false)
      setAudioBlocked(true)
      setAudioNotice(speechFailureNotice(failure, 'پخش تلفظ انگلیسی در دسترس نیست. برای ادامهٔ سؤال شنیداری، صدای English Text-to-Speech مرورگر یا سیستم را فعال کن.'))
    }
    const ended = () => {
      setAudioReady(true)
      setAudioBlocked(false)
      setAudioNotice('')
    }
    const started = speakEnglishWithFallback(
      word.word,
      state.narratorVoiceURI,
      state.narratorRate,
      'w',
      ended,
      unavailable,
    )
    if (!started) unavailable()
  }, [state.narratorRate, state.narratorVoiceURI, state.soundOn, word])

  // Spelling questions speak on arrival; the play button remains for replays.
  const spellingActive = question?.mode === 'spelling' && !onBreak && !result
  useEffect(() => {
    if (!spellingActive) return
    const timer = window.setTimeout(speakCurrent, 90)
    return () => window.clearTimeout(timer)
  }, [index, speakCurrent, spellingActive])

  const typedActive = Boolean(question && isTypedMode(question.mode)) && !onBreak && !result
  const answerLocked = question?.mode === 'spelling' && (audioBlocked || !audioReady)
  useEffect(() => {
    if (!typedActive || answerLocked) return
    const frame = window.requestAnimationFrame(() => answerInputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [answerLocked, index, typedActive])

  const heardText = useCallback((slot: number) => {
    setHeard(previous => previous[slot] ? previous : previous.map((value, index) => index === slot ? true : value))
  }, [])

  if (!exam) return null
  const builtExam: BuiltExam = exam
  const def = examDefinition(examId)!
  const backdropChapter = (def.book
    ? CHAPTERS.find(item => item.book === def.book)
    : [...CHAPTERS].reverse().find(item => state.chapters[item.id]?.completed)) ?? CHAPTERS[0]
  const examBackdrop = (
    <div className="luxury-task-backdrop luxury-exam-backdrop" aria-hidden="true">
      <ChapterIllustration chapterId={backdropChapter.id} titleFa={backdropChapter.titleFa} />
      <span />
    </div>
  )
  const texts = examTexts(builtExam)
  const currentText = stage === 'texts' ? texts[textIndex] : undefined

  function finalize(nextAnswers: Record<number, boolean>, nextTimings: Record<number, number>, built: BuiltExam, nextComprehension: ExamComprehensionAnswers = comprehension) {
    clearExamDraft(examId)
    const scored = scoreExam(built, nextAnswers, nextComprehension)
    const skipped = built.questions.some(item => nextAnswers[item.index] === undefined)
      || [...nextComprehension.reading, ...nextComprehension.listening].some(chosen => !textAnswered(chosen))
    // Re-check immediately before persistence. A route was valid when this
    // attempt started, but replacement/sparse state must never let a stale
    // screen commit cumulative exam evidence after its prerequisites vanish.
    const gateStillOpen = canTakeExam(state, examId)
    setPractice(skipped || !gateStillOpen)
    if (preview || skipped || !gateStillOpen) {
      setResult(scored)
      return
    }
    const now = wallClockNow()
    const words = { ...state.words }
    for (const item of built.questions) {
      const progress = words[item.wordId]
      if (!progress) continue
      words[item.wordId] = recordRetrieval(progress, nextAnswers[item.index] === true, item.mode, now, 'exam', nextTimings[item.index])
    }
    const previous = state.exams[examId]
    const passed = previous?.passed === true || scored.passed
    const testedWordIds = [...new Set([...(previous?.testedWordIds ?? []), ...built.questions.map(item => item.wordId)])]
    const exams = {
      ...state.exams,
      [examId]: {
        attempts: (previous?.attempts ?? 0) + 1,
        passed,
        passedAt: previous?.passedAt ?? (scored.passed ? now : undefined),
        lastAttemptAt: now,
        lastScore: scored.overallScore,
        bestScore: Math.max(previous?.bestScore ?? 0, scored.overallScore),
        lastProductiveScore: scored.productiveScore,
        bestProductiveScore: Math.max(previous?.bestProductiveScore ?? 0, scored.productiveScore),
        missedWordIds: scored.missedWordIds,
        testedWordIds,
      },
    }
    onChange({ ...state, words, exams })
    setResult(scored)
  }

  function answer(correct: boolean) {
    if (!question || result || answerLocked) return
    if (resumedDraft) setResumedDraft(false)
    const elapsed = Math.max(1, wallClockNow() - questionStartedAt.current)
    const nextAnswers = { ...answers, [question.index]: correct }
    const nextTimings = { ...timings, [question.index]: elapsed }
    setAnswers(nextAnswers)
    setTimings(nextTimings)
    setTyped('')
    setAudioBlocked(false)
    setAudioNotice('')
    setAudioReady(false)
    if (index + 1 >= builtExam.questions.length) {
      if (texts.length) openTexts(0)
      else finalize(nextAnswers, nextTimings, builtExam)
    } else {
      const nextIndex = index + 1
      setIndex(nextIndex)
      if (nextIndex % EXAM_BREAK_EVERY === 0) setOnBreak(true)
    }
  }

  function moveTo(nextIndex: number) {
    if (!explore || result) return
    if (resumedDraft) setResumedDraft(false)
    setSkipped(true)
    setTyped('')
    setAudioBlocked(false)
    setAudioNotice('')
    setAudioReady(false)
    if (nextIndex >= builtExam.questions.length) {
      if (texts.length) openTexts(0)
      else finalize(answers, timings, builtExam)
      return
    }
    setIndex(Math.max(0, nextIndex))
  }

  function openTexts(at: number) {
    setOnBreak(false)
    setStage('texts')
    setTextIndex(at)
  }

  function chooseText(item: ExamText, questionIndex: number, option: number) {
    if (resumedDraft) setResumedDraft(false)
    setComprehension(previous => ({
      ...previous,
      [item.kind]: previous[item.kind].map((chosen, slot) => slot === item.slot
        ? chosen.map((value, questionAt) => questionAt === questionIndex ? option : value)
        : chosen),
    }))
  }

  function nextText() {
    if (!currentText) return
    if (resumedDraft) setResumedDraft(false)
    if (textIndex + 1 < texts.length) setTextIndex(textIndex + 1)
    else finalize(answers, timings, builtExam)
  }

  // Explore mode only: move between texts without answering.
  function moveText(to: number) {
    if (!explore || result) return
    if (resumedDraft) setResumedDraft(false)
    setSkipped(true)
    if (to < 0) {
      setStage('words')
      setIndex(builtExam.questions.length - 1)
      return
    }
    if (to >= texts.length) {
      finalize(answers, timings, builtExam)
      return
    }
    setTextIndex(to)
  }

  function submitTyped() {
    if (!question || !word || !typed.trim()) return
    answer(isQuestionTypedCorrect(typed, question))
  }

  function restartExam(built: BuiltExam = builtExam) {
    clearExamDraft(examId)
    setResumedDraft(false)
    setSkipped(false)
    setIndex(0)
    setAnswers({})
    setTimings({})
    setTyped('')
    setOnBreak(false)
    setStage('words')
    setTextIndex(0)
    setComprehension(emptyComprehensionAnswers(built))
    setHeard(built.listening.map(() => false))
    setAudioBlocked(false)
    setAudioNotice('')
    setAudioReady(false)
    questionStartedAt.current = wallClockNow()
  }

  function retake() {
    // An unrecorded run adds no attempt, so it counts its own to vary the texts.
    const extra = unrecorded ? previewRuns + 1 : 0
    if (unrecorded) setPreviewRuns(extra)
    const nextAttempt = (state.exams[examId]?.attempts ?? 0) + 1 + extra
    const next = buildExam(examId, state, nextAttempt)
    if (!next) return
    setAttempt(nextAttempt)
    setExam(next)
    restartExam(next)
    setPractice(false)
    setResult(null)
  }

  if (result) {
    const passedNow = result.passed
    const gateAlreadyPassed = previousExam?.passed === true
    const gateRemainsOpen = passedNow || gateAlreadyPassed
    const totalPool = examPool(examId).length
    const testedCoverage = new Set([...(previousExam?.testedWordIds ?? []), ...builtExam.questions.map(item => item.wordId)]).size
    const textsMissed = result.comprehensionTotal - result.comprehensionCorrect
    const canRetake = unrecorded || (!passedNow && result.missedWordIds.length === 0 && canTakeExam(state, examId))
    return (
      <div className="app-page page-in mx-auto max-w-3xl px-4 pb-28 pt-6">
        <div className={`exam-result-card p-6 text-center ${passedNow ? 'exam-pass' : 'exam-fail'}`}>
          {passedNow
            ? <BadgeCheckIcon className="mx-auto h-11 w-11" aria-hidden="true" />
            : <RefreshCcwIcon className="mx-auto h-10 w-10" aria-hidden="true" />}
          <h1 className="mt-3 text-2xl font-extrabold">
            {passedNow ? 'قبول شدی' : gateAlreadyPassed ? 'این بازآزمایی نیاز به مرور دارد' : 'هنوز آمادهٔ عبور نیستی'}
          </h1>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="metric-card"><b>{percent(result.overallScore)}</b><span>کل آزمون</span></div>
            <div className="metric-card"><b>{percent(result.productiveScore)}</b><span>پاسخ بدون گزینه</span></div>
            <div className={`metric-card ${textsMissed ? 'metric-fail' : ''}`} data-testid="exam-comprehension-score">
              <b>{faNum(result.comprehensionCorrect)}/{faNum(result.comprehensionTotal)}</b><span>درک مطلب</span>
            </div>
            <div className="metric-card"><b>{faNum(testedCoverage)}/{faNum(totalPool)}</b><span>پوشش واژه</span></div>
          </div>

          <div className="exam-summary-panel mt-4 p-3 text-right">
            <div className="text-xs font-extrabold">نقشهٔ مهارت این آزمون</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(Object.keys(SKILL_LABELS) as SkillDimension[]).map(dimension => {
                const score = result.skillScores[dimension]
                const rate = score.total ? score.correct / score.total : 0
                return (
                  <div key={dimension} className="skill-result">
                    <div className="flex items-center justify-between text-xs"><span>{SKILL_LABELS[dimension]}</span><b>{percent(rate)}</b></div>
                    <div className="skill-bar mt-1"><span style={{ width: `${rate * 100}%` }} /></div>
                  </div>
                )
              })}
            </div>
          </div>

          <p className="mt-4 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
            حد عبور: {percent(def.passRate)} کل آزمون، {percent(def.productivePassRate)} یادآوری نوشتاری، و {percent(def.passRate)} درک مطلب.
            {preview
              ? ' پیش‌نمایش در حالت کاوش: این نتیجه ثبت نمی‌شود و مسیری را باز نمی‌کند.'
              : practice
              ? ' تمرین در حالت کاوش: چون سؤالی رد شد، این نتیجه ثبت نمی‌شود.'
              : passedNow
              ? ' قبولی مسیر را باز می‌کند، اما «مسلط» فقط با بازیابی موفق در روزهای مختلف و فاصلهٔ واقعی به دست می‌آید.'
              : result.missedWordIds.length
                ? gateAlreadyPassed
                  ? ` قبولی قبلی حفظ شده است، اما ${faNum(result.missedWordIds.length)} واژهٔ از‌دست‌رفته وارد مرور جبرانی شده‌اند.`
                  : ` ${faNum(result.missedWordIds.length)} واژهٔ از‌دست‌رفته وارد مرور جبرانی شده‌اند و تا ترمیم آن‌ها بازآزمایی قفل می‌ماند.`
                : gateAlreadyPassed
                  ? ' قبولی قبلی حفظ شده است.'
                  : ` همهٔ واژه‌ها درست بود، اما ${faNum(textsMissed)} پاسخ درک مطلب نادرست بود. بازآزمایی همین حالا با متن‌های دیگری باز است.`}
          </p>

          {result.missedWordIds.length > 0 && (
            <div className="remediation-panel mt-4 p-3 text-right">
              <div className="text-xs font-bold">نیازمند جبران</div>
              <div className="mt-2 flex flex-wrap gap-1.5" lang="en" dir="ltr">
                {result.missedWordIds.slice(0, 16).map(id => <span key={id} className="mastery-chip font-en">{WORD_BY_ID.get(id)?.word ?? id}</span>)}
                {result.missedWordIds.length > 16 && <span className="mastery-chip">+{faNum(result.missedWordIds.length - 16)}</span>}
              </div>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" className="btn-paper py-3" onClick={onBack}>مسیر یادگیری</button>
            {!unrecorded && result.missedWordIds.length > 0 ? (
              <button type="button" className="btn-crimson py-3" onClick={onReview}>مرور جبرانی</button>
            ) : canRetake && !gateAlreadyPassed ? (
              <button type="button" className="btn-crimson py-3" onClick={retake}>دوباره امتحان کن</button>
            ) : (
              <button type="button" className="btn-ink py-3" onClick={onBack}>ادامهٔ مسیر ←</button>
            )}
            {gateRemainsOpen && !passedNow && !unrecorded && (
              <button type="button" className="btn-paper col-span-2 py-2.5 text-sm" onClick={onBack}>قبولی قبلی حفظ شده؛ بازگشت به مسیر</button>
            )}
          </div>
        </div>

        {texts.length > 0 && (
          <section className="learning-focus-card mt-5 p-5 text-right sm:p-6" aria-labelledby="texts-review-heading">
            <h2 id="texts-review-heading" className="text-lg font-extrabold">مرور درک مطلب</h2>
            {builtExam.reading.map((text, slot) => (
              <ReadingTextReview key={text.id} text={text} chosen={comprehension.reading[slot]} summary={`متن خواندنی ${faNum(slot + 1)}: ${text.titleFa} — متن، ترجمه و پاسخ‌ها`} />
            ))}
            {builtExam.listening.map((text, slot) => (
              <ListeningTextReview
                key={text.id}
                text={text}
                chosen={comprehension.listening[slot]}
                soundOn={state.soundOn}
                voiceURI={state.narratorVoiceURI}
                rate={state.narratorRate}
                summary={`متن شنیداری ${faNum(slot + 1)}: ${text.titleFa} — نمایش متن، ترجمه و پاسخ‌ها`}
              />
            ))}
          </section>
        )}
      </div>
    )
  }

  if (onBreak) {
    return (
      <div className="app-page luxury-exam page-in mx-auto max-w-3xl px-4 pb-28 pt-8">
        {examBackdrop}
        <div className="learning-focus-card p-6 text-center">
          <CirclePauseIcon className="mx-auto h-10 w-10" aria-hidden="true" />
          <h1 className="mt-3 text-2xl font-extrabold">وقفهٔ کوتاه</h1>
          <p className="mt-3 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
            {faNum(index)} سؤال پاسخ داده‌ای. برای اینکه آزمون بیشتر حافظه را بسنجد تا خستگی، چند لحظه استراحت کن. هیچ پاسخ یا امتیازی نمایش داده نمی‌شود.
          </p>
          {resumedDraft && (
            <div className="prep-resume-row mt-4" role="status">
              <span>پیشرفت این آزمون از همین دستگاه بازیابی شد.</span>
              <button type="button" className="btn-quiet shrink-0 px-3 text-xs" onClick={() => restartExam()}>شروع از اول</button>
            </div>
          )}
          <button type="button" className="btn-ink mt-5 w-full py-3" onClick={() => { setResumedDraft(false); setOnBreak(false) }}>ادامهٔ آزمون ←</button>
        </div>
      </div>
    )
  }

  const header = (
    <header className="flex items-center gap-3">
      <button type="button" className="btn-paper reader-header-button" onClick={onBack} aria-label="ترک آزمون"><BackIcon className="h-5 w-5" /></button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-extrabold">{def.titleFa}</h1>
        <p className="mt-1 text-xs" style={{ color: 'var(--ink-soft)' }}>{def.subtitleFa}</p>
      </div>
    </header>
  )
  const previewNote = preview && <div className="explore-note mt-4" role="status"><span><b>پیش‌نمایش در حالت کاوش.</b> هنوز به این آزمون نرسیده‌ای؛ نتیجه‌اش ثبت نمی‌شود و مسیری را باز نمی‌کند.</span></div>

  if (currentText) {
    const chosen = comprehension[currentText.kind][currentText.slot]
    const isListening = currentText.kind === 'listening'
    const ready = textAnswered(chosen) && (!isListening || heard[currentText.slot])
    const last = textIndex + 1 >= texts.length
    return (
      <div className="app-page luxury-exam page-in mx-auto max-w-3xl px-4 pb-28 pt-5">
        {examBackdrop}
        {header}

        <div className="mt-5 flex items-center justify-between text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>
          <span>درک مطلب · متن {faNum(textIndex + 1)} از {faNum(texts.length)}</span>
          <span>تلاش {faNum(attempt)}</span>
        </div>
        <div className="mastery-progress mt-2"><span style={{ width: `${(textIndex / texts.length) * 100}%` }} /></div>

        {previewNote}

        {textIndex === 0 && (
          <div className="paper-note mt-4">
            {faNum(builtExam.reading.length)} متن خواندنی و {faNum(builtExam.listening.length)} متن شنیداری داری. بازخورد در پایان آزمون نمایش داده می‌شود.
          </div>
        )}

        {resumedDraft && (
          <div className="prep-resume-row mt-3" role="status">
            <span>پیشرفت این آزمون بازیابی شد؛ از متن {faNum(textIndex + 1)} ادامه می‌دهی.</span>
            <button type="button" className="btn-quiet shrink-0 px-3 text-xs" onClick={() => restartExam()}>شروع از اول</button>
          </div>
        )}

        <section className="learning-focus-card mt-4 p-5 sm:p-6" aria-labelledby="exam-text-heading" data-testid="exam-text">
          <div className="text-xs font-bold" style={{ color: 'var(--crimson-deep)' }}>
            {isListening ? `درک مطلب شنیداری ${faNum(currentText.slot + 1)} از ${faNum(builtExam.listening.length)}` : `درک مطلب خواندنی ${faNum(currentText.slot + 1)} از ${faNum(builtExam.reading.length)}`}
          </div>
          <h2 id="exam-text-heading" ref={textHeadingRef} tabIndex={-1} className="mt-1 text-lg font-extrabold">
            {isListening ? 'گوش کن و پاسخ بده' : 'بخوان و پاسخ بده'}
          </h2>
          <p className="mt-1 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
            {isListening
              ? 'این متن فقط پخش می‌شود. پس از یک‌بار شنیدن کامل، سؤال‌ها فعال می‌شوند و هر چند بار خواستی می‌توانی دوباره گوش کنی.'
              : 'متن را بخوان و به سؤال‌ها پاسخ بده. تا پیش از رفتن به متن بعدی می‌توانی پاسخ‌ها را عوض کنی.'}
          </p>

          {isListening ? (
            <ListeningText
              key={currentText.text.id}
              text={currentText.text}
              prefix={`exam-${currentText.text.id}`}
              heard={heard[currentText.slot]}
              chosen={chosen}
              soundOn={state.soundOn}
              voiceURI={state.narratorVoiceURI}
              rate={state.narratorRate}
              testId="exam-listening-player"
              onHeard={() => heardText(currentText.slot)}
              onEnableSound={() => onChange({ ...state, soundOn: true })}
              onChoose={(questionIndex, option) => chooseText(currentText, questionIndex, option)}
            />
          ) : (
            <>
              <article className="question-context mt-4" lang="en" dir="ltr" aria-labelledby="exam-reading-title">
                <h3 id="exam-reading-title" className="font-en text-base font-bold">{currentText.text.titleEn}</h3>
                <Passage text={currentText.text} />
              </article>
              <Questions
                text={currentText.text}
                prefix={`exam-${currentText.text.id}`}
                chosen={chosen}
                disabled={false}
                onChoose={(questionIndex, option) => chooseText(currentText, questionIndex, option)}
              />
            </>
          )}

          <button type="button" className={`${last ? 'btn-crimson' : 'btn-ink'} mt-5 w-full py-3`} disabled={!ready} onClick={nextText}>
            {last ? 'ثبت و پایان آزمون' : 'ثبت و متن بعدی ←'}
          </button>

          {explore && (
            <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--line-soft)' }}>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn-quiet py-2.5 text-sm" onClick={() => moveText(textIndex - 1)}>{textIndex === 0 ? 'بازگشت به واژه‌ها' : 'متن قبلی'}</button>
                <button type="button" className="btn-quiet py-2.5 text-sm" onClick={() => moveText(textIndex + 1)}>
                  {last ? 'پایان و دیدن نتیجه' : 'رد کردن ←'}
                </button>
              </div>
              <p className="mt-2 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
                در حالت کاوش می‌توانی متن‌ها را جابه‌جا کنی؛ اگر سؤالی بی‌پاسخ بماند، نتیجه فقط تمرین است و ثبت نمی‌شود.
              </p>
            </div>
          )}
        </section>
      </div>
    )
  }

  const typedMode = question ? isTypedMode(question.mode) : false

  return (
    <div className="app-page luxury-exam page-in mx-auto max-w-3xl px-4 pb-28 pt-5">
      {header}

      <div className="mt-5 flex items-center justify-between text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>
        <span>سؤال {faNum(index + 1)} از {faNum(builtExam.questions.length)}</span>
        <span>تلاش {faNum(attempt)}</span>
      </div>
      <div className="mastery-progress mt-2"><span style={{ width: `${(index / builtExam.questions.length) * 100}%` }} /></div>

      {previewNote}

      <div className="paper-note mt-4">
        بازخورد در پایان آزمون می‌آید. حد عبور {percent(def.passRate)} کل آزمون، {percent(def.productivePassRate)} یادآوری نوشتاری و {percent(def.passRate)} درک مطلب است.
      </div>

      {resumedDraft && (
        <div className="prep-resume-row mt-3" role="status">
          <span>پیشرفت این آزمون بازیابی شد؛ از سؤال {faNum(index + 1)} ادامه می‌دهی.</span>
          <button type="button" className="btn-quiet shrink-0 px-3 text-xs" onClick={() => restartExam()}>شروع از اول</button>
        </div>
      )}

      {question && word && (
        <div ref={questionRef} className="learning-focus-card exam-question-card mt-5 p-5 sm:p-6">
          <div className="text-center">
            <div className="text-xs font-bold" style={{ color: 'var(--crimson-deep)' }}>{modeLabel(question.mode)}</div>
            {question.mode === 'spelling' ? (
              <>
                <div className="mt-4 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>واژه را گوش کن و دقیق بنویس.</div>
                {question.hintFa && <SpellingHint meaning={question.hintFa} />}
                <button type="button" className="btn-paper mt-4 px-5 py-3 text-lg" onClick={() => { setAudioReady(false); speakCurrent() }}><span className="inline-flex items-center gap-2"><SpeakerIcon className="h-5 w-5" />پخش واژه</span></button>
                {audioNotice && <div className="paper-note mt-3 text-right" role="alert">{audioNotice}</div>}
                {!audioReady && !audioNotice && <div className="mt-3 text-xs leading-6" role="status" style={{ color: 'var(--ink-soft)' }}>برای پاسخ، ابتدا واژه را کامل گوش کن.</div>}
              </>
            ) : (
              <div className={`mt-4 text-2xl font-extrabold ${question.promptDir === 'ltr' ? 'font-en' : ''}`} lang={question.promptDir === 'ltr' ? 'en' : undefined} dir={question.promptDir}>{question.prompt}</div>
            )}
          </div>

          {typedMode ? (
            <div className="mt-7">
              <label htmlFor="exam-answer" className="block text-sm font-bold">پاسخ انگلیسی</label>
              <input
                id="exam-answer"
                ref={answerInputRef}
                className="answer-input mt-2 w-full"
                lang="en"
                dir="ltr"
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="next"
                disabled={answerLocked}
                value={typed}
                onChange={event => setTyped(event.target.value)}
                onKeyDown={event => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  submitTyped()
                }}
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" className="btn-quiet py-3 text-sm" disabled={answerLocked} onClick={() => answer(false)}>نمی‌دانم</button>
                <button type="button" className="btn-ink py-3" disabled={!typed.trim() || answerLocked} onClick={submitTyped}>ثبت و بعدی</button>
              </div>
            </div>
          ) : (
            <div className="mt-7" dir={question.mode === 'reverse' ? 'rtl' : 'ltr'}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {question.options?.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    className={`btn-paper min-h-14 px-3 py-3 ${question.mode === 'reverse' ? '' : 'font-en'}`}
                    onClick={() => answer(option.id === question.answerId)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button type="button" className="btn-quiet mt-3 w-full py-2.5 text-sm" onClick={() => answer(false)}>نمی‌دانم — بعدی</button>
            </div>
          )}

          {explore && (
            <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--line-soft)' }}>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn-quiet py-2.5 text-sm" disabled={index === 0} onClick={() => moveTo(index - 1)}>سؤال قبلی</button>
                <button type="button" className="btn-quiet py-2.5 text-sm" onClick={() => moveTo(index + 1)}>
                  {index + 1 >= builtExam.questions.length ? (texts.length ? 'رفتن به درک مطلب ←' : 'پایان و دیدن نتیجه') : 'رد کردن ←'}
                </button>
                {texts.length > 0 && index + 1 < builtExam.questions.length && (
                  <button type="button" className="btn-quiet col-span-2 py-2.5 text-sm" onClick={() => moveTo(builtExam.questions.length)}>پرش به درک مطلب ←</button>
                )}
              </div>
              <p className="mt-2 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
                در حالت کاوش می‌توانی سؤال‌ها را جابه‌جا کنی؛ اگر سؤالی بی‌پاسخ بماند، نتیجه فقط تمرین است و ثبت نمی‌شود.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}