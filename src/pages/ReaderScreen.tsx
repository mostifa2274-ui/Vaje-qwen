import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GhesseState, WordEntry } from '../engine/types'
import { BOOKS, CHAPTERS, CHAPTER_BY_ID, WORD_BY_ID, nextChapter } from '../data/chapters'
import { sentenceSrc, stopAudio } from '../engine/audio'
import { cancelEnglishSpeech, speakEnglish } from '../engine/narration'
import { buildReadingQuestions } from '../engine/comprehension'
import { recordCompletedRead } from '../engine/progress'
import { blankWordProgress } from '../engine/review'
import { bookExamId } from '../engine/gates'
import SentenceRow from '../components/SentenceRow'
import GlossSheet from '../components/GlossSheet'
import staleSentenceAudioJson from '../data/staleSentenceAudio.json'
import { BackIcon, PauseIcon, PlayIcon } from '../components/Icons'
import { clearReadingDraft, loadReadingDraft, readingQuestionSignature, saveReadingDraft } from '../engine/readingDraft'

interface Props {
  chapterId: string
  state: GhesseState
  onChange: (next: GhesseState) => void
  onBack: () => void
  onOpenChapter: (id: string) => void
  onOpenExam: (id: string) => void
}

const STALE_SENTENCE_AUDIO = new Set(staleSentenceAudioJson as string[])

function faNum(n: number): string {
  return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])
}

function wallClockNow(): number {
  return Date.now()
}

export default function ReaderScreen({ chapterId, state, onChange, onBack, onOpenChapter, onOpenExam }: Props) {
  const chapter = CHAPTER_BY_ID.get(chapterId)!
  const meta = BOOKS.find(book => book.book === chapter.book)!
  const questions = useMemo(() => buildReadingQuestions(chapter, WORD_BY_ID, CHAPTERS), [chapter])
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

  const [initialReadingDraft] = useState(() => loadReadingDraft(chapterId, questions))
  const [resumedReading, setResumedReading] = useState(Boolean(initialReadingDraft))
  const [openFa, setOpenFa] = useState<Set<number>>(new Set())
  const [gloss, setGloss] = useState<WordEntry | null>(null)
  const [playIdx, setPlayIdx] = useState(-1)
  const [playAll, setPlayAll] = useState(false)
  const [answers, setAnswers] = useState<Record<number, string>>(() => initialReadingDraft?.answers ?? {})
  const [checkIndex, setCheckIndex] = useState(() => initialReadingDraft?.checkIndex ?? 0)
  const [finished, setFinished] = useState(false)
  const [audioNotice, setAudioNotice] = useState('')
  const [coverFailed, setCoverFailed] = useState(false)
  const readerAudioRef = useRef<HTMLAudioElement | null>(null)
  const playbackToken = useRef(0)
  const clockRef = useRef(wallClockNow)
  const questionRef = useRef<HTMLDivElement>(null)

  const stopReaderAudio = useCallback(() => {
    playbackToken.current++
    const audio = readerAudioRef.current
    if (audio) {
      audio.onended = null
      audio.onerror = null
      audio.pause()
    }
    cancelEnglishSpeech()
    setPlayAll(false)
    setPlayIdx(-1)
  }, [])

  const previousProgress = state.chapters[chapterId]
  const alreadyDone = previousProgress?.completed === true
  const checksAnswered = Object.keys(answers).length
  const checksCorrect = questions.filter((question, index) => answers[index] === question.answerId).length
  const currentQuestion = questions[Math.min(checkIndex, questions.length - 1)]
  const currentAnswer = answers[checkIndex]
  const currentCorrectLabel = currentQuestion?.options.find(option => option.id === currentQuestion.answerId)?.label ?? ''
  const next = nextChapter(chapterId)
  const canOpenNext = !!next && next.book === chapter.book
  const isLastOfBook = !next || next.book !== chapter.book

  useEffect(() => () => {
    playbackToken.current++
    readerAudioRef.current?.pause()
    stopAudio()
    cancelEnglishSpeech()
  }, [])

  useEffect(() => {
    if (checkIndex > 0) questionRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }, [checkIndex])

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
      updatedAt: Date.now(),
    }, questions)
  }, [answers, chapterId, checkIndex, finished, questions])

  function playAt(index: number, chain: boolean) {
    if (!state.soundOn || index < 0 || index >= chapter.sentences.length) {
      stopReaderAudio()
      return
    }

    stopAudio()
    const token = ++playbackToken.current
    readerAudioRef.current?.pause()
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

    const playBundledFallback = () => {
      if (playbackToken.current !== token) return
      if (STALE_SENTENCE_AUDIO.has(`${chapterId}:${index}`)) {
        setAudioNotice('برای این جمله فقط صدای زندهٔ انگلیسی دستگاه استفاده می‌شود؛ نسخهٔ صوتی قدیمی عمداً پخش نشد.')
        done()
        return
      }
      setAudioNotice('')
      const audio = readerAudioRef.current ?? new Audio()
      readerAudioRef.current = audio
      audio.src = sentenceSrc(chapterId, index)
      audio.currentTime = 0
      audio.onended = done
      audio.onerror = () => {
        setAudioNotice('موتور گفتار انگلیسی دستگاه در دسترس نیست. صدای انگلیسی Chrome یا سیستم را فعال کن.')
        done()
      }
      void audio.play().catch(() => {
        setAudioNotice('پخش صدا توسط مرورگر متوقف شد. یک‌بار روی دکمهٔ صدا بزن و دوباره امتحان کن.')
        done()
      })
    }

    setAudioNotice('')
    const started = speakEnglish(
      chapter.sentences[index].en,
      state.narratorVoiceURI,
      state.narratorRate,
      done,
      playBundledFallback,
    )
    if (!started) playBundledFallback()
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
    if (word?.introduced) {
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
      updatedAt: Date.now(),
    }, questions)
    setAnswers(nextAnswers)

    if (!question.evidenceWordId) return
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

  function continueQuestion() {
    if (currentAnswer === undefined || checkIndex >= questions.length - 1) return
    if (resumedReading) setResumedReading(false)
    setCheckIndex(index => index + 1)
  }

  function finishChapter() {
    const successor = nextChapter(chapterId)
    const nextState = recordCompletedRead(
      state,
      chapterId,
      chapter.new,
      checksCorrect,
      questions.length,
      clockRef.current(),
      CHAPTERS.map(item => item.id),
      successor?.book === chapter.book ? successor.id : undefined,
    )
    clearReadingDraft(chapterId)
    setFinished(true)
    onChange(nextState)
  }

  return (
    <div className="page-in" style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <div className="sticky top-0 z-40" style={{ background: meta.tint, borderBottom: '1px solid var(--line-medium)' }}>
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

      <main className="mx-auto max-w-3xl px-4 pb-32">
        {audioNotice && <div className="paper-note mt-4" role="status">{audioNotice}</div>}

        <section className="lesson-cover-card mt-4 overflow-hidden" style={{ background: meta.tint }}>
          {!coverFailed ? (
            <img
              src={meta.cover}
              alt={`تصویر کتاب ${meta.book}: ${meta.titleFa}`}
              className="lesson-cover-image"
              loading="eager"
              onError={() => setCoverFailed(true)}
            />
          ) : (
            <div className="lesson-cover-fallback" role="img" aria-label={meta.titleFa}>
              <span aria-hidden="true">🐈‍⬛</span>
              <strong>{meta.titleFa}</strong>
            </div>
          )}
          <div className="lesson-cover-copy">
            <div className="min-w-0">
              <div className="font-en text-xs font-bold uppercase tracking-[0.16em]" dir="ltr">{meta.titleEn}</div>
              <h2 className="mt-1 text-xl font-extrabold">{chapter.titleFa}</h2>
              <div className="mt-1 font-en text-sm" dir="ltr">{chapter.titleEn}</div>
            </div>
            <div className="shrink-0 text-left text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
              <div>{faNum(chapter.sentences.length)} جمله</div>
              <div>حدود {faNum(readingMinutes)} دقیقه</div>
            </div>
          </div>
        </section>

        <div className="reading-guidance mt-4">
          واژه‌های تازه را قبل از ورود به قصه یاد گرفته و آزمون داده‌ای. اینجا روی <b>فهم داستان</b> تمرکز کن؛ هر واژه را هم می‌توانی برای دیدن معنی لمس کنی.
        </div>

        {resumedReading && (
          <div className="prep-resume-row mt-3" role="status">
            <span>آزمون درک مطلب این فصل بازیابی شد؛ پاسخ‌های قبلی دوباره ثبت نمی‌شوند.</span>
          </div>
        )}

        {alreadyDone && !finished && (
          <div className="paper-note mt-4" role="status">
            این فصل را قبلاً تمام کرده‌ای. بازخوانی برای روان‌خوانی و درک بهتر مفید است، اما تسلط پایدار همچنان از مرور فاصله‌دار می‌آید.
          </div>
        )}

        <article className="story-reading mt-5" aria-labelledby="story-title">
          <div className="story-reading-header">
            <div>
              <h2 id="story-title" className="font-en text-2xl font-bold" dir="ltr">{chapter.titleEn}</h2>
              <div className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>{chapter.titleFa}</div>
            </div>
            <span className="mastery-chip">{faNum(paragraphs.length)} بخش</span>
          </div>

          <div className="mt-4 space-y-4">
            {paragraphs.map((indices, paragraphIndex) => (
              <section key={paragraphIndex} className="story-paragraph" aria-label={`بخش ${faNum(paragraphIndex + 1)}`}>
                {indices.map(index => {
                  const sentence = chapter.sentences[index]
                  return (
                    <div key={index} className={`story-line ${playIdx === index ? 'is-playing' : ''}`}>
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
                ۱۰ سؤال از خود همین قصه: جزئیات، معنی جمله و ترتیب اتفاق‌ها.
              </p>
            </div>
            <span className="mastery-chip">{faNum(Math.min(checkIndex + 1, questions.length))} / {faNum(questions.length)}</span>
          </div>

          <div className="mastery-progress mt-3">
            <span style={{ width: `${(checksAnswered / questions.length) * 100}%` }} />
          </div>

          {currentQuestion && !finished && (
            <div ref={questionRef} className="paper-card question-card mt-4 p-4 sm:p-5">
              <div className="text-xs font-extrabold" style={{ color: 'var(--crimson-deep)' }}>
                سؤال {faNum(checkIndex + 1)} از {faNum(questions.length)}
              </div>
              <h3 className="mt-2 text-base font-extrabold leading-8">{currentQuestion.prompt}</h3>
              {currentQuestion.context && (
                <div
                  className="question-context mt-3"
                  dir={currentQuestion.contextDir ?? 'rtl'}
                >
                  {currentQuestion.context}
                </div>
              )}

              <div
                className={`mt-4 grid gap-2 ${currentQuestion.options.every(option => option.label.length <= 24) ? 'grid-cols-2' : 'grid-cols-1'}`}
                dir={currentQuestion.optionDir}
              >
                {currentQuestion.options.map(option => {
                  const isAnswer = option.id === currentQuestion.answerId
                  const chosen = currentAnswer === option.id
                  let className = 'btn-paper min-h-12 px-3 py-3 text-sm leading-6'
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

              {currentAnswer !== undefined && checkIndex < questions.length - 1 && (
                <button type="button" className="btn-ink mt-4 w-full py-3" onClick={continueQuestion}>
                  سؤال بعدی ←
                </button>
              )}
            </div>
          )}
        </section>

        <div className="mt-6">
          {checksAnswered === questions.length && !finished && (
            <button type="button" className="btn-crimson pop w-full py-3.5 text-lg" onClick={finishChapter}>
              {alreadyDone ? 'ثبت بازخوانی' : 'پایان فصل'} — {faNum(checksCorrect)} از {faNum(questions.length)} درست
            </button>
          )}

          {finished && (
            <div className="paper-card p-5 text-center" role="status">
              <div className="text-4xl" aria-hidden="true">🐈‍⬛</div>
              <div className="mt-2 font-extrabold">{alreadyDone ? 'بازخوانی ثبت شد' : 'فصل تمام شد'}</div>
              <p className="mt-1 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
                {isLastOfBook
                  ? `این کتاب تمام شد. واژه‌هایش وارد مرور فاصله‌دار شده‌اند؛ برای بازشدن مرحلهٔ بعد، آزمون کتاب ${faNum(chapter.book)} را بگذران.`
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
                    آزمون کتاب ←
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

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
