import { useEffect, useRef, useState } from 'react'
import type { GhesseState, RetrievalMode, SkillDimension } from '../engine/types'
import { buildExam, examPool, scoreExam, type BuiltExam, type ExamResult } from '../engine/exams'
import { examDefinition } from '../engine/gates'
import { WORD_BY_ID } from '../data/chapters'
import { isQuestionTypedCorrect, isTypedMode, recordRetrieval } from '../engine/review'
import { speakEnglish } from '../engine/narration'
import { play, wordSrc } from '../engine/audio'

interface Props {
  examId: string
  state: GhesseState
  onChange: (next: GhesseState) => void
  onBack: () => void
  onReview: () => void
}

function faNum(n: number): string {
  return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])
}

function percent(value: number): string {
  return `${faNum(Math.round(value * 100))}٪`
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

const BREAK_EVERY = 16

export default function ExamScreen({ examId, state, onChange, onBack, onReview }: Props) {
  const previousExam = state.exams[examId]
  const attempt = (previousExam?.attempts ?? 0) + 1
  const [exam] = useState(() => buildExam(examId, state, attempt))
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, boolean>>({})
  const [timings, setTimings] = useState<Record<number, number>>({})
  const [typed, setTyped] = useState('')
  const [result, setResult] = useState<ExamResult | null>(null)
  const [onBreak, setOnBreak] = useState(false)
  const questionStartedAt = useRef(0)

  useEffect(() => {
    questionStartedAt.current = Date.now()
  }, [index, onBreak])

  if (!exam) return null
  const builtExam: BuiltExam = exam
  const def = examDefinition(examId)!
  const question = builtExam.questions[index]
  const word = question ? WORD_BY_ID.get(question.wordId) : undefined

  function speakCurrent() {
    if (!word || !state.soundOn) return
    if (!speakEnglish(word.word, state.narratorVoiceURI, state.narratorRate)) play(wordSrc(word.id), true)
  }

  function finalize(nextAnswers: Record<number, boolean>, nextTimings: Record<number, number>, built: BuiltExam) {
    const scored = scoreExam(built, nextAnswers)
    const now = Date.now()
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
        lastScore: scored.score,
        bestScore: Math.max(previous?.bestScore ?? 0, scored.score),
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
    if (!question || result) return
    const elapsed = Math.max(1, Date.now() - questionStartedAt.current)
    const nextAnswers = { ...answers, [question.index]: correct }
    const nextTimings = { ...timings, [question.index]: elapsed }
    setAnswers(nextAnswers)
    setTimings(nextTimings)
    setTyped('')
    if (index + 1 >= builtExam.questions.length) {
      finalize(nextAnswers, nextTimings, builtExam)
    } else {
      const nextIndex = index + 1
      setIndex(nextIndex)
      if (nextIndex % BREAK_EVERY === 0) setOnBreak(true)
    }
  }

  function submitTyped() {
    if (!word || !typed.trim()) return
    answer(isQuestionTypedCorrect(typed, question))
  }

  if (result) {
    const passedNow = result.passed
    const gateAlreadyPassed = previousExam?.passed === true
    const gateRemainsOpen = passedNow || gateAlreadyPassed
    const totalPool = examPool(examId).length
    const testedCoverage = new Set([...(previousExam?.testedWordIds ?? []), ...builtExam.questions.map(item => item.wordId)]).size
    return (
      <div className="page-in mx-auto min-h-screen max-w-lg px-4 pb-28 pt-6" style={{ background: 'var(--cream)' }}>
        <div className={`paper-card p-6 text-center ${passedNow ? 'exam-pass' : 'exam-fail'}`}>
          <div className="text-5xl">{passedNow && result.missedWordIds.length === 0 ? '✓' : '↻'}</div>
          <h1 className="mt-3 text-2xl font-extrabold">
            {passedNow ? (result.missedWordIds.length ? 'حد نصاب را گرفتی؛ حالا خطاها را ببند' : 'قبول شدی') : gateAlreadyPassed ? 'این بازآزمایی نیاز به مرور دارد' : 'هنوز آمادهٔ عبور نیستی'}
          </h1>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="metric-card"><b>{percent(result.score)}</b><span>امتیاز کل</span></div>
            <div className="metric-card"><b>{percent(result.productiveScore)}</b><span>پاسخ بدون گزینه</span></div>
            <div className="metric-card"><b>{faNum(testedCoverage)}/{faNum(totalPool)}</b><span>پوشش واژه</span></div>
          </div>

          <div className="mt-4 rounded-xl border-2 border-[var(--ink)] bg-white/35 p-3 text-right">
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
            حد عبور: {percent(def.passRate)} کل و {percent(def.productivePassRate)} در پاسخ‌های بدون گزینه.
            {passedNow
              ? result.missedWordIds.length
                ? ` حد نصاب آزمون را پاس کردی، اما مسیر بعدی بعد از بازیابی مستقل ${faNum(result.missedWordIds.length)} واژهٔ از‌دست‌رفته باز می‌شود.`
                : ' قبولی پاک مسیر را باز می‌کند، اما «مسلط» فقط با بازیابی موفق در روزهای مختلف و فاصلهٔ واقعی به دست می‌آید.'
              : gateAlreadyPassed
                ? ` قبولی قبلی حفظ شده است، اما ${faNum(result.missedWordIds.length)} واژهٔ از‌دست‌رفته وارد مرور جبرانی شده‌اند.`
                : ` ${faNum(result.missedWordIds.length)} واژهٔ از‌دست‌رفته وارد مرور جبرانی شده‌اند و تا ترمیم آن‌ها بازآزمایی قفل می‌ماند.`}
          </p>

          {result.missedWordIds.length > 0 && (
            <div className="mt-4 rounded-xl border-2 border-dashed border-[var(--ink)] p-3 text-right">
              <div className="text-xs font-bold">نیازمند جبران</div>
              <div className="mt-2 flex flex-wrap gap-1.5" dir="ltr">
                {result.missedWordIds.slice(0, 16).map(id => <span key={id} className="mastery-chip font-en">{WORD_BY_ID.get(id)?.word ?? id}</span>)}
                {result.missedWordIds.length > 16 && <span className="mastery-chip">+{faNum(result.missedWordIds.length - 16)}</span>}
              </div>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" className="btn-paper py-3" onClick={onBack}>مسیر یادگیری</button>
            {!passedNow || result.missedWordIds.length > 0 ? (
              <button type="button" className="btn-crimson py-3" onClick={onReview}>مرور جبرانی</button>
            ) : (
              <button type="button" className="btn-ink py-3" onClick={onBack}>ادامهٔ مسیر ←</button>
            )}
            {gateRemainsOpen && !passedNow && (
              <button type="button" className="btn-paper col-span-2 py-2.5 text-sm" onClick={onBack}>قبولی قبلی حفظ شده؛ بازگشت به مسیر</button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (onBreak) {
    return (
      <div className="page-in mx-auto min-h-screen max-w-lg px-4 pb-28 pt-8" style={{ background: 'var(--cream)' }}>
        <div className="paper-card p-6 text-center">
          <div className="text-4xl">◌</div>
          <h1 className="mt-3 text-2xl font-extrabold">وقفهٔ کوتاه</h1>
          <p className="mt-3 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
            {faNum(index)} سؤال پاسخ داده‌ای. برای اینکه آزمون بیشتر حافظه را بسنجد تا خستگی، چند لحظه استراحت کن. هیچ پاسخ یا امتیازی نمایش داده نمی‌شود.
          </p>
          <button type="button" className="btn-ink mt-5 w-full py-3" onClick={() => setOnBreak(false)}>ادامهٔ آزمون ←</button>
        </div>
      </div>
    )
  }

  const typedMode = question ? isTypedMode(question.mode) : false

  return (
    <div className="page-in mx-auto min-h-screen max-w-lg px-4 pb-28 pt-5" style={{ background: 'var(--cream)' }}>
      <header className="flex items-center gap-3">
        <button type="button" className="btn-paper px-3 py-2 text-sm" onClick={onBack} aria-label="ترک آزمون">→</button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold">{def.titleFa}</h1>
          <p className="mt-1 text-xs" style={{ color: 'var(--ink-soft)' }}>{def.subtitleFa}</p>
        </div>
      </header>

      <div className="mt-5 flex items-center justify-between text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>
        <span>سؤال {faNum(index + 1)} از {faNum(builtExam.questions.length)}</span>
        <span>تلاش {faNum(attempt)}</span>
      </div>
      <div className="mastery-progress mt-2"><span style={{ width: `${(index / builtExam.questions.length) * 100}%` }} /></div>

      <div className="paper-note mt-4">
        هیچ بازخوردی تا پایان آزمون نشان داده نمی‌شود. آزمون معنی، بافت، تولید فعال و املاء را جداگانه می‌سنجد و نتیجهٔ هر مهارت را در پایان نشان می‌دهد.
      </div>

      {question && word && (
        <div className="paper-card mt-5 p-5">
          <div className="text-center">
            <div className="text-xs font-bold" style={{ color: 'var(--crimson-deep)' }}>{modeLabel(question.mode)}</div>
            {question.mode === 'spelling' ? (
              <>
                <div className="mt-4 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>واژه را گوش کن و دقیق بنویس.</div>
                <button type="button" className="btn-paper mt-4 px-5 py-3 text-lg" onClick={speakCurrent}>🔊 پخش واژه</button>
              </>
            ) : (
              <div className={`mt-4 text-2xl font-extrabold ${question.promptDir === 'ltr' ? 'font-en' : ''}`} dir={question.promptDir}>{question.prompt}</div>
            )}
          </div>

          {typedMode ? (
            <div className="mt-7">
              <label htmlFor="exam-answer" className="block text-sm font-bold">پاسخ انگلیسی</label>
              <input
                id="exam-answer"
                className="answer-input mt-2 w-full"
                dir="ltr"
                autoFocus
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={typed}
                onChange={event => setTyped(event.target.value)}
                onKeyDown={event => { if (event.key === 'Enter') submitTyped() }}
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" className="btn-quiet py-3 text-sm" onClick={() => answer(false)}>نمی‌دانم</button>
                <button type="button" className="btn-ink py-3" disabled={!typed.trim()} onClick={submitTyped}>ثبت و بعدی</button>
              </div>
            </div>
          ) : (
            <div className="mt-7" dir={question.mode === 'reverse' ? 'rtl' : 'ltr'}>
              <div className="grid grid-cols-2 gap-2">
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
        </div>
      )}
    </div>
  )
}