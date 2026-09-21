import { useEffect, useMemo, useRef, useState } from 'react'
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
  selectWeakestWordIds,
  troubleWordIds,
} from '../engine/review'
import { speakEnglish } from '../engine/narration'
import { play, wordSrc } from '../engine/audio'
import { examRemediationWordIds } from '../engine/gates'

interface Props {
  state: GhesseState
  now: number
  onChange: (next: GhesseState) => void
  onBack: () => void
}

function faNum(n: number): string {
  return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])
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
  const initial = useMemo(() => {
    if (remediation.length) {
      const restDue = due.filter(id => !remediation.includes(id))
      return [...remediation, ...restDue].slice(0, Math.max(state.dailyReviewGoal, Math.min(20, remediation.length)))
    }
    if (due.length) return due.slice(0, state.dailyReviewGoal)
    if (trouble.length) return trouble.slice(0, Math.min(10, state.dailyReviewGoal))
    return selectWeakestWordIds(introduced, state.words, Math.min(10, state.dailyReviewGoal), `extra:${Math.floor(now / 86_400_000)}`)
  }, [due, introduced, now, remediation, state.dailyReviewGoal, state.words, trouble])

  const [queue, setQueue] = useState<string[]>(initial)
  const [completed, setCompleted] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [relearnedCount, setRelearnedCount] = useState(0)
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [selected, setSelected] = useState('')
  const [typed, setTyped] = useState('')
  const [attemptNumber, setAttemptNumber] = useState<Record<string, number>>({})
  const startedAtRef = useRef(0)

  const currentId = queue[0]
  const currentWord = currentId ? WORD_BY_ID.get(currentId) : undefined
  const progress = currentId ? state.words[currentId] : undefined
  const mode = progress ? modeForProgress(progress) : 'recognition'
  const question = useMemo(
    () => currentWord ? buildReviewQuestion(currentWord, VOCAB, mode, `review:${currentId}:${attemptNumber[currentId] ?? 0}`) : undefined,
    [attemptNumber, currentId, currentWord, mode],
  )
  const counts = useMemo(() => masteryCounts(state, VOCAB.map(w => w.id)), [state])

  useEffect(() => {
    startedAtRef.current = Date.now()
  }, [currentId, attemptNumber])

  function speakCurrent() {
    if (!currentWord || !state.soundOn) return
    if (!speakEnglish(currentWord.word, state.narratorVoiceURI, state.narratorRate)) play(wordSrc(currentWord.id), true)
  }

  function commit(correct: boolean) {
    if (!currentId || !currentWord || !progress || feedback) return
    const elapsedMs = Date.now() - startedAtRef.current
    const source = (attemptNumber[currentId] ?? 0) > 0 ? 'relearn' : 'review'
    const nextProgress = recordRetrieval(progress, correct, mode, Date.now(), source, elapsedMs)
    onChange({ ...state, words: { ...state.words, [currentId]: nextProgress } })
    setFeedback(correct ? 'correct' : 'wrong')
    if (correct && source === 'review') setCorrectCount(value => value + 1)
    if (correct && source === 'relearn') setRelearnedCount(value => value + 1)
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
  }

  const sessionLabel = remediation.length ? 'ترمیم آزمون' : due.length ? 'مرورهای سررسید' : trouble.length ? 'واژه‌های سخت' : 'تمرین تقویتی'
  const typedMode = isTypedMode(mode)

  return (
    <div className="page-in mx-auto min-h-screen max-w-lg px-4 pb-28 pt-5" style={{ background: 'var(--cream)' }}>
      <header className="flex items-center gap-3">
        <button type="button" className="btn-paper px-3 py-2 text-sm" onClick={onBack} aria-label="بازگشت به نقشه">→</button>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold">مرور هوشمند</h1>
          <p className="mt-1 text-xs" style={{ color: 'var(--ink-soft)' }}>هر کارت ضعیف‌ترین مهارت همان واژه را هدف می‌گیرد</p>
        </div>
        <span className="mastery-chip">هدف {faNum(state.dailyReviewGoal)}</span>
      </header>

      <div className="mt-5 grid grid-cols-4 gap-2 text-center">
        <div className="metric-card"><b>{faNum(remediation.length)}</b><span>ترمیم</span></div>
        <div className="metric-card"><b>{faNum(trouble.length)}</b><span>سخت</span></div>
        <div className="metric-card"><b>{faNum(counts.strong)}</b><span>قوی</span></div>
        <div className="metric-card"><b>{faNum(counts.mastered)}</b><span>مسلط</span></div>
      </div>

      {initial.length === 0 ? (
        <div className="paper-card mt-6 p-6 text-center">
          <div className="text-4xl">🌱</div>
          <h2 className="mt-3 text-xl font-extrabold">مرور ضروری نداری</h2>
          <p className="mt-2 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>اگر واژه‌ای معرفی شده باشد، تمرین تقویتی روی ضعیف‌ترین واژه‌ها به‌صورت خودکار ساخته می‌شود.</p>
        </div>
      ) : !currentWord || !question ? (
        <div className="paper-card pop mt-6 p-6 text-center" role="status">
          <div className="text-5xl">✓</div>
          <h2 className="mt-3 text-2xl font-extrabold">جلسه تمام شد</h2>
          <p className="mt-2 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
            {faNum(correctCount)} بازیابی مستقل ثبت شد و {faNum(relearnedCount)} واژه بعد از بازخورد دوباره ساخته شد. پاسخ درست پس از دیدن جواب عمداً شواهد تسلط محسوب نمی‌شود.
          </p>
          <button type="button" className="btn-ink mt-5 w-full py-3" onClick={onBack}>بازگشت به مسیر</button>
        </div>
      ) : (
        <div className="paper-card mt-6 p-5">
          <div className="flex items-center justify-between text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>
            <span>{sessionLabel}</span>
            <span>{faNum(completed)} / {faNum(initial.length)}</span>
          </div>
          <div className="mastery-progress mt-3"><span style={{ width: `${Math.min(100, (completed / initial.length) * 100)}%` }} /></div>

          <div className="mt-5 flex items-center justify-between gap-2">
            <span className="mastery-chip">مهارت هدف: {weaknessLabel(mode)}</span>
            <span className="text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>{modeLabel(mode)}</span>
          </div>

          <div className="mt-6 text-center">
            {mode === 'spelling' ? (
              <>
                <div className="text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>واژه را گوش کن؛ متن انگلیسی پنهان می‌ماند.</div>
                <button type="button" className="btn-paper mt-4 px-5 py-3 text-lg" onClick={speakCurrent}>🔊 پخش واژه</button>
              </>
            ) : (
              <div className={`text-2xl font-extrabold ${question.promptDir === 'ltr' ? 'font-en' : ''}`} dir={question.promptDir}>{question.prompt}</div>
            )}
          </div>

          {typedMode ? (
            <div className="mt-6">
              <label htmlFor="review-answer" className="block text-sm font-bold">
                {mode === 'spelling' ? 'آنچه شنیدی را به انگلیسی بنویس' : mode === 'contextProductive' ? 'واژهٔ جاافتاده را بنویس' : 'واژهٔ انگلیسی را از حافظه بنویس'}
              </label>
              <input
                id="review-answer"
                className="answer-input mt-2 w-full"
                dir="ltr"
                autoFocus
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={Boolean(feedback)}
                value={typed}
                onChange={event => setTyped(event.target.value)}
                onKeyDown={event => { if (event.key === 'Enter') submitTyped() }}
              />
              {!feedback && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" className="btn-quiet py-3 text-sm" onClick={() => commit(false)}>نمی‌دانم</button>
                  <button type="button" className="btn-ink py-3" disabled={!typed.trim()} onClick={submitTyped}>ثبت پاسخ</button>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6" dir={mode === 'reverse' ? 'rtl' : 'ltr'}>
              <div className="grid grid-cols-2 gap-2">
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
            <div className={`mt-4 rounded-xl border-2 p-3 text-sm ${feedback === 'correct' ? 'feedback-correct' : 'feedback-wrong'}`} role="status">
              {feedback === 'correct' ? (
                <>
                  <b>درست.</b> این پاسخ به مهارت «{weaknessLabel(mode)}» همان واژه اضافه شد. اگر بازیابی مستقل و در یک روز جدید باشد، زمان مرور بعدی بر اساس مدل حافظه تنظیم می‌شود.
                </>
              ) : (
                <div>
                  <div className="text-xs font-bold" style={{ color: 'var(--crimson-deep)' }}>ترمیم ضعف: {weaknessLabel(mode)}</div>
                  <div className="mt-1">پاسخ درست: <b className="font-en text-base" dir="ltr">{currentWord.word}</b> — <b>{currentWord.fa}</b></div>
                  {mode === 'spelling' && currentWord.ipa && <div className="mt-2 font-en" dir="ltr">/{currentWord.ipa}/</div>}
                  {currentWord.ex && <div className="mt-2 font-en" dir="ltr">{currentWord.ex}</div>}
                  {currentWord.tr && <div className="mt-1" dir="rtl" style={{ color: 'var(--ink-soft)' }}>{currentWord.tr}</div>}
                  <button type="button" className="btn-paper mt-3 px-3 py-2 text-xs" onClick={speakCurrent}>🔊 شنیدن واژه</button>
                  <div className="mt-2 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>این کارت در انتهای همین جلسه برمی‌گردد، اما پاسخ بعد از این بازخورد شواهد مستقل تسلط نیست.</div>
                </div>
              )}
            </div>
          )}
          {feedback && <button type="button" className="btn-ink mt-4 w-full py-3" onClick={nextCard}>کارت بعدی ←</button>}
        </div>
      )}
    </div>
  )
}