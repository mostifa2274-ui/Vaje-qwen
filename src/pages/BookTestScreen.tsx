import { useCallback, useEffect, useRef, useState } from 'react'
import type { GhesseState } from '../engine/types'
import type { TestSentence, TestText } from '../data/bookTests'
import { WORD_BY_ID } from '../data/chapters'
import { bookExamId, canTakeExam, examDefinition } from '../engine/gates'
import {
  BOOK_TEST_PASS_RATE,
  BOOK_TEST_SECTIONS,
  buildBookTest,
  emptyBookTestAnswers,
  listeningWordCorrect,
  recordBookTest,
  scoreBookTest,
  translationCorrect,
  type BookTest,
  type BookTestAnswers,
  type BookTestResult,
  type BookTestSection,
} from '../engine/bookTest'
import { clearBookTestDraft, loadBookTestDraft, saveBookTestDraft } from '../engine/bookTestDraft'
import { cancelEnglishSpeech, speakEnglishWithFallback, speechFailureNotice, type SpeechFailure } from '../engine/narration'
import { BackIcon, BadgeCheckIcon, CheckIcon, PauseIcon, PlayIcon, RefreshCcwIcon, SpeakerIcon } from '../components/Icons'
import { faNum, percent } from '../engine/format'

interface Props {
  book: number
  state: GhesseState
  onChange: (next: GhesseState) => void
  onBack: () => void
  onReview: () => void
}

type Phase = 'intro' | BookTestSection | 'result'

const SECTION_LABELS: Record<BookTestSection, string> = {
  translation: 'ترجمهٔ واژه‌ها',
  listeningWords: 'شنیدن واژه‌ها',
  reading: 'درک مطلب خواندنی',
  listening: 'درک مطلب شنیداری',
}

const SECTION_HINTS: Record<BookTestSection, string> = {
  translation: 'معنی فارسی هر واژه را بنویس؛ یک معنی درست کافی است.',
  listeningWords: 'هر واژه فقط پخش می‌شود و نوشته نمی‌شود. گوش کن و معنی درستش را انتخاب کن.',
  reading: 'متن را بخوان و به پنج سؤال پاسخ بده. تا پیش از ثبت می‌توانی پاسخ‌ها را عوض کنی.',
  listening: 'این متن فقط پخش می‌شود و تا پایان آزمون نمایش داده نمی‌شود. پس از یک‌بار شنیدن کامل، سؤال‌ها فعال می‌شوند و هر چند بار خواستی می‌توانی دوباره گوش کنی.',
}

const SPEECH_UNAVAILABLE = 'پخش صدای انگلیسی روی این دستگاه در دسترس نیست. صدای English Text-to-Speech مرورگر یا سیستم را فعال کن و دوباره «پخش» را بزن.'

function wallClockNow(): number {
  return Date.now()
}

function sectionDone(test: BookTest, answers: BookTestAnswers, section: BookTestSection): boolean {
  if (section === 'translation') return answers.translation.length >= test.translation.length
  if (section === 'listeningWords') return answers.listeningWords.length >= test.listeningWords.length
  return answers[section].every(choice => choice !== null)
}

function isSection(phase: Phase): phase is BookTestSection {
  return phase !== 'intro' && phase !== 'result'
}

/** Plays a text sentence by sentence with the device's English voice. */
function usePassagePlayer(sentences: readonly TestSentence[], voiceURI: string, rate: number, onComplete: () => void) {
  const [playing, setPlaying] = useState(-1)
  const [notice, setNotice] = useState('')
  const token = useRef(0)
  const completeRef = useRef(onComplete)

  useEffect(() => {
    completeRef.current = onComplete
  }, [onComplete])

  useEffect(() => () => {
    token.current++
    cancelEnglishSpeech()
  }, [])

  const stop = useCallback(() => {
    token.current++
    cancelEnglishSpeech()
    setPlaying(-1)
  }, [])

  const play = useCallback(() => {
    cancelEnglishSpeech()
    const current = ++token.current
    setNotice('')
    const fail = (failure: SpeechFailure = 'unavailable') => {
      if (token.current !== current) return
      token.current++
      cancelEnglishSpeech()
      setPlaying(-1)
      setNotice(speechFailureNotice(failure, SPEECH_UNAVAILABLE))
    }
    const at = (index: number) => {
      if (token.current !== current) return
      if (index >= sentences.length) {
        setPlaying(-1)
        completeRef.current()
        return
      }
      setPlaying(index)
      const next = () => {
        if (token.current === current) window.setTimeout(() => at(index + 1), 220)
      }
      if (!speakEnglishWithFallback(sentences[index].en, voiceURI, rate, 's', next, fail)) fail()
    }
    at(0)
  }, [rate, sentences, voiceURI])

  return { playing, notice, play, stop }
}

function SoundOffNote({ onEnable }: { onEnable: () => void }) {
  return (
    <div className="paper-note mt-4">
      بخش شنیداری بدون صدا انجام نمی‌شود.
      <button type="button" className="btn-ink mt-3 w-full py-2.5" onClick={onEnable}>روشن کردن صدا</button>
    </div>
  )
}

function Passage({ text, showTranslation = false }: { text: TestText; showTranslation?: boolean }) {
  if (!showTranslation) {
    return <p className="test-passage">{text.sentences.map(sentence => sentence.en).join(' ')}</p>
  }
  return (
    <ol className="test-passage-lines">
      {text.sentences.map((sentence, index) => (
        <li key={index}>
          <div className="font-en" dir="ltr">{sentence.en}</div>
          <div className="mt-1 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>{sentence.fa}</div>
        </li>
      ))}
    </ol>
  )
}

function Questions({
  text,
  prefix,
  chosen,
  disabled,
  onChoose,
}: {
  text: TestText
  prefix: string
  chosen: Array<number | null>
  disabled: boolean
  onChoose: (question: number, option: number) => void
}) {
  return (
    <ol className="mt-5 space-y-5">
      {text.questions.map((question, index) => (
        <li key={index}>
          <div id={`${prefix}-q${index}`} className="text-sm font-extrabold leading-7">
            {faNum(index + 1)}. {question.q}
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-labelledby={`${prefix}-q${index}`}>
            {question.options.map((option, optionIndex) => (
              <button
                key={optionIndex}
                type="button"
                className="btn-paper test-option min-h-12 px-3 py-2.5 text-sm leading-6"
                aria-pressed={chosen[index] === optionIndex}
                disabled={disabled}
                onClick={() => onChoose(index, optionIndex)}
              >
                {option}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ol>
  )
}

function QuestionReview({ text, chosen }: { text: TestText; chosen: Array<number | null> }) {
  return (
    <ol className="mt-4 space-y-3">
      {text.questions.map((question, index) => {
        const answer = chosen[index]
        const right = answer === question.answer
        return (
          <li key={index} className="test-review-item">
            <div className="text-sm font-bold leading-7">{faNum(index + 1)}. {question.q}</div>
            <div className="mt-1 text-sm leading-7">
              <span className={right ? 'review-mark-right' : 'review-mark-wrong'}>{right ? '✓' : '✗'}</span>{' '}
              پاسخ تو: {answer === null ? '—' : question.options[answer]}
            </div>
            {!right && <div className="text-sm font-bold leading-7">پاسخ درست: {question.options[question.answer]}</div>}
          </li>
        )
      })}
    </ol>
  )
}

export default function BookTestScreen({ book, state, onChange, onBack, onReview }: Props) {
  const examId = bookExamId(book)
  const def = examDefinition(examId)!
  // Opened through explore mode before the learner reached it: a preview
  // whose attempts are never recorded.
  const [preview] = useState(() => !canTakeExam(state, examId))
  const [previewRuns, setPreviewRuns] = useState(0)
  // Explore mode can open any section directly. An attempt that skipped a
  // section is practice: it is scored and reviewed but never recorded.
  const explore = state.exploreAll
  const [practice, setPractice] = useState(false)
  const unrecorded = preview || practice
  const [test, setTest] = useState<BookTest>(() => buildBookTest(book, state, (state.exams[examId]?.attempts ?? 0) + 1)!)
  const [initialDraft] = useState(() => loadBookTestDraft(test))
  const [resumed, setResumed] = useState(Boolean(initialDraft))
  const [phase, setPhase] = useState<Phase>(() => initialDraft?.section ?? 'intro')
  const [answers, setAnswers] = useState<BookTestAnswers>(() => initialDraft?.answers ?? emptyBookTestAnswers(test))
  const [timings, setTimings] = useState<Record<string, number>>(() => initialDraft?.timings ?? {})
  const [listeningHeard, setListeningHeard] = useState(() => initialDraft?.listeningHeard ?? false)
  const [typed, setTyped] = useState('')
  const [wordReady, setWordReady] = useState(false)
  const [wordNotice, setWordNotice] = useState('')
  const [result, setResult] = useState<BookTestResult | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const itemStartedAt = useRef(0)
  const wordToken = useRef(0)
  const mountedRef = useRef(false)

  const translationIndex = answers.translation.length
  const listenIndex = answers.listeningWords.length
  const translationWord = phase === 'translation' ? WORD_BY_ID.get(test.translation[translationIndex]?.wordId ?? '') : undefined
  const listenItem = phase === 'listeningWords' ? test.listeningWords[listenIndex] : undefined
  const listenWord = listenItem ? WORD_BY_ID.get(listenItem.wordId) : undefined

  const heardListening = useCallback(() => setListeningHeard(true), [])
  const passage = usePassagePlayer(test.listening.sentences, state.narratorVoiceURI, state.narratorRate, heardListening)
  const reviewPassage = usePassagePlayer(test.listening.sentences, state.narratorVoiceURI, state.narratorRate, () => {})

  // New section: start at the top with focus on its heading.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    window.scrollTo({ top: 0, behavior: 'auto' })
    headingRef.current?.focus({ preventScroll: true })
  }, [phase])

  useEffect(() => {
    itemStartedAt.current = wallClockNow()
  }, [phase, translationIndex, listenIndex])

  useEffect(() => {
    if (phase !== 'translation') return
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
    return () => window.cancelAnimationFrame(frame)
  }, [phase, translationIndex])

  useEffect(() => {
    if (!isSection(phase)) return
    if (phase === 'translation' && answers.translation.length === 0) return
    saveBookTestDraft(test, { section: phase, answers, timings, listeningHeard })
  }, [answers, listeningHeard, phase, test, timings])

  const speakWord = useCallback(() => {
    if (!listenWord || !state.soundOn) return
    const current = ++wordToken.current
    setWordReady(false)
    setWordNotice('')
    const unavailable = (failure: SpeechFailure = 'unavailable') => {
      if (wordToken.current !== current) return
      setWordReady(false)
      setWordNotice(speechFailureNotice(failure, SPEECH_UNAVAILABLE))
    }
    const started = speakEnglishWithFallback(listenWord.word, state.narratorVoiceURI, state.narratorRate, 'w', () => {
      if (wordToken.current !== current) return
      setWordReady(true)
      setWordNotice('')
    }, unavailable)
    if (!started) unavailable()
  }, [listenWord, state.narratorRate, state.narratorVoiceURI, state.soundOn])

  // Each listening word plays on arrival; the button replays it.
  useEffect(() => {
    if (!listenWord || !state.soundOn) return
    const timer = window.setTimeout(speakWord, 90)
    return () => window.clearTimeout(timer)
  }, [listenWord, speakWord, state.soundOn])

  useEffect(() => () => {
    wordToken.current++
    cancelEnglishSpeech()
  }, [])

  function enableSound() {
    onChange({ ...state, soundOn: true })
  }

  function answerTranslation(value: string) {
    if (!translationWord) return
    setResumed(false)
    const elapsed = Math.max(1, wallClockNow() - itemStartedAt.current)
    const translation = [...answers.translation, value.trim()]
    setAnswers({ ...answers, translation })
    setTimings({ ...timings, [`translation:${translationIndex}`]: elapsed })
    setTyped('')
    if (translation.length >= test.translation.length) setPhase(nextOpenSection({ ...answers, translation }, 'translation'))
  }

  function answerListeningWord(chosen: string) {
    if (!listenItem || !wordReady) return
    setResumed(false)
    wordToken.current++
    const elapsed = Math.max(1, wallClockNow() - itemStartedAt.current)
    const listeningWords = [...answers.listeningWords, chosen]
    setAnswers({ ...answers, listeningWords })
    setTimings({ ...timings, [`listeningWords:${listenIndex}`]: elapsed })
    setWordReady(false)
    setWordNotice('')
    if (listeningWords.length >= test.listeningWords.length) setPhase(nextOpenSection({ ...answers, listeningWords }, 'listeningWords'))
  }

  // The next section still to do; in the normal order that is simply the next one.
  function nextOpenSection(next: BookTestAnswers, from: BookTestSection): BookTestSection {
    return BOOK_TEST_SECTIONS
      .slice(BOOK_TEST_SECTIONS.indexOf(from) + 1)
      .find(section => !sectionDone(test, next, section)) ?? 'listening'
  }

  function jumpToSection(section: BookTestSection) {
    if (!explore || section === phase) return
    setResumed(false)
    passage.stop()
    wordToken.current++
    setTyped('')
    setWordReady(false)
    setWordNotice('')
    // A finished word section starts over when reopened; any other keeps its answers.
    if (section === 'translation' && sectionDone(test, answers, section)) setAnswers({ ...answers, translation: [] })
    if (section === 'listeningWords' && sectionDone(test, answers, section)) setAnswers({ ...answers, listeningWords: [] })
    setPhase(section)
  }

  function choose(section: 'reading' | 'listening', question: number, option: number) {
    setResumed(false)
    const next = [...answers[section]]
    next[question] = option
    setAnswers({ ...answers, [section]: next })
  }

  function finish() {
    if (!answers.listening.every(choice => choice !== null) || !listeningHeard) return
    passage.stop()
    const scored = scoreBookTest(test, answers)
    clearBookTestDraft(book)
    const fullAttempt = BOOK_TEST_SECTIONS.every(section => sectionDone(test, answers, section))
    setPractice(!fullAttempt)
    if (!preview && fullAttempt) onChange(recordBookTest(state, test, answers, scored, wallClockNow(), timings))
    setResult(scored)
    setPhase('result')
  }

  function reset(next: BookTest) {
    clearBookTestDraft(book)
    passage.stop()
    reviewPassage.stop()
    wordToken.current++
    setTest(next)
    setAnswers(emptyBookTestAnswers(next))
    setTimings({})
    setListeningHeard(false)
    setTyped('')
    setWordReady(false)
    setWordNotice('')
    setResumed(false)
    setResult(null)
    setPractice(false)
  }

  function restart() {
    reset(test)
    setPhase('translation')
  }

  function retake() {
    // An unrecorded run adds no attempt, so it counts its own to vary the texts.
    const extra = unrecorded ? previewRuns + 1 : 0
    if (unrecorded) setPreviewRuns(extra)
    reset(buildBookTest(book, state, (state.exams[examId]?.attempts ?? 0) + 1 + extra)!)
    setPhase('intro')
  }

  const sectionNumber = isSection(phase) ? BOOK_TEST_SECTIONS.indexOf(phase) : -1

  const header = (
    <>
    <header className="flex items-center gap-3">
      <button type="button" className="btn-paper reader-header-button" onClick={onBack} aria-label="ترک آزمون"><BackIcon className="h-5 w-5" /></button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-extrabold">{def.titleFa}</h1>
        <p className="mt-1 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>{def.subtitleFa}</p>
      </div>
    </header>
    {preview && <div className="explore-note mt-4" role="status"><span><b>پیش‌نمایش در حالت کاوش.</b> هنوز به این آزمون نرسیده‌ای؛ نتیجه‌اش ثبت نمی‌شود و مسیری را باز نمی‌کند.</span></div>}
    </>
  )

  if (phase === 'result' && result) {
    const previousPass = state.exams[examId]?.passed === true && !result.passed
    const missed = [
      ...test.translation.flatMap((item, index) => translationCorrect(test, index, answers.translation[index])
        ? []
        : [{ key: `t${index}`, wordId: item.wordId, section: 'translation' as const, given: answers.translation[index] || 'نمی‌دانم' }]),
      ...test.listeningWords.flatMap((item, index) => listeningWordCorrect(test, index, answers.listeningWords[index])
        ? []
        : [{
            key: `l${index}`,
            wordId: item.wordId,
            section: 'listeningWords' as const,
            given: item.options.find(option => option.id === answers.listeningWords[index])?.label ?? 'نمی‌دانم',
          }]),
    ]
    const canRetake = unrecorded || (!result.passed && result.missedWordIds.length === 0 && canTakeExam(state, examId))
    const next = book === 8 ? 'آزمون نهایی' : `کتاب ${faNum(book + 1)}`
    return (
      <div className="page-in mx-auto min-h-screen max-w-3xl px-4 pb-28 pt-6" style={{ background: 'var(--cream)' }}>
        <div className={`exam-result-card p-6 text-center ${result.passed ? 'exam-pass' : 'exam-fail'}`}>
          {result.passed && result.missedWordIds.length === 0
            ? <BadgeCheckIcon className="mx-auto h-11 w-11" aria-hidden="true" />
            : <RefreshCcwIcon className="mx-auto h-10 w-10" aria-hidden="true" />}
          <h1 ref={headingRef} tabIndex={-1} className="mt-3 text-2xl font-extrabold">
            {result.passed
              ? result.missedWordIds.length ? 'قبول شدی؛ حالا خطاها را ببند' : 'آزمون پایان کتاب را گذراندی'
              : previousPass ? 'قبولی قبلی حفظ شده است' : 'هنوز آمادهٔ عبور نیستی'}
          </h1>

          <div className="mt-5 grid grid-cols-2 gap-2">
            {BOOK_TEST_SECTIONS.map(section => {
              const score = result.sections[section]
              return (
                <div key={section} className={`metric-card ${score.passed ? '' : 'metric-fail'}`}>
                  <b>{faNum(score.correct)}/{faNum(score.total)}</b>
                  <span>{SECTION_LABELS[section]} · {score.passed ? 'قبول' : `زیر ${percent(BOOK_TEST_PASS_RATE)}`}</span>
                </div>
              )
            })}
          </div>

          <p className="mt-4 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
            برای قبولی، هر چهار بخش دست‌کم {percent(BOOK_TEST_PASS_RATE)} لازم دارد.
            {preview
              ? ' پیش‌نمایش در حالت کاوش: این نتیجه ثبت نمی‌شود و مسیری را باز نمی‌کند.'
              : practice
              ? ' تمرین در حالت کاوش: چون بخشی از آزمون رد شد، این نتیجه ثبت نمی‌شود.'
              : result.passed
              ? result.missedWordIds.length
                ? ` راه ${next} پس از آن باز می‌شود که ${faNum(result.missedWordIds.length)} واژهٔ از‌دست‌رفته را در مرور هوشمند بدون کمک به یاد بیاوری.`
                : ` راه ${next} باز شد.`
              : result.missedWordIds.length
                ? ` ${faNum(result.missedWordIds.length)} واژهٔ از‌دست‌رفته وارد مرور جبرانی شده‌اند؛ پس از ترمیم آن‌ها آزمون دوباره باز می‌شود و متن‌های تازه‌ای می‌آورد.`
                : ' آزمون دوباره متن‌های تازه‌ای برای درک مطلب می‌آورد.'}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" className="btn-paper py-3" onClick={onBack}>مسیر یادگیری</button>
            {result.missedWordIds.length > 0 && !unrecorded ? (
              <button type="button" className="btn-crimson py-3" onClick={onReview}>مرور جبرانی</button>
            ) : canRetake ? (
              <button type="button" className="btn-crimson py-3" onClick={retake}>دوباره امتحان کن</button>
            ) : (
              <button type="button" className="btn-ink py-3" onClick={onBack}>ادامهٔ مسیر ←</button>
            )}
          </div>
        </div>

        <section className="learning-focus-card mt-5 p-5 text-right sm:p-6" aria-labelledby="review-heading">
          <h2 id="review-heading" className="text-lg font-extrabold">مرور پاسخ‌ها</h2>

          <h3 className="mt-4 text-sm font-extrabold">واژه‌ها</h3>
          {missed.length === 0 ? (
            <p className="mt-2 text-sm leading-7">هر {faNum(test.translation.length + test.listeningWords.length)} واژه درست بود.</p>
          ) : (
            <ul className="mt-2 space-y-3">
              {missed.map(item => {
                const word = WORD_BY_ID.get(item.wordId)!
                return (
                  <li key={item.key} className="test-review-item">
                    <div className="text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>{SECTION_LABELS[item.section]}</div>
                    <div className="mt-1 font-en text-lg font-bold" dir="ltr">{word.word}</div>
                    <div className="text-sm leading-7"><span className="review-mark-wrong">✗</span> پاسخ تو: {item.given}</div>
                    <div className="text-sm font-bold leading-7">معنی درست: {word.fa}</div>
                  </li>
                )
              })}
            </ul>
          )}

          <details className="test-review-details mt-5">
            <summary>متن خواندنی: {test.reading.titleFa} — متن، ترجمه و پاسخ‌ها</summary>
            <h4 className="mt-3 font-en text-base font-bold" dir="ltr">{test.reading.titleEn}</h4>
            <Passage text={test.reading} showTranslation />
            <QuestionReview text={test.reading} chosen={answers.reading} />
          </details>

          <details className="test-review-details mt-3">
            <summary>متن شنیداری: {test.listening.titleFa} — نمایش متن، ترجمه و پاسخ‌ها</summary>
            <div className="mt-3 flex items-center justify-between gap-3">
              <h4 className="font-en text-base font-bold" dir="ltr">{test.listening.titleEn}</h4>
              {state.soundOn && (
                <button
                  type="button"
                  className="btn-paper shrink-0 px-3 py-2 text-sm"
                  aria-label={reviewPassage.playing >= 0 ? 'توقف متن شنیداری' : 'پخش دوبارهٔ متن شنیداری'}
                  onClick={() => reviewPassage.playing >= 0 ? reviewPassage.stop() : reviewPassage.play()}
                >
                  <span className="inline-flex items-center gap-2">
                    {reviewPassage.playing >= 0 ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
                    {reviewPassage.playing >= 0 ? 'توقف' : 'پخش دوباره'}
                  </span>
                </button>
              )}
            </div>
            {reviewPassage.notice && <div className="paper-note mt-3" role="status">{reviewPassage.notice}</div>}
            <Passage text={test.listening} showTranslation />
            <QuestionReview text={test.listening} chosen={answers.listening} />
          </details>
        </section>
      </div>
    )
  }

  if (phase === 'intro') {
    return (
      <div className="page-in mx-auto min-h-screen max-w-3xl px-4 pb-28 pt-5" style={{ background: 'var(--cream)' }}>
        {header}
        <section className="learning-focus-card mt-5 p-5 sm:p-6" aria-labelledby="intro-heading">
          <h2 id="intro-heading" className="text-lg font-extrabold">چهار بخش، هر کدام جدا</h2>
          <ol className="test-intro-list mt-4">
            <li><b>{SECTION_LABELS.translation}</b> — {faNum(test.translation.length)} واژه؛ معنی فارسی را بنویس.</li>
            <li><b>{SECTION_LABELS.listeningWords}</b> — {faNum(test.listeningWords.length)} واژهٔ دیگر را فقط می‌شنوی و معنی‌اش را انتخاب می‌کنی.</li>
            <li><b>{SECTION_LABELS.reading}</b> — یک متن تازه و {faNum(test.reading.questions.length)} سؤال.</li>
            <li><b>{SECTION_LABELS.listening}</b> — متن تازهٔ دیگری که فقط پخش می‌شود و {faNum(test.listening.questions.length)} سؤال.</li>
          </ol>
          <p className="mt-4 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
            واژه‌ها از {book === 1 ? 'کتاب ۱' : `همهٔ کتاب‌های ۱ تا ${faNum(book)}`} می‌آیند و دو متن فقط با واژه‌هایی نوشته شده‌اند که تا اینجا یاد گرفته‌ای.
            برای قبولی، هر بخش دست‌کم {percent(BOOK_TEST_PASS_RATE)} لازم دارد. تا پایان آزمون بازخوردی نمایش داده نمی‌شود؛ بعد از آن همهٔ پاسخ‌ها، ترجمهٔ متن‌ها و متن شنیداری را می‌بینی.
          </p>
          <div className="paper-note mt-4">دو بخش شنیداری به صدای انگلیسی دستگاه نیاز دارند؛ اگر می‌توانی از هدفون استفاده کن.</div>
          <button type="button" className="btn-crimson mt-5 w-full py-3" onClick={() => setPhase('translation')}>شروع آزمون</button>
        </section>
      </div>
    )
  }

  if (!isSection(phase)) return null

  return (
    <div className="page-in mx-auto min-h-screen max-w-3xl px-4 pb-28 pt-5" style={{ background: 'var(--cream)' }}>
      {header}

      <ol className="test-steps mt-6" aria-label="بخش‌های آزمون">
        {BOOK_TEST_SECTIONS.map((section, index) => {
          const done = explore ? index !== sectionNumber && sectionDone(test, answers, section) : index < sectionNumber
          const content = (
            <>
              {done ? <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" /> : <span aria-hidden="true">{faNum(index + 1)}</span>}
              <span>{SECTION_LABELS[section]}</span>
            </>
          )
          return (
            <li key={section} className={done ? 'done' : index === sectionNumber ? 'current' : ''} aria-current={index === sectionNumber ? 'step' : undefined}>
              {explore
                ? <button type="button" className="test-step-jump" onClick={() => jumpToSection(section)}>{content}</button>
                : content}
            </li>
          )
        })}
      </ol>
      {explore && (
        <p className="mt-2 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
          در حالت کاوش هر بخش را می‌توانی مستقیم باز کنی؛ اگر بخشی رد شود، نتیجه فقط تمرین است و ثبت نمی‌شود.
        </p>
      )}

      {resumed && (
        <div className="prep-resume-row mt-3" role="status">
          <span>پیشرفت این آزمون بازیابی شد؛ از همان‌جا ادامه می‌دهی.</span>
          <button type="button" className="btn-quiet shrink-0 px-3 text-xs" onClick={restart}>شروع از اول</button>
        </div>
      )}

      <section className="learning-focus-card mt-4 p-5 sm:p-6" aria-labelledby="section-heading">
        <div className="text-xs font-bold" style={{ color: 'var(--crimson-deep)' }}>بخش {faNum(sectionNumber + 1)} از {faNum(BOOK_TEST_SECTIONS.length)}</div>
        <h2 id="section-heading" ref={headingRef} tabIndex={-1} className="mt-1 text-lg font-extrabold">{SECTION_LABELS[phase]}</h2>
        <p className="mt-1 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>{SECTION_HINTS[phase]}</p>

        {phase === 'translation' && translationWord && (
          <>
            <div className="mt-4 flex items-center justify-between text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>
              <span>واژهٔ {faNum(translationIndex + 1)} از {faNum(test.translation.length)}</span>
            </div>
            <div className="mastery-progress mt-2"><span style={{ width: `${(translationIndex / test.translation.length) * 100}%` }} /></div>
            <div data-testid="translation-headword" className="mt-7 text-center font-en text-4xl font-bold" dir="ltr">{translationWord.word}</div>
            <label htmlFor="book-test-translation" className="mt-6 block text-sm font-bold">معنی فارسی</label>
            <input
              id="book-test-translation"
              ref={inputRef}
              className="answer-input mt-2 w-full"
              dir="rtl"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="next"
              value={typed}
              onChange={event => setTyped(event.target.value)}
              onKeyDown={event => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                if (typed.trim()) answerTranslation(typed)
              }}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" className="btn-quiet py-3 text-sm" onClick={() => answerTranslation('')}>نمی‌دانم</button>
              <button type="button" className="btn-ink py-3" disabled={!typed.trim()} onClick={() => answerTranslation(typed)}>ثبت و بعدی</button>
            </div>
          </>
        )}

        {phase === 'listeningWords' && listenItem && listenWord && (
          <>
            <div className="mt-4 flex items-center justify-between text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>
              <span>واژهٔ {faNum(listenIndex + 1)} از {faNum(test.listeningWords.length)}</span>
            </div>
            <div className="mastery-progress mt-2"><span style={{ width: `${(listenIndex / test.listeningWords.length) * 100}%` }} /></div>
            {!state.soundOn ? <SoundOffNote onEnable={enableSound} /> : (
              <>
                <button type="button" className="btn-paper mt-6 min-h-20 w-full text-2xl" onClick={speakWord} aria-label="پخش دوبارهٔ واژه">
                  <span className="inline-flex items-center justify-center gap-2"><SpeakerIcon className="h-6 w-6" />پخش دوباره</span>
                </button>
                {wordNotice && <div className="paper-note mt-3" role="alert">{wordNotice}</div>}
                {!wordReady && !wordNotice && (
                  <div className="mt-3 text-center text-xs leading-6" role="status" style={{ color: 'var(--ink-soft)' }}>برای پاسخ، ابتدا واژه را تا پایان گوش کن.</div>
                )}
                <div data-testid="book-test-listening-options" className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {listenItem.options.map(option => (
                    <button key={option.id} type="button" className="btn-paper min-h-14 px-3 py-3" disabled={!wordReady} onClick={() => answerListeningWord(option.id)}>
                      {option.label}
                    </button>
                  ))}
                </div>
                <button type="button" className="btn-quiet mt-3 w-full py-2.5 text-sm" disabled={!wordReady} onClick={() => answerListeningWord('')}>نمی‌دانم — بعدی</button>
              </>
            )}
          </>
        )}

        {phase === 'reading' && (
          <>
            <article className="question-context mt-4" dir="ltr" aria-labelledby="reading-title">
              <h3 id="reading-title" className="font-en text-base font-bold">{test.reading.titleEn}</h3>
              <Passage text={test.reading} />
            </article>
            <Questions text={test.reading} prefix="reading" chosen={answers.reading} disabled={false} onChoose={(question, option) => choose('reading', question, option)} />
            <button
              type="button"
              className="btn-ink mt-5 w-full py-3"
              disabled={!answers.reading.every(choice => choice !== null)}
              onClick={() => setPhase('listening')}
            >
              ثبت و رفتن به بخش شنیداری ←
            </button>
          </>
        )}

        {phase === 'listening' && (
          <>
            {!state.soundOn ? <SoundOffNote onEnable={enableSound} /> : (
              <div className="test-player mt-4" data-testid="listening-player">
                <button
                  type="button"
                  className={passage.playing >= 0 ? 'btn-paper min-h-14 w-full text-lg' : 'btn-crimson min-h-14 w-full text-lg'}
                  onClick={() => passage.playing >= 0 ? passage.stop() : passage.play()}
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    {passage.playing >= 0 ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
                    {passage.playing >= 0 ? 'توقف' : listeningHeard ? 'پخش دوبارهٔ متن' : 'پخش متن'}
                  </span>
                </button>
                <div className="mt-3 text-center text-xs leading-6" role="status" style={{ color: 'var(--ink-soft)' }}>
                  {passage.playing >= 0
                    ? `در حال پخش: جملهٔ ${faNum(passage.playing + 1)} از ${faNum(test.listening.sentences.length)}`
                    : listeningHeard
                      ? 'متن را کامل شنیدی؛ حالا به سؤال‌ها پاسخ بده.'
                      : `${faNum(test.listening.sentences.length)} جمله؛ سؤال‌ها پس از یک‌بار شنیدن کامل فعال می‌شوند.`}
                </div>
                {passage.notice && <div className="paper-note mt-3" role="alert">{passage.notice}</div>}
              </div>
            )}
            <Questions text={test.listening} prefix="listening" chosen={answers.listening} disabled={!listeningHeard} onChoose={(question, option) => choose('listening', question, option)} />
            <button
              type="button"
              className="btn-crimson mt-5 w-full py-3"
              disabled={!listeningHeard || !answers.listening.every(choice => choice !== null)}
              onClick={finish}
            >
              ثبت و پایان آزمون
            </button>
          </>
        )}
      </section>
    </div>
  )
}
