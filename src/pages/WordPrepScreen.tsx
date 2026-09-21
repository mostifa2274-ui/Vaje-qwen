import { useMemo, useState } from 'react'
import { BOOKS, CHAPTER_BY_ID, VOCAB, WORD_BY_ID } from '../data/chapters'
import type { GhesseState } from '../engine/types'
import { buildReviewQuestion, isTypedCorrect, seededSample } from '../engine/review'
import { recordPreparedChapter } from '../engine/progress'
import { speakEnglish } from '../engine/narration'
import { play, wordSrc } from '../engine/audio'

interface Props {
  chapterId: string
  state: GhesseState
  onChange: (next: GhesseState) => void
  onBack: () => void
  onReady: () => void
}

type Phase = 'pretest' | 'recognition' | 'productive' | 'done'

type Feedback = 'correct' | 'wrong' | null

function faNum(n: number): string {
  return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d])
}

export default function WordPrepScreen({ chapterId, state, onChange, onBack, onReady }: Props) {
  const chapter = CHAPTER_BY_ID.get(chapterId)!
  const meta = BOOKS.find(book => book.book === chapter.book)!
  const alreadyPrepared = Boolean(state.chapters[chapterId]?.preparedAt)

  const [phase, setPhase] = useState<Phase>('pretest')
  const [pretestIndex, setPretestIndex] = useState(0)
  const [pretestCorrect, setPretestCorrect] = useState(0)
  const [missedPretest, setMissedPretest] = useState<Set<string>>(new Set())
  const [pretestFeedback, setPretestFeedback] = useState<Feedback>(null)

  const [recognitionQueue, setRecognitionQueue] = useState<string[]>(() => [...chapter.new])
  const [attempted, setAttempted] = useState<Set<string>>(new Set())
  const [recognitionPassed, setRecognitionPassed] = useState<Set<string>>(new Set())
  const [missedRecognition, setMissedRecognition] = useState<Set<string>>(new Set())
  const [firstPassCorrect, setFirstPassCorrect] = useState(0)

  const [productiveQueue, setProductiveQueue] = useState<string[]>([])
  const [productiveTargetCount, setProductiveTargetCount] = useState(0)
  const [productivePassed, setProductivePassed] = useState<Set<string>>(new Set())
  const [missedProductive, setMissedProductive] = useState<Set<string>>(new Set())
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [selected, setSelected] = useState('')
  const [typed, setTyped] = useState('')

  const pretestId = chapter.new[pretestIndex]
  const pretestWord = pretestId ? WORD_BY_ID.get(pretestId) : undefined
  const pretestQuestion = useMemo(
    () => pretestWord
      ? buildReviewQuestion(pretestWord, VOCAB, 'reverse', `${chapterId}:pretest:${pretestIndex}:${pretestId}`)
      : undefined,
    [chapterId, pretestId, pretestIndex, pretestWord],
  )

  const currentRecognitionId = recognitionQueue[0]
  const currentRecognitionWord = currentRecognitionId ? WORD_BY_ID.get(currentRecognitionId) : undefined
  const recognitionQuestion = useMemo(
    () => currentRecognitionWord
      ? buildReviewQuestion(currentRecognitionWord, VOCAB, 'recognition', `${chapterId}:prep-recognition:${attempted.size}:${recognitionQueue.length}`)
      : undefined,
    [attempted.size, chapterId, currentRecognitionWord, recognitionQueue.length],
  )

  const currentProductiveId = productiveQueue[0]
  const currentProductiveWord = currentProductiveId ? WORD_BY_ID.get(currentProductiveId) : undefined

  function speak(word: string, id: string) {
    if (!state.soundOn) return
    if (!speakEnglish(word, state.narratorVoiceURI, state.narratorRate)) play(wordSrc(id), true)
  }

  function choosePretest(optionId: string) {
    if (!pretestQuestion || !pretestId || pretestFeedback) return
    const correct = optionId === pretestQuestion.answerId
    setPretestFeedback(correct ? 'correct' : 'wrong')
    if (correct) setPretestCorrect(value => value + 1)
    else setMissedPretest(previous => new Set(previous).add(pretestId))
  }

  function dontKnowPretest() {
    if (!pretestId || pretestFeedback) return
    setPretestFeedback('wrong')
    setMissedPretest(previous => new Set(previous).add(pretestId))
  }

  function continuePretest() {
    if (!pretestFeedback) return
    setPretestFeedback(null)
    if (pretestIndex + 1 < chapter.new.length) {
      setPretestIndex(index => index + 1)
      return
    }
    startRecognition()
  }

  function startRecognition() {
    setRecognitionQueue([...chapter.new])
    setAttempted(new Set())
    setRecognitionPassed(new Set())
    setMissedRecognition(new Set())
    setFirstPassCorrect(0)
    setFeedback(null)
    setSelected('')
    setPhase('recognition')
  }

  function chooseRecognition(optionId: string) {
    if (!recognitionQuestion || feedback || !currentRecognitionId) return
    const correct = optionId === recognitionQuestion.answerId
    setSelected(optionId)
    setFeedback(correct ? 'correct' : 'wrong')
    if (!attempted.has(currentRecognitionId)) {
      setAttempted(previous => new Set(previous).add(currentRecognitionId))
      if (correct) setFirstPassCorrect(value => value + 1)
      else setMissedRecognition(previous => new Set(previous).add(currentRecognitionId))
    }
  }

  function dontKnowRecognition() {
    if (!recognitionQuestion || feedback || !currentRecognitionId) return
    setSelected('')
    setFeedback('wrong')
    if (!attempted.has(currentRecognitionId)) {
      setAttempted(previous => new Set(previous).add(currentRecognitionId))
      setMissedRecognition(previous => new Set(previous).add(currentRecognitionId))
    }
  }

  function buildProductiveSet(): string[] {
    const mandatorySet = new Set([...missedPretest, ...missedRecognition])
    const minimum = Math.min(chapter.new.length, Math.max(6, Math.ceil(chapter.new.length * 0.4)))
    const mandatory = [...mandatorySet]
    if (mandatory.length >= minimum) return seededSample(mandatory, mandatory.length, `${chapterId}:prep-productive-order`)
    const extra = seededSample(
      chapter.new.filter(id => !mandatorySet.has(id)),
      minimum - mandatory.length,
      `${chapterId}:prep-productive-sample`,
    )
    return seededSample([...mandatory, ...extra], mandatory.length + extra.length, `${chapterId}:prep-productive-order`)
  }

  function continueRecognition() {
    if (!currentRecognitionId || !feedback) return
    const correct = feedback === 'correct'
    const nextPassed = new Set(recognitionPassed)
    if (correct) nextPassed.add(currentRecognitionId)
    const rest = recognitionQueue.slice(1)
    const nextQueue = correct ? rest : [...rest, currentRecognitionId]
    setRecognitionPassed(nextPassed)
    setRecognitionQueue(nextQueue)
    setFeedback(null)
    setSelected('')

    if (nextPassed.size === chapter.new.length) {
      const set = buildProductiveSet()
      setProductiveQueue(set)
      setProductiveTargetCount(set.length)
      setProductivePassed(new Set())
      setMissedProductive(new Set())
      setTyped('')
      setPhase('productive')
    }
  }

  function submitProductive() {
    if (!currentProductiveWord || !currentProductiveId || !typed.trim() || feedback) return
    const correct = isTypedCorrect(typed, currentProductiveWord)
    if (!correct) setMissedProductive(previous => new Set(previous).add(currentProductiveId))
    setFeedback(correct ? 'correct' : 'wrong')
  }

  function dontKnowProductive() {
    if (!currentProductiveId || feedback) return
    setMissedProductive(previous => new Set(previous).add(currentProductiveId))
    setTyped('')
    setFeedback('wrong')
  }

  function continueProductive() {
    if (!currentProductiveId || !feedback) return
    const correct = feedback === 'correct'
    const passed = new Set(productivePassed)
    if (correct) passed.add(currentProductiveId)
    const rest = productiveQueue.slice(1)
    const nextQueue = correct ? rest : [...rest, currentProductiveId]
    setProductivePassed(passed)
    setProductiveQueue(nextQueue)
    setFeedback(null)
    setTyped('')

    if (nextQueue.length === 0) {
      const nextState = recordPreparedChapter(
        state,
        chapterId,
        chapter.new,
        pretestCorrect,
        chapter.new.length,
        [...missedPretest],
        firstPassCorrect,
        passed.size,
        productiveTargetCount,
        [...missedRecognition],
        [...missedProductive],
        Date.now(),
      )
      onChange(nextState)
      setPhase('done')
    }
  }

  const step = phase === 'pretest' ? 1 : phase === 'recognition' ? 2 : phase === 'productive' ? 3 : 4

  return (
    <div className="page-in min-h-screen" style={{ background: 'var(--cream)' }}>
      <header className="sticky top-0 z-40" style={{ background: meta.tint, borderBottom: '2px solid var(--ink)' }}>
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <button type="button" className="btn-paper px-3 py-2 text-sm" onClick={onBack} aria-label="بازگشت به نقشه">→</button>
          <div className="min-w-0 flex-1">
            <div className="text-xs" style={{ color: 'var(--ink-soft)' }}>آمادگی فصل {faNum(chapter.n)} · کتاب {faNum(chapter.book)}</div>
            <h1 className="truncate text-lg font-extrabold">واژه‌های تازه: {chapter.titleFa}</h1>
          </div>
          <span className="mastery-chip">{faNum(chapter.new.length)} واژه</span>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-28 pt-5">
        {alreadyPrepared && phase === 'pretest' && (
          <div className="paper-note mb-4">
            این فصل قبلاً آماده شده است. تمرین دوباره آزاد است، اما لازم نیست برای ورود به قصه دوباره آزمون بدهی.
            <button type="button" className="btn-ink mt-3 w-full py-2.5" onClick={onReady}>ورود مستقیم به قصه ←</button>
          </div>
        )}

        <div className="prep-stepper" aria-label="مرحله‌های آمادگی">
          {['حدس + آموزش', 'آمادگی', 'نوشتاری', 'قصه'].map((label, index) => (
            <span key={label} className={step === index + 1 ? 'active' : step > index + 1 ? 'done' : ''}>{faNum(index + 1)}. {label}</span>
          ))}
        </div>

        {phase === 'pretest' && pretestWord && pretestQuestion && (
          <div className="paper-card mt-5 p-5">
            <div className="flex items-center justify-between text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>
              <span>اول حدس بزن؛ بعد پاسخ درست را یاد می‌گیری</span>
              <span>{faNum(pretestIndex + 1)} / {faNum(chapter.new.length)}</span>
            </div>
            <div className="mastery-progress mt-3"><span style={{ width: `${((pretestIndex + 1) / chapter.new.length) * 100}%` }} /></div>

            <div className="mt-6 text-center">
              <div className="text-sm" style={{ color: 'var(--ink-soft)' }}>این واژه احتمالاً چه معنایی دارد؟</div>
              <div className="mt-2 font-en text-4xl font-bold" dir="ltr">{pretestWord.word}</div>
            </div>

            {!pretestFeedback && (
              <>
                <div className="mt-6 grid grid-cols-2 gap-2" dir="rtl">
                  {pretestQuestion.options?.map(option => (
                    <button key={option.id} type="button" className="btn-paper min-h-14 px-3 py-3" onClick={() => choosePretest(option.id)}>
                      {option.label}
                    </button>
                  ))}
                </div>
                <button type="button" className="btn-quiet mt-3 w-full py-2.5 text-sm" onClick={dontKnowPretest}>نمی‌دانم — آموزش بده</button>
              </>
            )}

            {pretestFeedback && (
              <div className={`mt-5 rounded-xl border-2 p-4 ${pretestFeedback === 'correct' ? 'feedback-correct' : 'feedback-wrong'}`} role="status">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold">{pretestFeedback === 'correct' ? 'حدس درست بود' : 'حالا پاسخ درست را بساز'}</div>
                    <div className="mt-1 text-2xl font-extrabold">{pretestWord.fa}</div>
                  </div>
                  <button type="button" className="btn-paper px-3 py-2 text-sm" onClick={() => speak(pretestWord.word, pretestWord.id)} aria-label={`پخش تلفظ ${pretestWord.word}`}>🔊</button>
                </div>
                {pretestWord.ipa && <div className="mt-2 font-en text-sm" dir="ltr">/ {pretestWord.ipa} /</div>}
                <div className="mt-3 rounded-xl border-2 border-dashed border-[var(--ink)] bg-white/40 p-3 text-left" dir="ltr">
                  <div className="font-en text-lg">{pretestWord.ex}</div>
                  <div className="mt-2 text-right text-sm" dir="rtl" style={{ color: 'var(--ink-soft)' }}>{pretestWord.tr}</div>
                </div>
                <div className="mt-3 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
                  این حدس فقط برای بهتر یاد گرفتن است و هیچ امتیاز «تسلط» ایجاد نمی‌کند.
                </div>
              </div>
            )}

            {pretestFeedback && <button type="button" className="btn-ink mt-4 w-full py-3" onClick={continuePretest}>{pretestIndex + 1 < chapter.new.length ? 'واژهٔ بعدی ←' : 'شروع آزمون آمادگی ←'}</button>}
          </div>
        )}

        {phase === 'recognition' && recognitionQuestion && currentRecognitionWord && (
          <div className="paper-card mt-5 p-5">
            <div className="flex items-center justify-between text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>
              <span>هر واژه باید یک‌بار بدون کمک درست بازیابی شود</span>
              <span>{faNum(recognitionPassed.size)} / {faNum(chapter.new.length)}</span>
            </div>
            <div className="mastery-progress mt-3"><span style={{ width: `${(recognitionPassed.size / chapter.new.length) * 100}%` }} /></div>
            <div className="mt-7 text-center">
              <div className="text-sm" style={{ color: 'var(--ink-soft)' }}>کدام واژهٔ انگلیسی این معنی را دارد؟</div>
              <div className="mt-2 text-2xl font-extrabold">{recognitionQuestion.prompt}</div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2" dir="ltr">
              {recognitionQuestion.options?.map(option => {
                const isAnswer = option.id === recognitionQuestion.answerId
                const isSelected = selected === option.id
                let className = 'btn-paper min-h-14 px-3 py-3 font-en text-base'
                if (feedback && isAnswer) className += ' answer-correct'
                else if (feedback && isSelected) className += ' answer-wrong'
                return <button key={option.id} type="button" className={className} disabled={Boolean(feedback)} onClick={() => chooseRecognition(option.id)}>{option.label}</button>
              })}
            </div>
            {!feedback && <button type="button" className="btn-quiet mt-3 w-full py-2.5 text-sm" onClick={dontKnowRecognition}>نمی‌دانم — نشان بده و دوباره بپرس</button>}
            {feedback && (
              <div className={`mt-4 rounded-xl border-2 p-3 text-sm ${feedback === 'correct' ? 'feedback-correct' : 'feedback-wrong'}`} role="status">
                {feedback === 'correct' ? 'درست است.' : <>پاسخ: <b className="font-en" dir="ltr">{currentRecognitionWord.word}</b>. این واژه دوباره در همین مرحله و حتماً در بخش نوشتاری می‌آید.</>}
              </div>
            )}
            {feedback && <button type="button" className="btn-ink mt-4 w-full py-3" onClick={continueRecognition}>ادامه ←</button>}
          </div>
        )}

        {phase === 'productive' && currentProductiveWord && (
          <div className="paper-card mt-5 p-5">
            <div className="flex items-center justify-between text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>
              <span>بدون گزینه؛ پاسخ را از حافظه بساز</span>
              <span>{faNum(productivePassed.size)} / {faNum(productiveTargetCount)}</span>
            </div>
            <div className="mastery-progress mt-3"><span style={{ width: `${productiveTargetCount ? (productivePassed.size / productiveTargetCount) * 100 : 0}%` }} /></div>
            <div className="mt-7 text-center">
              <div className="text-sm" style={{ color: 'var(--ink-soft)' }}>واژهٔ انگلیسی این معنی چیست؟</div>
              <div className="mt-2 text-2xl font-extrabold">{currentProductiveWord.fa}</div>
            </div>
            <label htmlFor="prep-typed" className="mt-6 block text-sm font-bold">پاسخ انگلیسی</label>
            <input
              id="prep-typed"
              className="answer-input mt-2 w-full"
              dir="ltr"
              autoFocus
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={Boolean(feedback)}
              value={typed}
              onChange={event => setTyped(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') submitProductive() }}
            />
            {!feedback && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" className="btn-quiet py-3 text-sm" onClick={dontKnowProductive}>نمی‌دانم</button>
                <button type="button" className="btn-ink py-3" disabled={!typed.trim()} onClick={submitProductive}>ثبت پاسخ</button>
              </div>
            )}
            {feedback && (
              <div className={`mt-4 rounded-xl border-2 p-3 text-sm ${feedback === 'correct' ? 'feedback-correct' : 'feedback-wrong'}`} role="status">
                {feedback === 'correct' ? 'درست. حالا این واژه برای دیدن در قصه آماده است.' : <>پاسخ درست: <b className="font-en" dir="ltr">{currentProductiveWord.word}</b>. بعداً در همین مرحله دوباره از تو پرسیده می‌شود.</>}
              </div>
            )}
            {feedback && <button type="button" className="btn-ink mt-4 w-full py-3" onClick={continueProductive}>ادامه ←</button>}
          </div>
        )}

        {phase === 'done' && (
          <div className="paper-card pop mt-5 p-6 text-center">
            <div className="text-5xl">✓</div>
            <h2 className="mt-3 text-2xl font-extrabold">برای قصه آماده‌ای</h2>
            <p className="mt-2 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
              ابتدا روی هر واژه حدس زدی و بازخورد گرفتی، سپس همهٔ {faNum(chapter.new.length)} واژه را بدون کمک شناختی و یک مجموعهٔ نوشتاری را هم از حافظه ساختی. این مرحله «آمادگی» است؛ تسلط واقعی فقط با بازیابی مستقل و فاصله‌دار در روزهای آینده ساخته می‌شود.
            </p>
            <button type="button" className="btn-crimson mt-5 w-full py-3.5 text-lg" onClick={onReady}>شروع قصه ←</button>
          </div>
        )}
      </main>
    </div>
  )
}
