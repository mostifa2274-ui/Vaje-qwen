import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GhesseState, WordEntry } from '../engine/types'
import { CHAPTERS, CHAPTER_BY_ID, WORD_BY_ID, lemmaMap, nextChapter } from '../data/chapters'
import { CHAPTER_LISTENING } from '../data/chapterListening'
import { BLOCKED_AUDIO_NOTICE, cancelEnglishSpeech, speakEnglishWithFallback, type SpeechFailure } from '../engine/narration'
import { buildReadingQuestions } from '../engine/comprehension'
import { recordCompletedRead } from '../engine/progress'
import { blankWordProgress } from '../engine/review'
import { bookExamId, canReadChapter } from '../engine/gates'
import SentenceRow from '../components/SentenceRow'
import GlossSheet from '../components/GlossSheet'
import { BackIcon, BadgeCheckIcon, PauseIcon, PlayIcon } from '../components/Icons'
import { clearReadingDraft, loadReadingDraft, readingQuestionSignature, saveReadingDraft } from '../engine/readingDraft'
import ChapterIllustration from '../components/ChapterIllustration'
import { faNum } from '../engine/format'
import { ListeningPlayer, Passage, Questions, SoundOffNote } from '../components/TestPassage'
import { usePassagePlayer } from '../components/usePassagePlayer'
import {
  checkListeningRound,
  chooseListeningAnswer,
  clearListeningDraft,
  emptyListeningRound,
  listeningCheckResult,
  listeningRoundDone,
  listeningRoundReady,
  loadListeningDraft,
  saveListeningDraft,
  type ListeningRound,
} from '../engine/listeningRound'

interface Props {
  chapterId: string
  state: GhesseState
  onChange: (next: GhesseState) => void
  onBack: () => void
  onOpenChapter: (id: string) => void
  onOpenPrep: (id: string) => void
  onOpenExam: (id: string) => void
}

function wallClockNow(): number {
  return Date.now()
}

export default function ReaderScreen({ chapterId, state, onChange, onBack, onOpenChapter, onOpenPrep, onOpenExam }: Props) {
  const chapter = CHAPTER_BY_ID.get(chapterId)!
  const questions = useMemo(() => buildReadingQuestions(chapter, WORD_BY_ID, CHAPTERS, lemmaMap), [chapter])
  const paragraphs = useMemo(() => {
    const paragraphSize = chapter.sentences.length >= 36 ? 5 : 4
    const groups: number[][] = []
    for (let start = 0; start < chapter.sentences.length; start += paragraphSize) {
      groups.push(Array.from({ length: Math.min(paragraphSize, chapter.sentences.length - start) }, (_, offset) => start + offset))
    }
    return groups
  }, [chapter])
  const readingMinutes = useMemo(() => {
    const words = chapter.sentences.reduce((sum, sentence) => sum + sentence.en.trim().split(/\s+/).length, 0)
    return Math.max(1, Math.ceil(words / 90))
  }, [chapter])

  const listeningText = CHAPTER_LISTENING.get(chapterId)!
  const [initialReadingDraft] = useState(() => loadReadingDraft(chapterId, questions))
  const [listening, setListening] = useState<ListeningRound>(() => loadListeningDraft(chapterId, listeningText) ?? emptyListeningRound(listeningText))
  const [resumedReading, setResumedReading] = useState(Boolean(initialReadingDraft))
  const [openFa, setOpenFa] = useState<Set<number>>(new Set())
  const [gloss, setGloss] = useState<WordEntry | null>(null)
  const [playIdx, setPlayIdx] = useState(-1)
  const [playAll, setPlayAll] = useState(false)
  const [answers, setAnswers] = useState<Record<number, string>>(() => initialReadingDraft?.answers ?? {})
  const [checkIndex, setCheckIndex] = useState(() => initialReadingDraft?.checkIndex ?? 0)
  const [firstPassCorrect, setFirstPassCorrect] = useState<number | undefined>(() => initialReadingDraft?.firstPassCorrect)
  // Set once explore mode jumps between questions: the saved draft may then have gaps.
  const [unordered, setUnordered] = useState(() => initialReadingDraft?.unordered === true)
  const [finished, setFinished] = useState(false)
  const [wasAlreadyDone] = useState(() => state.chapters[chapterId]?.completed === true)
  // Opened through explore mode before the learner reached it: a preview
  // whose taps and answers are never recorded.
  const [preview] = useState(() => !canReadChapter(state, chapterId))
  // Explore mode lets the learner move to any comprehension question.
  const explore = state.exploreAll
  const [audioNotice, setAudioNotice] = useState('')
  const playbackToken = useRef(0)
  const clockRef = useRef(wallClockNow)
  const questionRef = useRef<HTMLDivElement>(null)
  const questionHeadingRef = useRef<HTMLHeadingElement>(null)
  const followUpRef = useRef<HTMLButtonElement>(null)
  const pendingFocusRef = useRef<'question' | 'followUp' | null>(null)
  const listeningNoteRef = useRef<HTMLDivElement>(null)
  const pendingListeningFocus = useRef<'note' | 'finish' | null>(null)

  const stopReaderAudio = useCallback(() => {
    playbackToken.current++
    cancelEnglishSpeech()
    setPlayAll(false)
    setPlayIdx(-1)
  }, [])

  const checksAnswered = Object.keys(answers).length
  const checksCorrect = questions.filter((question, index) => answers[index] === question.answerId).length
  const correctionMode = firstPassCorrect !== undefined
  const currentQuestion = questions[Math.min(checkIndex, questions.length - 1)]
  const currentAnswer = answers[checkIndex]
  const currentCorrectLabel = currentQuestion?.options.find(option => option.id === currentQuestion.answerId)?.label ?? ''
  const next = nextChapter(chapterId)
  const canOpenNext = !!next && next.book === chapter.book
  const isLastOfBook = !next || next.book !== chapter.book
  const readingDone = checksCorrect === questions.length
  // Explore mode opens the listening part before the reading one is done.
  const showListening = readingDone || explore
  const listeningDone = listeningRoundDone(listeningText, listening)
  const listeningReady = listeningRoundReady(listeningText, listening)
  const listeningConfirmed = listening.locked.filter(Boolean).length
  const chapterDone = readingDone && listeningDone

  const heardListening = useCallback(() => setListening(round => round.heard ? round : { ...round, heard: true }), [])
  const listeningPlayer = usePassagePlayer(listeningText.sentences, state.narratorVoiceURI, state.narratorRate, heardListening)
  const stopListening = listeningPlayer.stop
  const listeningControls = {
    ...listeningPlayer,
    play: () => {
      stopReaderAudio()
      listeningPlayer.play()
    },
  }

  useEffect(() => () => {
    playbackToken.current++
    cancelEnglishSpeech()
  }, [])

  useEffect(() => {
    if (checkIndex > 0) questionRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }, [checkIndex])

  // Answer buttons disable (or unmount) as soon as they are used. Keep keyboard
  // and screen-reader focus on the learner's next step instead of the page:
  // the follow-up action after an answer, the question text after moving on.
  useEffect(() => {
    const target = pendingFocusRef.current
    if (!target) return
    pendingFocusRef.current = null
    // Next frame, so the key that chose an answer cannot also activate the
    // newly focused control.
    const frame = window.requestAnimationFrame(() => {
      if (target === 'followUp') followUpRef.current?.focus()
      else questionHeadingRef.current?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [checkIndex, currentAnswer])

  useEffect(() => {
    const target = pendingListeningFocus.current
    if (!target) return
    pendingListeningFocus.current = null
    const frame = window.requestAnimationFrame(() => {
      if (target === 'finish') followUpRef.current?.focus()
      else listeningNoteRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [listening])

  useEffect(() => {
    if (finished) return
    if (!listening.heard && listening.answers.every(answer => answer === null)) {
      clearListeningDraft(chapterId)
      return
    }
    saveListeningDraft(chapterId, listeningText, listening)
  }, [chapterId, finished, listening, listeningText])

  useEffect(() => {
    if (finished) return
    if (checkIndex === 0 && Object.keys(answers).length === 0) {
      clearReadingDraft(chapterId)
      return
    }
    saveReadingDraft({
      version: 1,
      chapterId,
      signature: readingQuestionSignature(questions),
      checkIndex,
      answers,
      firstPassCorrect,
      ...(unordered ? { unordered: true as const } : {}),
      updatedAt: Date.now(),
    }, questions)
  }, [answers, chapterId, checkIndex, finished, firstPassCorrect, questions, unordered])

  useEffect(() => {
    if (!playAll || playIdx < 0 || typeof window === 'undefined') return

    const frame = window.requestAnimationFrame(() => {
      const line = document.querySelector<HTMLElement>(`[data-story-index="${playIdx}"]`)
      if (!line) return

      const rect = line.getBoundingClientRect()
      const topGuard = 88
      const bottomGuard = window.innerHeight - 48
      if (rect.top >= topGuard && rect.bottom <= bottomGuard) return

      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
      line.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: reduceMotion ? 'auto' : 'smooth',
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [playAll, playIdx])

  function playAt(index: number, chain: boolean) {
    if (!state.soundOn || index < 0 || index >= chapter.sentences.length) {
      stopReaderAudio()
      return
    }

    stopListening()
    const token = ++playbackToken.current
    cancelEnglishSpeech()
    setPlayIdx(index)
    setPlayAll(chain)

    const done = () => {
      if (playbackToken.current !== token) return
      if (chain && index + 1 < chapter.sentences.length) playAt(index + 1, true)
      else {
        setPlayIdx(-1)
        setPlayAll(false)
      }
    }

    const failPlayback = (failure: SpeechFailure = 'unavailable') => {
      if (playbackToken.current !== token) return
      playbackToken.current++
      cancelEnglishSpeech()
      setAudioNotice(failure === 'blocked'
        ? BLOCKED_AUDIO_NOTICE
        : 'صدای انگلیسی این جمله پخش نشد. اتصال اینترنت یا صدای English Text-to-Speech دستگاه را بررسی کن و دوباره پخش را بزن.')
      setPlayIdx(-1)
      setPlayAll(false)
    }

    setAudioNotice('')
    const started = speakEnglishWithFallback(
      chapter.sentences[index].en,
      state.narratorVoiceURI,
      state.narratorRate,
      's',
      done,
      failPlayback,
    )
    if (!started) failPlayback()
  }

  function toggleFa(index: number) {
    setOpenFa(previous => {
      const nextSet = new Set(previous)
      if (nextSet.has(index)) nextSet.delete(index)
      else nextSet.add(index)
      return nextSet
    })
  }

  function tapWord(wordId: string) {
    const entry = WORD_BY_ID.get(wordId)
    if (!entry) return
    stopReaderAudio()
    setGloss(entry)
    const word = state.words[wordId]
    if (word?.introduced && !preview) {
      onChange({
        ...state,
        words: { ...state.words, [wordId]: { ...word, taps: word.taps + 1 } },
      })
    }
  }

  function answer(questionIndex: number, optionId: string) {
    if (answers[questionIndex] !== undefined) return
    const question = questions[questionIndex]
    if (!question) return
    if (resumedReading) setResumedReading(false)
    const correct = optionId === question.answerId
    const nextAnswers = { ...answers, [questionIndex]: optionId }

    saveReadingDraft({
      version: 1,
      chapterId,
      signature: readingQuestionSignature(questions),
      checkIndex: questionIndex,
      answers: nextAnswers,
      firstPassCorrect,
      ...(unordered ? { unordered: true as const } : {}),
      updatedAt: clockRef.current(),
    }, questions)
    pendingFocusRef.current = 'followUp'
    setAnswers(nextAnswers)

    if (!question.evidenceWordId || preview) return
    const now = clockRef.current()
    const nextWords = { ...state.words }
    const current = nextWords[question.evidenceWordId] ?? blankWordProgress(now)
    nextWords[question.evidenceWordId] = {
      ...current,
      checkCorrect: current.checkCorrect + (correct ? 1 : 0),
      checkWrong: current.checkWrong + (correct ? 0 : 1),
      lastCheckAt: now,
    }
    onChange({ ...state, words: nextWords })
  }

  // The next open question after the current one; after explore-mode jumps,
  // wrap around to an earlier one that is still open.
  function nextUnansweredIndex(): number {
    const after = questions.findIndex((_, index) => index > checkIndex && answers[index] === undefined)
    return after >= 0 ? after : questions.findIndex((_, index) => index !== checkIndex && answers[index] === undefined)
  }

  function continueQuestion() {
    if (currentAnswer === undefined) return
    if (resumedReading) setResumedReading(false)
    const nextUnanswered = nextUnansweredIndex()
    if (nextUnanswered < 0) return
    pendingFocusRef.current = 'question'
    setCheckIndex(nextUnanswered)
  }

  function jumpToQuestion(index: number) {
    if (finished || index === checkIndex) return
    if (resumedReading) setResumedReading(false)
    pendingFocusRef.current = 'question'
    setUnordered(true)
    setCheckIndex(index)
  }

  function beginCorrectionRound() {
    if (checksAnswered !== questions.length || checksCorrect === questions.length) return
    if (resumedReading) setResumedReading(false)

    const wrongIndices = questions
      .map((question, index) => answers[index] === question.answerId ? -1 : index)
      .filter(index => index >= 0)
    if (wrongIndices.length === 0) return

    const correctedAnswers = { ...answers }
    for (const index of wrongIndices) delete correctedAnswers[index]

    const initialScore = firstPassCorrect ?? checksCorrect
    const nextIndex = wrongIndices[0]
    setFirstPassCorrect(initialScore)
    pendingFocusRef.current = 'question'
    setAnswers(correctedAnswers)
    setCheckIndex(nextIndex)
    saveReadingDraft({
      version: 1,
      chapterId,
      signature: readingQuestionSignature(questions),
      checkIndex: nextIndex,
      answers: correctedAnswers,
      firstPassCorrect: initialScore,
      ...(unordered ? { unordered: true as const } : {}),
      updatedAt: clockRef.current(),
    }, questions)
  }

  function retryCurrentCorrection() {
    if (!correctionMode || currentAnswer === undefined || currentAnswer === currentQuestion.answerId) return
    const nextAnswers = { ...answers }
    delete nextAnswers[checkIndex]
    pendingFocusRef.current = 'question'
    setAnswers(nextAnswers)
    saveReadingDraft({
      version: 1,
      chapterId,
      signature: readingQuestionSignature(questions),
      checkIndex,
      answers: nextAnswers,
      firstPassCorrect,
      ...(unordered ? { unordered: true as const } : {}),
      updatedAt: clockRef.current(),
    }, questions)
  }

  function chooseListening(question: number, option: number) {
    setListening(round => chooseListeningAnswer(listeningText, round, question, option))
  }

  function checkListening() {
    if (!listeningReady) return
    const checked = checkListeningRound(listeningText, listening)
    pendingListeningFocus.current = listeningRoundDone(listeningText, checked) ? 'finish' : 'note'
    setListening(checked)
  }

  function finishChapter() {
    const listeningCheck = listeningCheckResult(listeningText, listening)
    if (checksCorrect !== questions.length || !listeningCheck || preview) return
    stopListening()
    const successor = nextChapter(chapterId)
    const nextState = recordCompletedRead(
      state,
      chapterId,
      chapter.new,
      firstPassCorrect ?? checksCorrect,
      questions.length,
      checksCorrect,
      listeningCheck,
      clockRef.current(),
      CHAPTERS.map(item => item.id),
      successor?.book === chapter.book ? successor.id : undefined,
    )
    clearReadingDraft(chapterId)
    clearListeningDraft(chapterId)
    setFinished(true)
    onChange(nextState)
  }

  return (
    <div className="app-page page-in">
      <div className="sticky top-0 z-40 app-task-header">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <button type="button" className="btn-paper reader-header-button" onClick={onBack} aria-label="بازگشت به نقشه">
            <BackIcon className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>
              کتاب {faNum(chapter.book)} · فصل {faNum(chapter.n)}
            </div>
            <h1 className="truncate text-lg font-extrabold">{chapter.titleFa}</h1>
          </div>
          <button
            type="button"
            className={`btn-paper px-3 py-2 text-sm ${playAll ? 'ring-2' : ''}`}
            style={playAll ? { background: 'var(--gold)' } : undefined}
            disabled={!state.soundOn}
            aria-pressed={playAll}
            onClick={() => playAll ? stopReaderAudio() : playAt(0, true)}
          >
            <span className="inline-flex items-center gap-2">
              {playAll ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
              {playAll ? 'توقف' : 'خواندن'}
            </span>
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pb-32">
        {audioNotice && <div className="paper-note mt-4" role="status">{audioNotice}</div>}

        <section className="lesson-cover-card mt-4 overflow-hidden">
          <ChapterIllustration chapterId={chapter.id} titleFa={chapter.titleFa} />
          <div className="lesson-cover-copy">
            <div className="min-w-0 font-en text-sm font-bold" dir="ltr">{chapter.titleEn}</div>
            <div className="shrink-0 text-left text-xs" style={{ color: 'var(--ink-soft)' }}>
              {faNum(chapter.sentences.length)} جمله · حدود {faNum(readingMinutes)} دقیقه
            </div>
          </div>
        </section>

        {state.exploreAll && (
          <div className="explore-note mt-4" role="status">
            <span>
              {preview
                ? <><b>پیش‌نمایش در حالت کاوش.</b> هنوز به این فصل نرسیده‌ای؛ خواندن و پاسخ‌های اینجا ثبت نمی‌شوند.</>
                : <><b>حالت کاوش.</b> واژه‌های این فصل را هم می‌توانی دوباره ببینی.</>}
            </span>
            <button type="button" className="btn-quiet shrink-0 px-3 text-xs" onClick={() => onOpenPrep(chapterId)}>واژه‌های این فصل</button>
          </div>
        )}

        <div className="reading-guidance mt-4">
          واژه‌ها را قبلاً یاد گرفته‌ای. اینجا داستان را بخوان؛ برای دیدن معنی هر واژه آن را لمس کن.
        </div>

        {resumedReading && (
          <div className="prep-resume-row mt-3" role="status">
            <span>آزمون درک مطلب این فصل بازیابی شد؛ پاسخ‌های قبلی دوباره ثبت نمی‌شوند.</span>
          </div>
        )}

        {wasAlreadyDone && !finished && (
          <div className="paper-note mt-4" role="status">
            این فصل را قبلاً تمام کرده‌ای. بازخوانی برای روان‌خوانی و درک بهتر مفید است، اما تسلط پایدار همچنان از مرور فاصله‌دار می‌آید.
          </div>
        )}

        <article className="story-reading mt-5" aria-labelledby="story-title">
          <h2 id="story-title" className="sr-only">{chapter.titleEn}</h2>
          <div className="space-y-4">
            {paragraphs.map((indices, paragraphIndex) => (
              <section key={paragraphIndex} className="story-paragraph" aria-label={`بخش ${faNum(paragraphIndex + 1)}`}>
                {indices.map(index => {
                  const sentence = chapter.sentences[index]
                  return (
                    <div
                      key={index}
                      data-story-index={index}
                      className={`story-line ${playIdx === index ? 'is-playing' : ''}`}
                    >
                      <SentenceRow
                        en={sentence.en}
                        fa={sentence.fa}
                        showFa={state.showFaDefault || openFa.has(index)}
                        isPlaying={playIdx === index}
                        soundOn={state.soundOn}
                        onToggleFa={() => toggleFa(index)}
                        onPlay={() => {
                          setPlayAll(false)
                          playAt(index, false)
                        }}
                        onWordTap={tapWord}
                      />
                    </div>
                  )
                })}
              </section>
            ))}
          </div>
        </article>

        <section className="mt-8" aria-labelledby="comprehension-title">
          <hr className="dash-line" />
          <div className="mt-4 flex items-start justify-between gap-3">
            <div>
              <h2 id="comprehension-title" className="text-xl font-extrabold">درک مطلب</h2>
              <p className="mt-1 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
                ۱۰ سؤال از همین قصه. پاسخ‌های اشتباه برای اصلاح برمی‌گردند.
              </p>
            </div>
            <span className="mastery-chip">
              {correctionMode ? 'اصلاح · ' : ''}{faNum(checksCorrect)} / {faNum(questions.length)} درست
            </span>
          </div>

          <div
            className="mastery-progress mt-3"
            role="progressbar"
            aria-label="پاسخ‌های تأییدشدهٔ درک مطلب"
            aria-valuemin={0}
            aria-valuemax={questions.length}
            aria-valuenow={checksCorrect}
            aria-valuetext={`${faNum(checksCorrect)} از ${faNum(questions.length)}`}
          >
            <span style={{ width: `${(checksCorrect / questions.length) * 100}%` }} />
          </div>

          {correctionMode && !finished && (
            <div className="paper-note mt-3" role="status">
              پاسخ‌های درستت حفظ شده‌اند. فقط سؤال‌های از‌دست‌رفته را اصلاح می‌کنی؛ امتیاز مرحلهٔ اول برای گزارش واقعی یادگیری نگه داشته می‌شود.
            </div>
          )}

          {explore && !finished && (
            <nav className="question-jump mt-4" aria-label="پرش به سؤال‌ها">
              {questions.map((question, index) => {
                const chosen = answers[index]
                const mark = chosen === undefined ? '' : chosen === question.answerId ? 'right' : 'wrong'
                return (
                  <button
                    key={index}
                    type="button"
                    className={`question-jump-button ${mark} ${index === checkIndex ? 'active' : ''}`}
                    aria-label={`سؤال ${faNum(index + 1)}`}
                    aria-current={index === checkIndex ? 'step' : undefined}
                    onClick={() => jumpToQuestion(index)}
                  >
                    {faNum(index + 1)}
                  </button>
                )
              })}
            </nav>
          )}

          {currentQuestion && !finished && (
            <div ref={questionRef} className="paper-card question-card mt-4 p-4 sm:p-5">
              <div className="text-xs font-extrabold" style={{ color: 'var(--crimson-deep)' }}>
                سؤال {faNum(checkIndex + 1)} از {faNum(questions.length)}
              </div>
              <h3 ref={questionHeadingRef} tabIndex={-1} className="mt-2 font-en text-lg font-bold leading-8" dir="ltr">{currentQuestion.prompt}</h3>
              {currentQuestion.promptHintFa && (
                <div className="mt-1 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>{currentQuestion.promptHintFa}</div>
              )}
              {currentQuestion.context && (
                <div
                  className="question-context mt-3"
                  dir={currentQuestion.contextDir ?? 'rtl'}
                >
                  {currentQuestion.context}
                </div>
              )}

              <div
                data-testid="comprehension-options"
                className={`mt-4 grid gap-2 ${currentQuestion.options.every(option => option.label.length <= 24) ? 'grid-cols-2' : 'grid-cols-1'}`}
                dir={currentQuestion.optionDir}
              >
                {currentQuestion.options.map(option => {
                  const isAnswer = option.id === currentQuestion.answerId
                  const chosen = currentAnswer === option.id
                  let className = `btn-paper min-h-12 px-3 py-3 text-sm leading-6 ${currentQuestion.optionDir === 'ltr' ? 'font-en' : ''}`
                  if (currentAnswer !== undefined && isAnswer) className += ' answer-correct'
                  else if (currentAnswer !== undefined && chosen) className += ' answer-wrong'
                  return (
                    <button
                      type="button"
                      key={option.id}
                      className={className}
                      disabled={currentAnswer !== undefined}
                      onClick={() => answer(checkIndex, option.id)}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>

              {currentAnswer !== undefined && (
                <div
                  className={`feedback-panel mt-4 p-3 text-sm leading-7 ${currentAnswer === currentQuestion.answerId ? 'feedback-correct' : 'feedback-wrong'}`}
                  role="status"
                >
                  {currentAnswer === currentQuestion.answerId
                    ? 'درست است.'
                    : <>پاسخ درست: <span dir={currentQuestion.optionDir} className={currentQuestion.optionDir === 'ltr' ? 'font-en' : ''}>{currentCorrectLabel}</span></>}
                </div>
              )}

              {currentAnswer !== undefined && correctionMode && currentAnswer !== currentQuestion.answerId && (
                <button ref={followUpRef} type="button" className="btn-ink mt-4 w-full py-3" onClick={retryCurrentCorrection}>
                  دوباره پاسخ بده
                </button>
              )}

              {currentAnswer !== undefined
                && (!correctionMode || currentAnswer === currentQuestion.answerId)
                && nextUnansweredIndex() >= 0 && (
                <button ref={followUpRef} type="button" className="btn-ink mt-4 w-full py-3" onClick={continueQuestion}>
                  سؤال بعدی ←
                </button>
              )}
            </div>
          )}
        </section>

        <div className="mt-6">
          {checksAnswered === questions.length && checksCorrect < questions.length && !correctionMode && !finished && (
            <button ref={followUpRef} type="button" className="btn-crimson w-full py-3.5 text-lg" onClick={beginCorrectionRound}>
              اصلاح {faNum(questions.length - checksCorrect)} پاسخ اشتباه
            </button>
          )}
        </div>

        {showListening && (
          <section className="mt-8" aria-labelledby="listening-title" data-testid="chapter-listening">
            <hr className="dash-line" />
            <div className="mt-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="listening-title" className="text-xl font-extrabold">درک مطلب شنیداری</h2>
                <p className="mt-1 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
                  یک متن تازه را فقط می‌شنوی. بعد به {faNum(listeningText.questions.length)} سؤال پاسخ بده؛ پاسخ‌های اشتباه را اصلاح می‌کنی.
                </p>
              </div>
              <span className="mastery-chip">{faNum(listeningConfirmed)} / {faNum(listeningText.questions.length)} درست</span>
            </div>

            {explore && !readingDone && (
              <div className="explore-note mt-3" role="status">
                <span>در حالت کاوش این بخش پیش از پایان درک مطلب خواندنی هم باز است.</span>
              </div>
            )}

            {!state.soundOn ? <SoundOffNote onEnable={() => onChange({ ...state, soundOn: true })} /> : (
              <ListeningPlayer
                player={listeningControls}
                text={listeningText}
                heard={listening.heard}
                buttonRef={readingDone && !listeningDone ? followUpRef : undefined}
                testId="chapter-listening-player"
              />
            )}

            <Questions
              text={listeningText}
              prefix="chapter-listening"
              chosen={listening.answers}
              disabled={!listening.heard || finished}
              locked={listening.locked}
              rejected={listening.rejected}
              onChoose={chooseListening}
            />

            {listening.firstPassCorrect !== undefined && !listeningDone && (
              <div ref={listeningNoteRef} tabIndex={-1} className="paper-note mt-4" role="status">
                پاسخ‌های درستت حفظ شده‌اند. {faNum(listeningText.questions.length - listeningConfirmed)} سؤال هنوز درست نشده است؛ متن را دوباره گوش کن و پاسخ دیگری انتخاب کن.
              </div>
            )}

            {!listeningDone && (
              <button type="button" className="btn-ink mt-5 w-full py-3" disabled={!listeningReady} onClick={checkListening}>
                بررسی پاسخ‌ها
              </button>
            )}

            {listeningDone && (
              <details className="test-review-details mt-5">
                <summary>متن شنیداری و ترجمه‌اش</summary>
                <h3 className="mt-3 font-en text-base font-bold" dir="ltr">{listeningText.titleEn}</h3>
                <Passage text={listeningText} showTranslation />
              </details>
            )}
          </section>
        )}

        <div className="mt-6">
          {chapterDone && !finished && preview && (
            <div className="explore-note" role="status">
              <span>همهٔ پاسخ‌ها درست است. این پیش‌نمایش ثبت نمی‌شود؛ برای ثبت فصل، از آموزش واژه‌ها شروع کن.</span>
              <button type="button" className="btn-quiet shrink-0 px-3 text-xs" onClick={() => onOpenPrep(chapterId)}>آموزش واژه‌ها</button>
            </div>
          )}

          {chapterDone && !finished && !preview && (
            <button ref={followUpRef} type="button" className="btn-crimson pop w-full py-3.5 text-lg" onClick={finishChapter}>
              {wasAlreadyDone ? 'ثبت بازخوانی' : 'پایان فصل'} — درک مطلب خواندنی و شنیداری کامل شد
            </button>
          )}

          {finished && (
            <div className="paper-card p-5 text-center" role="status">
              <BadgeCheckIcon className="mx-auto h-9 w-9" aria-hidden="true" />
              <div className="mt-2 font-extrabold">{wasAlreadyDone ? 'بازخوانی ثبت شد' : 'فصل تمام شد'}</div>
              <p className="mt-1 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
                {isLastOfBook
                  ? `این کتاب تمام شد و واژه‌هایش وارد مرور فاصله‌دار شده‌اند. برای بازشدن مرحلهٔ بعد، آزمون پایان کتاب ${faNum(chapter.book)} را بگذران: واژه‌های ${chapter.book === 1 ? 'این کتاب' : 'همهٔ کتاب‌ها تا اینجا'} و دو متن تازه برای درک مطلب خواندنی و شنیداری.`
                  : next ? `واژه‌های این فصل برای مرور فاصله‌دار برنامه‌ریزی شدند. پیش از فصل بعد، واژه‌های تازهٔ «${next.titleFa}» را آماده می‌کنی.` : ''}
              </p>
              <div className="mt-4 flex gap-2">
                <button type="button" className="btn-paper flex-1 py-2.5" onClick={onBack}>نقشه</button>
                {next && canOpenNext && (
                  <button type="button" className="btn-ink flex-1 py-2.5" onClick={() => onOpenChapter(next.id)}>
                    آمادگی فصل بعد ←
                  </button>
                )}
                {isLastOfBook && (
                  <button type="button" className="btn-crimson flex-1 py-2.5" onClick={() => onOpenExam(bookExamId(chapter.book))}>
                    آزمون پایان کتاب ←
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <GlossSheet
        word={gloss}
        soundOn={state.soundOn}
        narratorVoiceURI={state.narratorVoiceURI}
        narratorRate={state.narratorRate}
        onClose={() => setGloss(null)}
      />
    </div>
  )
}
