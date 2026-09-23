import { useEffect, useRef, useState } from 'react'
import type { GhesseState } from '../engine/types'
import { CHAPTER_BY_ID } from '../data/chapters'
import { bookExamId, examPassed } from '../engine/gates'
import {
  STORY_TEST_PASS_RATE,
  buildStoryTest,
  recordStoryTest,
  scoreStoryTest,
  storyTestId,
  storyTestTitle,
  type StoryTestQuestion,
  type StoryTestResult,
} from '../engine/storyTest'
import { clearStoryTestDraft, loadStoryTestDraft, saveStoryTestDraft } from '../engine/storyTestDraft'
import { BackIcon, BadgeCheckIcon, BookOpenTextIcon, RefreshCcwIcon } from '../components/Icons'
import { faNum, percent } from '../engine/format'

interface Props {
  book: number
  state: GhesseState
  onChange: (next: GhesseState) => void
  onBack: () => void
  onOpenChapter: (chapterId: string) => void
  onOpenExam: (examId: string) => void
}

function questionLabel(question: StoryTestQuestion): string {
  const chapter = CHAPTER_BY_ID.get(question.chapterId)
  const book = `کتاب ${faNum(question.book)}`
  return question.showChapter && chapter ? `${book} · فصل ${faNum(chapter.n)}: ${chapter.titleFa}` : book
}

function optionLabel(question: StoryTestQuestion, optionId: string | undefined): string {
  return question.options.find(option => option.id === optionId)?.label ?? '—'
}

export default function StoryTestScreen({ book, state, onChange, onBack, onOpenChapter, onOpenExam }: Props) {
  const id = storyTestId(book)
  const [test, setTest] = useState(() => buildStoryTest(book, (state.storyTests[id]?.attempts ?? 0) + 1))
  const [initialDraft] = useState(() => loadStoryTestDraft(test))
  const [resumed, setResumed] = useState(Boolean(initialDraft))
  const [answers, setAnswers] = useState<Record<number, string>>(() => initialDraft?.answers ?? {})
  const [index, setIndex] = useState(() => initialDraft?.index ?? 0)
  const [result, setResult] = useState<StoryTestResult | null>(null)
  const questionRef = useRef<HTMLHeadingElement>(null)
  const mountedRef = useRef(false)

  const total = test.questions.length
  const question = test.questions[index]
  const chosen = answers[index]
  const answeredCount = Object.keys(answers).length
  const isLast = index === total - 1

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    window.scrollTo({ top: 0, behavior: 'auto' })
    questionRef.current?.focus({ preventScroll: true })
  }, [index, result])

  function choose(optionId: string) {
    if (!question || result) return
    if (resumed) setResumed(false)
    const nextAnswers = { ...answers, [index]: optionId }
    const nextIndex = isLast ? index : index + 1
    setAnswers(nextAnswers)
    setIndex(nextIndex)
    saveStoryTestDraft(test, nextIndex, nextAnswers)
  }

  function move(nextIndex: number) {
    setIndex(nextIndex)
    saveStoryTestDraft(test, nextIndex, answers)
  }

  function finish() {
    if (answeredCount < total || result) return
    const scored = scoreStoryTest(test, answers)
    clearStoryTestDraft(book)
    onChange(recordStoryTest(state, book, scored, Date.now()))
    setResult(scored)
  }

  function retake() {
    clearStoryTestDraft(book)
    setTest(buildStoryTest(book, (state.storyTests[id]?.attempts ?? 0) + 1))
    setAnswers({})
    setIndex(0)
    setResult(null)
    setResumed(false)
  }

  function restart() {
    clearStoryTestDraft(book)
    setAnswers({})
    setIndex(0)
    setResumed(false)
  }

  if (result) {
    const vocabularyPassed = examPassed(state, bookExamId(book))
    const gateText = book === 8 ? 'آزمون نهایی' : `کتاب ${faNum(book + 1)}`
    return (
      <div className="page-in mx-auto min-h-screen max-w-3xl px-4 pb-28 pt-6" style={{ background: 'var(--cream)' }}>
        <div className={`exam-result-card p-6 text-center ${result.passed ? 'exam-pass' : 'exam-fail'}`}>
          {result.passed
            ? <BadgeCheckIcon className="mx-auto h-11 w-11" aria-hidden="true" />
            : <RefreshCcwIcon className="mx-auto h-10 w-10" aria-hidden="true" />}
          <h1 ref={questionRef} tabIndex={-1} className="mt-3 text-2xl font-extrabold">
            {result.passed ? 'قصه را خوب به یاد داری' : 'هنوز آمادهٔ عبور نیستی'}
          </h1>
          <div className={`mt-5 grid gap-2 ${result.previousTotal ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div className="metric-card"><b>{percent(result.score)}</b><span>امتیاز کل</span></div>
            <div className="metric-card"><b>{faNum(result.currentCorrect)}/{faNum(result.currentTotal)}</b><span>کتاب {faNum(book)}</span></div>
            {result.previousTotal > 0 && (
              <div className="metric-card"><b>{faNum(result.previousCorrect)}/{faNum(result.previousTotal)}</b><span>کتاب‌های قبل</span></div>
            )}
          </div>
          <p className="mt-4 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
            حد قبولی {percent(STORY_TEST_PASS_RATE)} است.
            {result.passed
              ? vocabularyPassed
                ? ` راه ${gateText} از طرف درک مطلب باز است.`
                : ` برای رفتن به ${gateText}، آزمون واژه‌های کتاب ${faNum(book)} هم لازم است.`
              : ' فصل‌هایی را که سؤالشان را از دست دادی دوباره بخوان و بعد دوباره امتحان کن؛ سؤال‌های تلاش بعد تازه‌اند.'}
          </p>

          {result.missed.length > 0 && (
            <div className="remediation-panel mt-4 p-3 text-right">
              <h2 className="text-sm font-extrabold">مرور پاسخ‌های اشتباه</h2>
              <ul className="mt-2 space-y-3">
                {result.missed.map(({ question: missed, chosenId }) => (
                  <li key={missed.id} className="story-review-item">
                    <div className="text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>{questionLabel(missed)}</div>
                    <div className="mt-1 text-sm font-bold leading-7">{missed.prompt}</div>
                    {missed.context && <div className="question-context mt-2 text-sm" dir={missed.contextDir ?? 'rtl'}>{missed.context}</div>}
                    <div className="mt-2 text-xs font-bold" style={{ color: 'var(--crimson-deep)' }}>پاسخ تو</div>
                    <div dir={missed.optionDir} className={`text-sm leading-7 ${missed.optionDir === 'ltr' ? 'font-en text-left' : ''}`}>{optionLabel(missed, chosenId)}</div>
                    <div className="mt-1 text-xs font-bold">پاسخ درست</div>
                    <div dir={missed.optionDir} className={`text-sm font-bold leading-7 ${missed.optionDir === 'ltr' ? 'font-en text-left' : ''}`}>{optionLabel(missed, missed.answerId)}</div>
                    <button type="button" className="btn-quiet mt-2 px-3 py-2 text-xs" onClick={() => onOpenChapter(missed.chapterId)}>
                      <span className="inline-flex items-center gap-2"><BookOpenTextIcon className="h-4 w-4" />بازخوانی {CHAPTER_BY_ID.get(missed.chapterId)?.titleFa ?? 'فصل'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" className="btn-paper py-3" onClick={onBack}>مسیر یادگیری</button>
            {!result.passed ? (
              <button type="button" className="btn-crimson py-3" onClick={retake}>دوباره امتحان کن</button>
            ) : !vocabularyPassed ? (
              <button type="button" className="btn-ink py-3" onClick={() => onOpenExam(bookExamId(book))}>آزمون واژه‌ها ←</button>
            ) : (
              <button type="button" className="btn-ink py-3" onClick={onBack}>ادامهٔ مسیر ←</button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!question) return null

  return (
    <div className="page-in mx-auto min-h-screen max-w-3xl px-4 pb-28 pt-5" style={{ background: 'var(--cream)' }}>
      <header className="flex items-center gap-3">
        <button type="button" className="btn-paper reader-header-button" onClick={onBack} aria-label="ترک آزمون"><BackIcon className="h-5 w-5" /></button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold">{storyTestTitle(book)}</h1>
          <p className="mt-1 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
            {book === 1
              ? 'قصهٔ کتاب ۱ را از اول تا آخر به یاد بیاور.'
              : `قصهٔ کتاب ${faNum(book)} و مرور همهٔ کتاب‌های قبل.`}
          </p>
        </div>
      </header>

      <div className="mt-5 flex items-center justify-between text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>
        <span>سؤال {faNum(index + 1)} از {faNum(total)}</span>
        <span>حد قبولی {percent(STORY_TEST_PASS_RATE)}</span>
      </div>
      <div className="mastery-progress mt-2"><span style={{ width: `${(answeredCount / total) * 100}%` }} /></div>

      <div className="paper-note mt-4">
        پاسخ‌ها تا پایان آزمون بررسی نمی‌شوند و تا پیش از ثبت می‌توانی به سؤال قبلی برگردی. در پایان، هر اشتباه با پاسخ درست و فصلی که باید دوباره خواند نشان داده می‌شود.
      </div>

      {resumed && (
        <div className="prep-resume-row mt-3" role="status">
          <span>پیشرفت این آزمون بازیابی شد؛ از سؤال {faNum(index + 1)} ادامه می‌دهی.</span>
          <button type="button" className="btn-quiet shrink-0 px-3 text-xs" onClick={restart}>شروع از اول</button>
        </div>
      )}

      <div className="learning-focus-card story-test-card mt-5 p-5 sm:p-6">
        <span className="mastery-chip">{question.scope === 'previous' ? `مرور · ${questionLabel(question)}` : questionLabel(question)}</span>
        <h2 ref={questionRef} tabIndex={-1} className="mt-3 text-base font-extrabold leading-8">{question.prompt}</h2>
        {question.context && (
          <div className="question-context mt-3" dir={question.contextDir ?? 'rtl'}>{question.context}</div>
        )}

        <div data-testid="story-test-options" className="mt-4 grid grid-cols-1 gap-2" dir={question.optionDir}>
          {question.options.map(option => (
            <button
              key={option.id}
              type="button"
              className={`btn-paper story-option min-h-12 px-3 py-3 text-sm leading-6 ${question.optionDir === 'ltr' ? 'font-en' : ''}`}
              aria-pressed={chosen === option.id}
              onClick={() => choose(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="btn-quiet py-3 text-sm" disabled={index === 0} onClick={() => move(index - 1)}>قبلی</button>
          {isLast ? (
            <button type="button" className="btn-crimson py-3" disabled={answeredCount < total} onClick={finish}>ثبت و پایان آزمون</button>
          ) : (
            <button type="button" className="btn-ink py-3" disabled={chosen === undefined} onClick={() => move(index + 1)}>بعدی ←</button>
          )}
        </div>
      </div>
    </div>
  )
}
