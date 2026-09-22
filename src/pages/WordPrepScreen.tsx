import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BOOKS, CHAPTER_BY_ID, VOCAB, WORD_BY_ID } from '../data/chapters'
import type { GhesseState, WordEntry } from '../engine/types'
import { buildReviewQuestion } from '../engine/review'
import { chapterPrepared } from '../engine/gates'
import { recordPreparedChapter } from '../engine/progress'
import { speakEnglishWithFallback } from '../engine/narration'
import { wordSrc } from '../engine/audio'
import { BackIcon, SpeakerIcon } from '../components/Icons'
import { clearPrepDraft, loadPrepDraft, savePrepDraft, type PrepFeedback, type PrepPhase } from '../engine/prepDraft'

interface Props {
  chapterId: string
  state: GhesseState
  onChange: (next: GhesseState) => void
  onBack: () => void
  onReady: () => void
}

function faNum(n: number): string {
  return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])
}

function normalizeFaAnswer(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u200c/g, ' ')
    .replace(/[‐‑‒–—−-]/g, ' ')
    .replace(/[،,؛;:!?؟."“”'()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function acceptedFaAnswers(word: WordEntry): string[] {
  const alternatives = word.fa
    .split(/[؛;،,/]/)
    .map(normalizeFaAnswer)
    .filter(Boolean)
  const full = normalizeFaAnswer(word.fa)
  return [...new Set([full, ...alternatives].filter(Boolean))]
}

function isFaTranslationCorrect(input: string, word: WordEntry): boolean {
  return acceptedFaAnswers(word).includes(normalizeFaAnswer(input))
}

export default function WordPrepScreen({ chapterId, state, onChange, onBack, onReady }: Props) {
  const chapter = CHAPTER_BY_ID.get(chapterId)!
  const meta = BOOKS.find(book => book.book === chapter.book)!
  const alreadyPrepared = chapterPrepared(state, chapterId)

  const [initialDraft] = useState(() => alreadyPrepared ? undefined : loadPrepDraft(chapterId, chapter.new))
  const [resumedDraft, setResumedDraft] = useState(Boolean(initialDraft))
  const [phase, setPhase] = useState<PrepPhase>(() => initialDraft?.phase ?? 'teach')
  const [teachIndex, setTeachIndex] = useState(() => initialDraft?.teachIndex ?? 0)

  const [writtenQueue, setWrittenQueue] = useState<string[]>(() => initialDraft?.writtenQueue ?? [...chapter.new])
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
  const stageRef = useRef<HTMLDivElement>(null)
  const hasMountedRef = useRef(false)

  const currentTeachId = chapter.new[teachIndex]
  const currentTeachWord = currentTeachId ? WORD_BY_ID.get(currentTeachId) : undefined

  const currentWrittenId = writtenQueue[0]
  const currentWrittenWord = currentWrittenId ? WORD_BY_ID.get(currentWrittenId) : undefined

  const currentListeningId = listeningQueue[0]
  const currentListeningWord = currentListeningId ? WORD_BY_ID.get(currentListeningId) : undefined
  const listeningQuestion = useMemo(
    () => currentListeningWord
      ? buildReviewQuestion(
          currentListeningWord,
          VOCAB,
          'reverse',
          `${chapterId}:prep-listening:${listeningPassed.size}:${listeningQueue.length}:${currentListeningId}`,
        )
      : undefined,
    [chapterId, currentListeningId, currentListeningWord, listeningPassed.size, listeningQueue.length],
  )

  const speak = useCallback((word: string, id: string, unlockListening = false) => {
    if (!state.soundOn) return
    const unavailable = () => {
      if (unlockListening) setListeningReady(false)
      setAudioBlocked(true)
      setAudioNotice('پخش تلفظ انگلیسی روی این دستگاه در دسترس نیست. صدای English Text-to-Speech مرورگر یا سیستم را فعال کن و دوباره «پخش» را بزن.')
    }
    const ended = () => {
      if (unlockListening) setListeningReady(true)
      setAudioBlocked(false)
      setAudioNotice('')
    }
    const started = speakEnglishWithFallback(
      word,
      state.narratorVoiceURI,
      state.narratorRate,
      wordSrc(id),
      ended,
      unavailable,
    )
    if (!started) unavailable()
  }, [state.narratorRate, state.narratorVoiceURI, state.soundOn])

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
      speak(word.word, word.id, phase === 'listening')
    }, 90)
    return () => window.clearTimeout(timer)
  }, [currentListeningWord, currentTeachWord, phase, speak, state.soundOn])

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    stageRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }, [phase, teachIndex, currentWrittenId, currentListeningId])

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
    setWrittenQueue([...chapter.new])
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
  }

  function continueTeach() {
    if (!currentTeachWord) return
    if (teachIndex + 1 < chapter.new.length) {
      setTeachIndex(index => index + 1)
      return
    }
    setWrittenQueue([...chapter.new])
    setWrittenPassed(new Set())
    setWrittenMissed(new Set())
    setTyped('')
    setFeedback(null)
    setPhase('written')
  }

  function submitWritten() {
    if (!currentWrittenWord || !currentWrittenId || !typed.trim() || feedback) return
    const correct = isFaTranslationCorrect(typed, currentWrittenWord)
    if (!correct) setWrittenMissed(previous => new Set(previous).add(currentWrittenId))
    setFeedback(correct ? 'correct' : 'wrong')
  }

  function dontKnowWritten() {
    if (!currentWrittenId || feedback) return
    setWrittenMissed(previous => new Set(previous).add(currentWrittenId))
    setTyped('')
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
      setListeningQueue([...chapter.new])
      setListeningPassed(new Set())
      setListeningMissed(new Set())
      setSelected('')
      setListeningReady(false)
      setPhase('listening')
    }
  }

  function chooseListening(optionId: string) {
    if (!listeningQuestion || !currentListeningId || feedback || !state.soundOn || audioBlocked || !listeningReady) return
    const correct = optionId === listeningQuestion.answerId
    setSelected(optionId)
    if (!correct) setListeningMissed(previous => new Set(previous).add(currentListeningId))
    setFeedback(correct ? 'correct' : 'wrong')
  }

  function dontKnowListening() {
    if (!currentListeningId || feedback || !state.soundOn || audioBlocked || !listeningReady) return
    setSelected('')
    setListeningMissed(previous => new Set(previous).add(currentListeningId))
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
    setFeedback(null)
    setSelected('')
    setListeningReady(false)

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
      onChange(nextState)
      onReady()
    }
  }

  const step = phase === 'teach' ? 1 : phase === 'written' ? 2 : 3

  return (
    <div className="page-in min-h-screen" style={{ background: 'var(--cream)' }}>
      <header className="sticky top-0 z-40" style={{ background: meta.tint, borderBottom: '1px solid var(--line-medium)' }}>
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <button type="button" className="btn-paper reader-header-button" onClick={onBack} aria-label="بازگشت به نقشه"><BackIcon className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1">
            <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>آمادگی فصل {faNum(chapter.n)} · کتاب {faNum(chapter.book)}</div>
            <h1 className="truncate text-lg font-extrabold">واژه‌های تازه: {chapter.titleFa}</h1>
          </div>
          <span className="mastery-chip">{faNum(chapter.new.length)} واژه</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-28 pt-5">
        {alreadyPrepared && phase === 'teach' && (
          <div className="paper-note mb-4">
            این فصل قبلاً آزمون نوشتاری و شنیداری را با پوشش ۱۰۰٪ گذرانده است.
            <button type="button" className="btn-ink mt-3 w-full py-2.5" onClick={onReady}>ورود مستقیم به قصه ←</button>
          </div>
        )}

        <div className="prep-stepper" aria-label="مرحله‌های آمادگی">
          {['آموزش', 'ترجمهٔ نوشتاری', 'شنیداری', 'قصه'].map((label, index) => (
            <span key={label} className={step === index + 1 ? 'active' : step > index + 1 ? 'done' : ''}>
              {faNum(index + 1)}. {label}
            </span>
          ))}
        </div>

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
            <div className="flex items-center justify-between text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>
              <span>فقط یاد بگیر؛ این بخش آزمون نیست</span>
              <span>{faNum(teachIndex + 1)} / {faNum(chapter.new.length)}</span>
            </div>
            <div className="mastery-progress mt-3">
              <span style={{ width: `${((teachIndex + 1) / chapter.new.length) * 100}%` }} />
            </div>

            {!state.soundOn && (
              <div className="paper-note mt-4">
                برای تلفظ خودکار، صدا باید روشن باشد.
                <button type="button" className="btn-ink mt-2 w-full py-2.5" onClick={enableSound}>روشن کردن صدا</button>
              </div>
            )}

            <div className="mt-7 text-center">
              <div className="font-en text-4xl font-bold" dir="ltr">{currentTeachWord.word}</div>
              {currentTeachWord.ipa && <div className="mt-2 font-en text-sm" dir="ltr">/ {currentTeachWord.ipa} /</div>}
              <div className="mt-4 text-3xl font-extrabold">{currentTeachWord.fa}</div>
              <button
                type="button"
                className="btn-paper mt-4 px-4 py-2.5 text-sm"
                onClick={() => speak(currentTeachWord.word, currentTeachWord.id)}
                disabled={!state.soundOn}
                aria-label={`پخش تلفظ ${currentTeachWord.word}`}
              >
                <span className="inline-flex items-center gap-2"><SpeakerIcon className="h-5 w-5" />پخش دوباره</span>
              </button>
            </div>

            <div className="learning-example mt-6 p-4">
              <div className="font-en text-lg leading-8" dir="ltr">{currentTeachWord.ex}</div>
              <div className="mt-2 text-sm leading-7" dir="rtl" style={{ color: 'var(--ink-soft)' }}>{currentTeachWord.tr}</div>
            </div>

            <button type="button" className="btn-ink mt-5 w-full py-3" onClick={continueTeach}>
              {teachIndex + 1 < chapter.new.length ? 'واژهٔ بعدی ←' : 'شروع آزمون ترجمهٔ نوشتاری ←'}
            </button>
          </div>
        )}

        {phase === 'written' && currentWrittenWord && (
          <div ref={stageRef} className="learning-focus-card mt-5 p-5 sm:p-6">
            <div className="flex items-center justify-between text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>
              <span>همهٔ واژه‌ها باید درست شوند — ۱۰۰٪</span>
              <span>{faNum(writtenPassed.size)} / {faNum(chapter.new.length)}</span>
            </div>
            <div className="mastery-progress mt-3">
              <span style={{ width: `${(writtenPassed.size / chapter.new.length) * 100}%` }} />
            </div>

            <div className="mt-7 text-center">
              <div className="text-sm" style={{ color: 'var(--ink-soft)' }}>یک معنی درست را به فارسی بنویس</div>
              <div className="mt-2 font-en text-4xl font-bold" dir="ltr">{currentWrittenWord.word}</div>
            </div>

            <label htmlFor="prep-written" className="mt-6 block text-sm font-bold">ترجمهٔ فارسی</label>
            <input
              id="prep-written"
              className="answer-input mt-2 w-full"
              dir="rtl"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              disabled={Boolean(feedback)}
              value={typed}
              onChange={event => setTyped(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') submitWritten() }}
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
                  ? 'درست. این واژه آزمون نوشتاری را گذراند.'
                  : <>معنی درست: <b>{currentWrittenWord.fa}</b>. این واژه دوباره در همین آزمون می‌آید.</>}
              </div>
            )}

            {feedback && (
              <button type="button" className="btn-ink mt-4 w-full py-3" onClick={continueWritten}>
                {feedback === 'wrong' ? 'ادامه و تکرار این واژه ←' : 'ادامه ←'}
              </button>
            )}
          </div>
        )}

        {phase === 'listening' && currentListeningWord && listeningQuestion && (
          <div ref={stageRef} className="learning-focus-card mt-5 p-5 sm:p-6">
            <div className="flex items-center justify-between text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>
              <span>فقط گوش کن؛ همهٔ واژه‌ها باید درست شوند — ۱۰۰٪</span>
              <span>{faNum(listeningPassed.size)} / {faNum(chapter.new.length)}</span>
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
                    onClick={() => { setListeningReady(false); speak(currentListeningWord.word, currentListeningWord.id, true) }}
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

                <div className="mt-6 grid grid-cols-2 gap-2" dir="rtl">
                  {listeningQuestion.options?.map(option => {
                    const isAnswer = option.id === listeningQuestion.answerId
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
                  ? <><b className="font-en" dir="ltr">{currentListeningWord.word}</b> — {currentListeningWord.fa} ✓</>
                  : <>پاسخ درست: <b className="font-en" dir="ltr">{currentListeningWord.word}</b> — {currentListeningWord.fa}. دوباره در همین آزمون می‌آید.</>}
              </div>
            )}

            {feedback && (
              <button type="button" className="btn-ink mt-4 w-full py-3" onClick={continueListening}>
                {feedback === 'wrong' ? 'ادامه و تکرار این واژه ←' : 'ادامه ←'}
              </button>
            )}
          </div>
        )}


      </main>
    </div>
  )
}
