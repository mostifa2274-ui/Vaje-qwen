import { useCallback, useEffect, useRef, useState } from 'react'
import type { GhesseState } from '../engine/types'
import { CHAPTERS, WORD_BY_ID } from '../data/chapters'
import { bookExamId, canTakeExam, examDefinition } from '../engine/gates'
import {
  BOOK_TEST_PASS_RATE,
  allowedMistakes,
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
import { clearBookTestDraft, loadBookTestDraft, saveBookTestDraft, savedBookTest } from '../engine/bookTestDraft'
import { cancelEnglishSpeech, speakEnglishWithFallback, speechFailureNotice, type SpeechFailure } from '../engine/narration'
import { BadgeCheckIcon, CheckIcon, RefreshCcwIcon, SpeakerIcon } from '../components/Icons'
import { LuxuryPageHeader } from '../components/LuxuryUI'
import { ListeningText, ListeningTextReview, Passage, Questions, ReadingTextReview, SoundOffNote } from '../components/TestPassage'
import { SPEECH_UNAVAILABLE } from '../components/usePassagePlayer'
import { faNum, percent } from '../engine/format'
import ChapterIllustration from '../components/ChapterIllustration'

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
  reading: 'هر متن را بخوان و به پنج سؤالش پاسخ بده. تا پیش از رفتن به متن بعدی می‌توانی پاسخ‌ها را عوض کنی.',
  listening: 'این متن‌ها فقط پخش می‌شوند و تا پایان آزمون نمایش داده نمی‌شوند. سؤال‌های هر متن پس از یک‌بار شنیدن کامل فعال می‌شوند و هر چند بار خواستی می‌توانی دوباره گوش کنی.',
}

// The word sections are long, so a short pause is offered every so many words.
const BREAK_EVERY = 40

function wallClockNow(): number {
  return Date.now()
}

function sectionDone(test: BookTest, answers: BookTestAnswers, section: BookTestSection): boolean {
  if (section === 'translation') return answers.translation.length >= test.translation.length
  if (section === 'listeningWords') return answers.listeningWords.length >= test.listeningWords.length
  return answers[section].every(chosen => chosen.every(choice => choice !== null))
}

function isSection(phase: Phase): phase is BookTestSection {
  return phase !== 'intro' && phase !== 'result'
}

export default function BookTestScreen({ book, state, onChange, onBack, onReview }: Props) {
  const examId = bookExamId(book)
  const def = examDefinition(examId)!
  const backdropChapter = CHAPTERS.find(item => item.book === book) ?? CHAPTERS[0]
  const bookBackdrop = (
    <div className="luxury-task-backdrop luxury-exam-backdrop" aria-hidden="true">
      <ChapterIllustration chapterId={backdropChapter.id} titleFa={backdropChapter.titleFa} />
      <span />
    </div>
  )
  // Opened through explore mode before the learner reached it: a preview
  // whose attempts are never recorded.
  const [preview] = useState(() => !canTakeExam(state, examId))
  const [previewRuns, setPreviewRuns] = useState(0)
  // Explore mode can open any section directly. An attempt that skipped a
  // section is practice: it is scored and reviewed but never recorded.
  const explore = state.exploreAll
  const [practice, setPractice] = useState(false)
  const unrecorded = preview || practice
  // An unfinished attempt resumes with its own words, even after reviews
  // would make a fresh build pick others.
  const [test, setTest] = useState<BookTest>(() => {
    const attempt = (state.exams[examId]?.attempts ?? 0) + 1
    return savedBookTest(book, attempt) ?? buildBookTest(book, state, attempt)!
  })
  const [initialDraft] = useState(() => loadBookTestDraft(test))
  const [resumed, setResumed] = useState(Boolean(initialDraft))
  const [phase, setPhase] = useState<Phase>(() => initialDraft?.section ?? 'intro')
  const [answers, setAnswers] = useState<BookTestAnswers>(() => initialDraft?.answers ?? emptyBookTestAnswers(test))
  const [timings, setTimings] = useState<Record<string, number>>(() => initialDraft?.timings ?? {})
  const [listeningHeard, setListeningHeard] = useState<boolean[]>(() => initialDraft?.listeningHeard ?? test.listening.map(() => false))
  // The text on screen within the reading or listening section.
  const [textIndex, setTextIndex] = useState(() => initialDraft?.textIndex ?? 0)
  // Set once explore mode opens a section out of order, so the draft keeps it.
  const [jumped, setJumped] = useState(() => initialDraft?.jumped === true)
  const [typed, setTyped] = useState('')
  const [onBreak, setOnBreak] = useState(false)
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
  const translationWord = phase === 'translation' && !onBreak ? WORD_BY_ID.get(test.translation[translationIndex]?.wordId ?? '') : undefined
  const listenItem = phase === 'listeningWords' && !onBreak ? test.listeningWords[listenIndex] : undefined
  const listenWord = listenItem ? WORD_BY_ID.get(listenItem.wordId) : undefined

  const heardListening = useCallback((slot: number) => {
    setListeningHeard(previous => previous[slot] ? previous : previous.map((value, index) => index === slot ? true : value))
  }, [])

  // New section: start at the top with focus on its heading.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    window.scrollTo({ top: 0, behavior: 'auto' })
    headingRef.current?.focus({ preventScroll: true })
  }, [phase, textIndex])

  useEffect(() => {
    itemStartedAt.current = wallClockNow()
  }, [phase, translationIndex, listenIndex, onBreak])

  useEffect(() => {
    if (phase !== 'translation' || onBreak) return
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
    return () => window.cancelAnimationFrame(frame)
  }, [onBreak, phase, translationIndex])

  useEffect(() => {
    if (!isSection(phase)) return
    if (phase === 'translation' && answers.translation.length === 0) return
    saveBookTestDraft(test, { section: phase, textIndex, answers, timings, listeningHeard, ...(jumped ? { jumped: true as const } : {}) })
  }, [answers, jumped, listeningHeard, phase, test, textIndex, timings])

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
    if (translation.length >= test.translation.length) openSection(nextOpenSection({ ...answers, translation }, 'translation'))
    else if (translation.length % BREAK_EVERY === 0) setOnBreak(true)
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
    if (listeningWords.length >= test.listeningWords.length) openSection(nextOpenSection({ ...answers, listeningWords }, 'listeningWords'))
    else if (listeningWords.length % BREAK_EVERY === 0) setOnBreak(true)
  }

  // The next section still to do; in the normal order that is simply the next one.
  function nextOpenSection(next: BookTestAnswers, from: BookTestSection): BookTestSection {
    return BOOK_TEST_SECTIONS
      .slice(BOOK_TEST_SECTIONS.indexOf(from) + 1)
      .find(section => !sectionDone(test, next, section)) ?? 'listening'
  }

  function openSection(section: BookTestSection) {
    setOnBreak(false)
    setTextIndex(0)
    setPhase(section)
  }

  function jumpToSection(section: BookTestSection) {
    if (!explore || section === phase) return
    setResumed(false)
    setJumped(true)
    wordToken.current++
    setTyped('')
    setWordReady(false)
    setWordNotice('')
    // A finished word section starts over when reopened; any other keeps its answers.
    if (section === 'translation' && sectionDone(test, answers, section)) setAnswers({ ...answers, translation: [] })
    if (section === 'listeningWords' && sectionDone(test, answers, section)) setAnswers({ ...answers, listeningWords: [] })
    openSection(section)
  }

  // Explore mode only: move between texts without answering.
  function jumpToText(to: number) {
    if (!explore) return
    setResumed(false)
    setJumped(true)
    setTextIndex(to)
  }

  function choose(section: 'reading' | 'listening', slot: number, question: number, option: number) {
    setResumed(false)
    setAnswers(previous => ({
      ...previous,
      [section]: previous[section].map((chosen, index) => index === slot
        ? chosen.map((value, at) => at === question ? option : value)
        : chosen),
    }))
  }

  /** The current text is answered (and, when heard only, was heard): go on. */
  function nextText(section: 'reading' | 'listening') {
    setResumed(false)
    const texts = test[section]
    if (textIndex + 1 < texts.length) {
      setTextIndex(textIndex + 1)
      return
    }
    if (section === 'reading') openSection('listening')
    else finish()
  }

  function finish() {
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
    wordToken.current++
    setTest(next)
    setOnBreak(false)
    setAnswers(emptyBookTestAnswers(next))
    setTimings({})
    setListeningHeard(next.listening.map(() => false))
    setTextIndex(0)
    setTyped('')
    setWordReady(false)
    setWordNotice('')
    setResumed(false)
    setResult(null)
    setPractice(false)
    setJumped(false)
  }

  function restart() {
    reset(test)
    openSection('translation')
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
      <LuxuryPageHeader
        title={def.titleFa}
        subtitle={def.subtitleFa}
        eyebrow={`کتاب ${faNum(book)} · آزمون پایان کتاب`}
        onBack={onBack}
        backLabel="ترک آزمون"
        centered
      />
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
      <div className="app-page luxury-exam page-in mx-auto max-w-3xl px-4 pb-28 pt-6">
        {bookBackdrop}
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
                  <span>{SECTION_LABELS[section]} · {score.passed ? 'قبول' : `حداکثر ${faNum(allowedMistakes(score.total))} اشتباه`}</span>
                </div>
              )
            })}
          </div>

          <p className="mt-4 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
            برای قبولی، هر چهار بخش باید دست‌کم {percent(BOOK_TEST_PASS_RATE)} درست باشد؛ یک اشتباه در هر بخش همیشه بخشیده می‌شود.
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
                    <div className="mt-1 font-en text-lg font-bold" lang="en" dir="ltr">{word.word}</div>
                    <div className="text-sm leading-7"><span className="review-mark-wrong">✗</span> پاسخ تو: {item.given}</div>
                    <div className="text-sm font-bold leading-7">معنی درست: {word.fa}</div>
                  </li>
                )
              })}
            </ul>
          )}

          <h3 className="mt-5 text-sm font-extrabold">متن‌ها</h3>
          {test.reading.map((text, slot) => (
            <ReadingTextReview
              key={text.id}
              text={text}
              chosen={answers.reading[slot]}
              summary={`متن خواندنی${test.reading.length > 1 ? ` ${faNum(slot + 1)}` : ''}: ${text.titleFa} — متن، ترجمه و پاسخ‌ها`}
            />
          ))}
          {test.listening.map((text, slot) => (
            <ListeningTextReview
              key={text.id}
              text={text}
              chosen={answers.listening[slot]}
              soundOn={state.soundOn}
              voiceURI={state.narratorVoiceURI}
              rate={state.narratorRate}
              summary={`متن شنیداری${test.listening.length > 1 ? ` ${faNum(slot + 1)}` : ''}: ${text.titleFa} — نمایش متن، ترجمه و پاسخ‌ها`}
            />
          ))}
        </section>
      </div>
    )
  }

  if (phase === 'intro') {
    return (
      <div className="app-page luxury-exam page-in mx-auto max-w-3xl px-4 pb-28 pt-5">
        {bookBackdrop}
        {header}
        <section className="learning-focus-card mt-5 p-5 sm:p-6" aria-labelledby="intro-heading">
          <h2 id="intro-heading" className="text-lg font-extrabold">چهار بخش</h2>
          <ol className="test-intro-list mt-4">
            <li><b>{SECTION_LABELS.translation}</b> — {faNum(test.translation.length)} واژه؛ معنی فارسی را بنویس.</li>
            <li><b>{SECTION_LABELS.listeningWords}</b> — {faNum(test.listeningWords.length)} واژهٔ دیگر را فقط می‌شنوی و معنی‌اش را انتخاب می‌کنی.</li>
            <li><b>{SECTION_LABELS.reading}</b> — {test.reading.length === 1 ? 'یک متن تازه' : `${faNum(test.reading.length)} متن تازه`}، هر کدام با ۵ سؤال.</li>
            <li><b>{SECTION_LABELS.listening}</b> — {test.listening.length === 1 ? 'متن تازهٔ دیگری' : `${faNum(test.listening.length)} متن تازهٔ دیگر`} که فقط پخش {test.listening.length === 1 ? 'می‌شود' : 'می‌شوند'}، هر کدام با ۵ سؤال.</li>
          </ol>
          <p className="mt-4 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
            {faNum(test.translation.length + test.listeningWords.length)} واژهٔ نمونه از {book === 1 ? 'این کتاب' : `کتاب‌های ۱ تا ${faNum(book)}`} می‌آید و کتاب تازه سهم بیشتری دارد. هر بخش باید دست‌کم {percent(BOOK_TEST_PASS_RATE)} درست باشد و یک اشتباه در هر بخش همیشه بخشیده می‌شود؛ واژه‌های اشتباه وارد مرور جبرانی می‌شوند.
          </p>
          <div className="paper-note mt-4">بازخورد در پایان آزمون نمایش داده می‌شود. پیشرفت خودکار ذخیره می‌شود و در بخش واژگان هر ۴۰ پاسخ یک وقفه داری.</div>
          <button type="button" className="btn-crimson mt-5 w-full py-3" onClick={() => setPhase('translation')}>شروع آزمون</button>
        </section>
      </div>
    )
  }

  if (!isSection(phase)) return null

  return (
    <div className="app-page luxury-exam page-in mx-auto max-w-3xl px-4 pb-28 pt-5">
      {bookBackdrop}
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

        {onBreak && (phase === 'translation' || phase === 'listeningWords') && (
          <div className="mt-5 text-center" data-testid="book-test-break">
            <div className="text-lg font-extrabold">وقفهٔ کوتاه</div>
            <p className="mt-2 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
              {faNum(phase === 'translation' ? translationIndex : listenIndex)} واژه از {faNum(phase === 'translation' ? test.translation.length : test.listeningWords.length)} را جواب داده‌ای.
              چند لحظه استراحت کن؛ پیشرفتت ذخیره شده است و حتی با بستن برنامه از دست نمی‌رود.
            </p>
            <button type="button" className="btn-ink mt-4 w-full py-3" onClick={() => setOnBreak(false)}>ادامه ←</button>
          </div>
        )}

        {phase === 'translation' && translationWord && (
          <>
            <div className="mt-4 flex items-center justify-between text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>
              <span>واژهٔ {faNum(translationIndex + 1)} از {faNum(test.translation.length)}</span>
            </div>
            <div className="mastery-progress mt-2"><span style={{ width: `${(translationIndex / test.translation.length) * 100}%` }} /></div>
            <div data-testid="translation-headword" className="mt-7 text-center font-en text-4xl font-bold" lang="en" dir="ltr">{translationWord.word}</div>
            <label htmlFor="book-test-translation" className="mt-6 block text-sm font-bold">معنی فارسی</label>
            <input
              id="book-test-translation"
              ref={inputRef}
              className="answer-input mt-2 w-full"
              dir="rtl"
              autoComplete="off"
              autoCorrect="off"
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

        {(phase === 'reading' || phase === 'listening') && (() => {
          const texts = test[phase]
          const slot = Math.min(textIndex, texts.length - 1)
          const text = texts[slot]
          const chosen = answers[phase][slot]
          const heard = phase === 'reading' || listeningHeard[slot]
          const ready = heard && chosen.every(choice => choice !== null)
          const last = slot + 1 >= texts.length
          return (
            <>
              {texts.length > 1 && (
                <>
                  <div className="mt-4 flex items-center justify-between text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>
                    <span>متن {faNum(slot + 1)} از {faNum(texts.length)}</span>
                  </div>
                  <div className="mastery-progress mt-2"><span style={{ width: `${(slot / texts.length) * 100}%` }} /></div>
                </>
              )}
              {phase === 'reading' ? (
                <>
                  <article className="question-context mt-4" lang="en" dir="ltr" aria-labelledby="reading-title">
                    <h3 id="reading-title" className="font-en text-base font-bold">{text.titleEn}</h3>
                    <Passage text={text} />
                  </article>
                  <Questions text={text} prefix={`reading-${slot}`} chosen={chosen} disabled={false} onChoose={(question, option) => choose('reading', slot, question, option)} />
                </>
              ) : (
                <ListeningText
                  key={text.id}
                  text={text}
                  prefix={`listening-${slot}`}
                  heard={listeningHeard[slot]}
                  chosen={chosen}
                  soundOn={state.soundOn}
                  voiceURI={state.narratorVoiceURI}
                  rate={state.narratorRate}
                  onHeard={() => heardListening(slot)}
                  onEnableSound={enableSound}
                  onChoose={(question, option) => choose('listening', slot, question, option)}
                />
              )}
              <button
                type="button"
                className={`${phase === 'listening' && last ? 'btn-crimson' : 'btn-ink'} mt-5 w-full py-3`}
                disabled={!ready}
                onClick={() => nextText(phase)}
              >
                {!last ? 'ثبت و متن بعدی ←' : phase === 'reading' ? 'ثبت و رفتن به بخش شنیداری ←' : 'ثبت و پایان آزمون'}
              </button>
              {explore && texts.length > 1 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" className="btn-quiet py-2.5 text-sm" disabled={slot === 0} onClick={() => jumpToText(slot - 1)}>متن قبلی</button>
                  <button type="button" className="btn-quiet py-2.5 text-sm" disabled={last} onClick={() => jumpToText(slot + 1)}>متن بعدی ←</button>
                </div>
              )}
            </>
          )
        })()}
      </section>
    </div>
  )
}
