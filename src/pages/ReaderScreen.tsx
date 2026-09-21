import { useEffect, useMemo, useRef, useState } from 'react'
import type { GhesseState, WordEntry } from '../engine/types'
import { BOOKS, CHAPTERS, CHAPTER_BY_ID, WORD_BY_ID, nextChapter } from '../data/chapters'
import { sentenceSrc, stopAudio } from '../engine/audio'
import { selectNarrationVoice } from '../engine/narration'
import { recordCompletedRead } from '../engine/progress'
import { blankWordProgress } from '../engine/review'
import { bookExamId } from '../engine/gates'
import SentenceRow from '../components/SentenceRow'
import GlossSheet from '../components/GlossSheet'
import staleSentenceAudioJson from '../data/staleSentenceAudio.json'

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


export default function ReaderScreen({ chapterId, state, onChange, onBack, onOpenChapter, onOpenExam }: Props) {
  const chapter = CHAPTER_BY_ID.get(chapterId)!
  const meta = BOOKS.find(book => book.book === chapter.book)!
  const newIds = useMemo(() => new Set(chapter.new), [chapter])

  const [openFa, setOpenFa] = useState<Set<number>>(new Set())
  const [gloss, setGloss] = useState<WordEntry | null>(null)
  const [playIdx, setPlayIdx] = useState(-1)
  const [playAll, setPlayAll] = useState(false)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [finished, setFinished] = useState(false)
  const [audioNotice, setAudioNotice] = useState('')
  const readerAudioRef = useRef<HTMLAudioElement | null>(null)
  const playbackToken = useRef(0)

  const previousProgress = state.chapters[chapterId]
  const alreadyDone = previousProgress?.completed === true
  const checksAnswered = Object.keys(answers).length
  const checksCorrect = chapter.check.filter((check, index) => answers[index] === check.a).length
  const next = nextChapter(chapterId)
  const canOpenNext = !!next && next.book === chapter.book
  const isLastOfBook = !next || next.book !== chapter.book

  // Every chapter is keyed in App, but reset explicitly as a second line of
  // defence if the screen is ever reused differently in the future.
  useEffect(() => {
    setOpenFa(new Set())
    setGloss(null)
    setAnswers({})
    setFinished(false)
    setAudioNotice('')
    stopReaderAudio()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId])

  useEffect(() => () => {
    playbackToken.current++
    readerAudioRef.current?.pause()
    stopAudio()
  }, [])

  function stopReaderAudio() {
    playbackToken.current++
    const audio = readerAudioRef.current
    if (audio) {
      audio.onended = null
      audio.onerror = null
      audio.pause()
    }
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    setPlayAll(false)
    setPlayIdx(-1)
  }

  function playAt(index: number, chain: boolean) {
    if (!state.soundOn || index < 0 || index >= chapter.sentences.length) {
      stopReaderAudio()
      return
    }

    stopAudio() // do not overlap a word/example clip with story narration
    const token = ++playbackToken.current
    readerAudioRef.current?.pause()
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
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
      // 606 sentences were editorially revised after the original MP3 set was
      // recorded. Never teach stale spoken English as a fallback.
      if (STALE_SENTENCE_AUDIO.has(`${chapterId}:${index}`)) {
        setAudioNotice('صدای این جمله در نسخهٔ ویرایش‌شده فقط با صدای انگلیسی دستگاه پخش می‌شود؛ فایل قدیمی عمداً پخش نشد.')
        done()
        return
      }
      setAudioNotice('')
      const audio = readerAudioRef.current ?? new Audio()
      readerAudioRef.current = audio
      audio.src = sentenceSrc(chapterId, index)
      audio.currentTime = 0
      audio.onended = done
      audio.onerror = done
      void audio.play().catch(done)
    }

    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
      playBundledFallback()
      return
    }

    try {
      const utterance = new SpeechSynthesisUtterance(chapter.sentences[index].en)
      const voice = selectNarrationVoice(synth.getVoices(), state.narratorVoiceURI)
      if (voice) {
        utterance.voice = voice
        utterance.lang = voice.lang
      } else {
        utterance.lang = 'en-US'
      }
      utterance.rate = state.narratorRate
      utterance.pitch = 1
      utterance.volume = 1
      utterance.onend = done
      utterance.onerror = () => playBundledFallback()
      synth.speak(utterance)
    } catch {
      playBundledFallback()
    }
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
    const checkpoint = chapter.check[questionIndex]
    const correct = optionId === checkpoint.a
    const now = Date.now()
    const nextWords = { ...state.words }
    const current = nextWords[checkpoint.a] ?? blankWordProgress(now)
    nextWords[checkpoint.a] = {
      ...current,
      checkCorrect: current.checkCorrect + (correct ? 1 : 0),
      checkWrong: current.checkWrong + (correct ? 0 : 1),
      lastCheckAt: now,
    }
    setAnswers(previous => ({ ...previous, [questionIndex]: optionId }))
    onChange({ ...state, words: nextWords })
  }

  function finishChapter() {
    const successor = nextChapter(chapterId)
    const nextState = recordCompletedRead(
      state,
      chapterId,
      chapter.new,
      checksCorrect,
      chapter.check.length,
      Date.now(),
      CHAPTERS.map(item => item.id),
      successor?.book === chapter.book ? successor.id : undefined,
    )
    setFinished(true)
    onChange(nextState)
  }

  return (
    <div className="page-in" style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <div className="sticky top-0 z-40" style={{ background: meta.tint, borderBottom: '2px solid var(--ink)' }}>
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <button type="button" className="btn-paper px-3 py-2 text-sm" onClick={onBack} aria-label="بازگشت به نقشه">
            →
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
            {playAll ? '⏸ توقف' : '▶ خواندن'}
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-lg px-4 pb-32">
        {audioNotice && <div className="paper-note mt-4" role="status">{audioNotice}</div>}
        <div className="paper-card-flat mt-4 overflow-hidden">
          <img src={meta.cover} alt={meta.titleFa} className="block h-44 w-full object-cover" loading="lazy" />
          <div className="px-4 py-3">
            <div className="text-xs font-bold" style={{ color: 'var(--crimson-deep)' }}>
              {faNum(chapter.new.length)} واژه‌ی تازه در این فصل
            </div>
            <div className="strip-scroll mt-2 flex gap-2 overflow-x-auto pb-1" dir="ltr">
              {chapter.new.map(id => {
                const word = WORD_BY_ID.get(id)
                if (!word) return null
                return (
                  <button type="button" key={id} className="btn-paper shrink-0 px-3 py-1.5" onClick={() => tapWord(id)}>
                    <span className="font-en font-semibold" dir="ltr">{word.word}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {alreadyDone && !finished && (
          <div className="paper-note mt-4" role="status">
            این فصل را قبلاً تمام کرده‌ای. بازخوانی به درک قصه و برخورد دوباره با واژه‌ها کمک می‌کند، اما به‌تنهایی سطح «مسلط» را بالا نمی‌برد؛ تسلط فقط از بازیابی فاصله‌دار می‌آید.
          </div>
        )}

        <div className="mt-5 space-y-4">
          {chapter.sentences.map((sentence, index) => (
            <div
              key={index}
              style={playIdx === index ? { background: 'rgba(217,164,65,0.25)', borderRadius: 10, padding: '4px 6px', margin: '-4px -6px' } : undefined}
            >
              <SentenceRow
                en={sentence.en}
                fa={sentence.fa}
                showFa={state.showFaDefault || openFa.has(index)}
                isPlaying={playIdx === index}
                soundOn={state.soundOn}
                newIds={newIds}
                onToggleFa={() => toggleFa(index)}
                onPlay={() => {
                  setPlayAll(false)
                  playAt(index, false)
                }}
                onWordTap={tapWord}
              />
            </div>
          ))}
        </div>

        <section className="mt-8" aria-labelledby="comprehension-title">
          <hr className="dash-line" />
          <h2 id="comprehension-title" className="mt-4 text-xl font-extrabold">بررسی درک</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
            بدون نگاه به ترجمه جواب بده. پاسخ اشتباه هم ثبت می‌شود تا میزان تسلط بیش‌برآورد نشود.
          </p>

          <div className="mt-4 space-y-5">
            {chapter.check.map((checkpoint, questionIndex) => {
              const answered = answers[questionIndex]
              return (
                <fieldset key={questionIndex} className="paper-card-flat p-4">
                  <legend className="px-1 font-bold">{checkpoint.q}</legend>
                  <div className="mt-3 grid grid-cols-2 gap-2" dir="ltr">
                    {checkpoint.options.map(option => {
                      const word = WORD_BY_ID.get(option)
                      const isAnswer = option === checkpoint.a
                      const chosen = answered === option
                      let style: React.CSSProperties = {}
                      if (answered) {
                        if (isAnswer) style = { background: 'var(--ink)', color: 'var(--cream)' }
                        else if (chosen) style = { background: 'var(--crimson)', color: '#fff' }
                        else style = { opacity: 0.55 }
                      }
                      return (
                        <button
                          type="button"
                          key={option}
                          className="btn-paper px-2 py-2.5"
                          style={style}
                          disabled={answered !== undefined}
                          onClick={() => answer(questionIndex, option)}
                        >
                          <span className="font-en font-semibold" dir="ltr">{word?.word ?? option}</span>
                          {answered && isAnswer && ' ✓'}
                          {answered && chosen && !isAnswer && ' ✗'}
                        </button>
                      )
                    })}
                  </div>
                  {answered && (
                    <div className="mt-2 text-xs" aria-live="polite" style={{ color: 'var(--ink-soft)' }}>
                      {answered === checkpoint.a ? 'درست بود.' : 'پاسخ درست مشخص شده است.'}
                    </div>
                  )}
                </fieldset>
              )
            })}
          </div>
        </section>

        <div className="mt-8">
          {checksAnswered === chapter.check.length && !finished && (
            <button type="button" className="btn-crimson pop w-full py-3.5 text-lg" onClick={finishChapter}>
              {alreadyDone ? 'ثبت بازخوانی' : 'پایان فصل'} — {faNum(checksCorrect)} از {faNum(chapter.check.length)} درست
            </button>
          )}

          {finished && (
            <div className="paper-card p-5 text-center" role="status">
              <div className="text-4xl" aria-hidden="true">🐈‍⬛</div>
              <div className="mt-2 font-extrabold">{alreadyDone ? 'بازخوانی ثبت شد' : 'فصل تمام شد'}</div>
              <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
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
