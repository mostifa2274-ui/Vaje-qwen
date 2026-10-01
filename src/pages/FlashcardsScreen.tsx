import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { GhesseState, LeitnerDirection, LeitnerScope, LeitnerSettings, WordEntry } from '../engine/types'
import { WORD_BY_ID } from '../data/chapters'
import {
  BOX_INTERVAL_DAYS,
  LEITNER_BOXES,
  NEW_PER_DAY_OPTIONS,
  REPEAT_GAP,
  SESSION_LIMIT,
  boxCounts,
  buildSession,
  cardFace,
  cardsInBox,
  dueForecast,
  gradeCard,
  leitnerSummary,
  recordLeitnerReview,
  scopeWordIds,
  startOfDay,
  typedAnswerCorrect,
  wordOrigin,
  type CardFace,
  type LeitnerGrade,
} from '../engine/leitner'
import { cancelEnglishSpeech, speakEnglishWithFallback, speechFailureNotice, type SpeechFailure } from '../engine/narration'
import { persianPartOfSpeech } from '../engine/partOfSpeech'
import GlossSheet from '../components/GlossSheet'
import { BackIcon, BadgeCheckIcon, CheckIcon, FlashcardsIcon, RefreshCcwIcon, SpeakerIcon } from '../components/Icons'
import { faNum, percent } from '../engine/format'

interface Props {
  state: GhesseState
  now: number
  onChange: (next: GhesseState) => void
  onBack: () => void
}

interface Session {
  queue: string[]
  /** The first answer of each card, which is the one that moves it between boxes. */
  first: Record<string, LeitnerGrade>
  repeats: Record<string, number>
  total: number
  promoted: number
}

type TypedResult = 'right' | 'wrong'

const MAX_REPEATS = 3
const LIST_PAGE = 60
const DAY_MS = 24 * 60 * 60 * 1000

const DIRECTION_LABELS: Record<LeitnerDirection, string> = {
  enFa: 'انگلیسی ← فارسی',
  faEn: 'فارسی ← انگلیسی',
  listen: 'شنیداری',
  mixed: 'ترکیبی',
}

const SCOPE_LABELS: Record<LeitnerScope, string> = {
  all: 'همهٔ واژه‌ها',
  learned: 'واژه‌هایی که در مسیر دیده‌ای',
  'book-1': 'کتاب ۱',
  'book-2': 'کتاب ۲',
  'book-3': 'کتاب ۳',
  'book-4': 'کتاب ۴',
  'book-5': 'کتاب ۵',
  'book-6': 'کتاب ۶',
  'book-7': 'کتاب ۷',
  'book-8': 'کتاب ۸',
}

const FACE_PROMPTS: Record<CardFace, string> = {
  enFa: 'معنی این واژه را به یاد بیاور.',
  faEn: 'واژهٔ انگلیسی این معنی را به یاد بیاور.',
  listen: 'گوش کن؛ واژه و معنی‌اش را به یاد بیاور.',
}

const SPEECH_UNAVAILABLE = 'صدای انگلیسی روی این دستگاه پخش نشد. صدای English Text-to-Speech دستگاه را بررسی کن.'

interface GradeOption {
  result: LeitnerGrade
  label: string
  className: string
}

/** The grade buttons, in order; keys 1 to 3 press them. */
function gradeOptions(typedResult: TypedResult | null): GradeOption[] {
  if (typedResult === 'right') {
    return [{ result: 'hard', label: 'سخت بود', className: 'btn-paper' }, { result: 'good', label: 'بلد بودم', className: 'btn-ink' }]
  }
  if (typedResult === 'wrong') {
    return [{ result: 'again', label: 'دوباره', className: 'btn-crimson' }, { result: 'hard', label: 'پاسخم درست بود', className: 'btn-paper' }]
  }
  return [
    { result: 'again', label: 'بلد نبودم', className: 'btn-crimson' },
    { result: 'hard', label: 'سخت بود', className: 'btn-paper' },
    { result: 'good', label: 'بلد بودم', className: 'btn-ink' },
  ]
}

const DIGITS: Record<string, number> = { 1: 1, 2: 2, 3: 3, '۱': 1, '۲': 2, '۳': 3 }

function wallClockNow(): number {
  return Date.now()
}

function everyLabel(box: number): string {
  const days = BOX_INTERVAL_DAYS[box - 1]
  return days === 1 ? 'هر روز' : `هر ${faNum(days)} روز`
}

function afterLabel(days: number): string {
  return days <= 0 ? 'امروز' : days === 1 ? 'فردا' : `${faNum(days)} روز بعد`
}

function daysUntil(time: number, now: number): number {
  return Math.round((startOfDay(time) - startOfDay(now)) / DAY_MS)
}

function weekdayLabel(offset: number, now: number): string {
  if (offset === 0) return 'امروز'
  if (offset === 1) return 'فردا'
  try {
    return new Intl.DateTimeFormat('fa-IR', { weekday: 'long' }).format(new Date(startOfDay(now) + offset * DAY_MS + 12 * 60 * 60 * 1000))
  } catch {
    return `+${faNum(offset)}`
  }
}

export default function FlashcardsScreen({ state, now, onChange, onBack }: Props) {
  const leitner = state.leitner
  const settings = leitner.settings
  const scopeIds = useMemo(() => scopeWordIds(settings.scope, state), [settings.scope, state])
  const summary = useMemo(() => leitnerSummary(state, now), [state, now])
  const counts = useMemo(() => boxCounts(state, scopeIds), [state, scopeIds])
  const forecast = useMemo(() => dueForecast(state, scopeIds, now, 7), [state, scopeIds, now])

  const [session, setSession] = useState<Session | null>(null)
  const [finished, setFinished] = useState<Session | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [typed, setTyped] = useState('')
  const [typedResult, setTypedResult] = useState<TypedResult | null>(null)
  const [openBox, setOpenBox] = useState<number | null>(null)
  const [listCount, setListCount] = useState(LIST_PAGE)
  const [gloss, setGloss] = useState<WordEntry | null>(null)
  const [audioNotice, setAudioNotice] = useState('')
  const speechToken = useRef(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const answerRef = useRef<HTMLInputElement>(null)
  const primaryGradeRef = useRef<HTMLButtonElement>(null)
  const flipRef = useRef<HTMLButtonElement>(null)
  const shownMode = useRef<string | null>(null)

  const currentId = session?.queue[0]
  const word = currentId ? WORD_BY_ID.get(currentId) : undefined
  const card = currentId ? leitner.cards[currentId] : undefined
  // The face is fixed for the whole time a card is on screen.
  const [faceFor, setFaceFor] = useState<{ id: string; face: CardFace } | null>(null)
  const face: CardFace | undefined = currentId
    ? faceFor?.id === currentId ? faceFor.face : cardFace(settings.direction, currentId, card?.reviews ?? 0, state.soundOn)
    : undefined

  const speak = useCallback((text: string, kind: 'w' | 's') => {
    if (!state.soundOn) return
    const token = ++speechToken.current
    setAudioNotice('')
    const fail = (failure: SpeechFailure = 'unavailable') => {
      if (speechToken.current === token) setAudioNotice(speechFailureNotice(failure, SPEECH_UNAVAILABLE))
    }
    if (!speakEnglishWithFallback(text, state.narratorVoiceURI, state.narratorRate, kind, () => {}, fail)) fail()
  }, [state.narratorRate, state.narratorVoiceURI, state.soundOn])

  useEffect(() => () => {
    speechToken.current++
    cancelEnglishSpeech()
  }, [])

  // Hear the English side as soon as it shows: at once for the English and
  // listening faces, after the flip for the Persian face.
  useEffect(() => {
    if (!word || !face) return
    const englishVisible = face === 'faEn' ? flipped : !flipped
    if (!englishVisible) return
    const timer = window.setTimeout(() => speak(word.word, 'w'), 120)
    return () => window.clearTimeout(timer)
  }, [face, flipped, speak, word])

  // Focus follows the card: the answer box or the flip button, then the
  // main grade once the answer shows.
  useEffect(() => {
    if (!currentId) return
    const frame = window.requestAnimationFrame(() => {
      if (flipped) primaryGradeRef.current?.focus({ preventScroll: true })
      else if (settings.typed) answerRef.current?.focus({ preventScroll: true })
      else flipRef.current?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [currentId, flipped, settings.typed])

  // The heading takes focus when the summary shows or the boxes come back.
  const mode = session ? 'study' : finished ? 'summary' : 'boxes'
  useEffect(() => {
    if (shownMode.current !== null && mode !== 'study' && shownMode.current !== mode) headingRef.current?.focus({ preventScroll: true })
    shownMode.current = mode
  }, [mode])

  function updateSettings(patch: Partial<LeitnerSettings>) {
    onChange({ ...state, leitner: { ...leitner, settings: { ...settings, ...patch } } })
    setOpenBox(null)
  }

  function start(extraNew = 0) {
    const queue = buildSession(state, wallClockNow(), extraNew)
    if (!queue.length) return
    setFinished(null)
    setSession({ queue, first: {}, repeats: {}, total: queue.length, promoted: 0 })
    setFaceFor({ id: queue[0], face: cardFace(settings.direction, queue[0], leitner.cards[queue[0]]?.reviews ?? 0, state.soundOn) })
    setFlipped(false)
    setTyped('')
    setTypedResult(null)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  function flip() {
    if (!session || flipped) return
    setFlipped(true)
  }

  function checkTyped(giveUp = false) {
    if (!currentId || !face || flipped) return
    const right = !giveUp && typedAnswerCorrect(face, currentId, typed)
    setTypedResult(right ? 'right' : 'wrong')
    setFlipped(true)
  }

  function grade(result: LeitnerGrade) {
    if (!session || !currentId || !flipped) return
    const time = wallClockNow()
    const first = { ...session.first }
    let promoted = session.promoted
    if (!first[currentId]) {
      first[currentId] = result
      const before = leitner.cards[currentId]
      if (result === 'good' && gradeCard(before, 'good', time).box > (before?.box ?? 1)) promoted++
      onChange({ ...state, leitner: recordLeitnerReview(leitner, currentId, result, time) })
    }
    const queue = session.queue.slice(1)
    const repeats = { ...session.repeats }
    // A missed card comes back a few cards later, until it is remembered.
    if (result === 'again' && (repeats[currentId] ?? 0) < MAX_REPEATS) {
      repeats[currentId] = (repeats[currentId] ?? 0) + 1
      queue.splice(Math.min(REPEAT_GAP, queue.length), 0, currentId)
    }
    speechToken.current++
    cancelEnglishSpeech()
    setFlipped(false)
    setTyped('')
    setTypedResult(null)
    setAudioNotice('')
    const next = { ...session, queue, first, repeats, promoted }
    if (!queue.length) {
      setSession(null)
      setFinished(next)
      return
    }
    const nextId = queue[0]
    const reviews = (nextId === currentId ? (leitner.cards[nextId]?.reviews ?? 0) + 1 : leitner.cards[nextId]?.reviews ?? 0)
    setFaceFor({ id: nextId, face: cardFace(settings.direction, nextId, reviews, state.soundOn) })
    setSession(next)
  }

  function leave() {
    speechToken.current++
    cancelEnglishSpeech()
    setSession(null)
    setFinished(null)
    setFlipped(false)
  }

  // Keyboard: space or Enter flips, 1–3 grade, P plays the word again.
  useEffect(() => {
    if (!session) return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return
      const key = event.key.toLowerCase()
      if (!flipped && !settings.typed && (key === ' ' || key === 'enter')) {
        // A focused button answers these keys itself.
        if (target?.tagName === 'BUTTON') return
        event.preventDefault()
        flip()
      } else if (flipped && DIGITS[key]) {
        const option = gradeOptions(typedResult)[DIGITS[key] - 1]
        if (!option) return
        event.preventDefault()
        grade(option.result)
      } else if ((key === 'p' || key === 'پ') && word) {
        speak(word.word, 'w')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const header = (title: string, subtitle: string, onBackClick: () => void, backLabel: string) => (
    <header className="flex items-center gap-3">
      <button type="button" className="btn-paper reader-header-button" onClick={onBackClick} aria-label={backLabel}><BackIcon className="h-5 w-5" /></button>
      <div className="min-w-0 flex-1">
        <h1 ref={headingRef} tabIndex={-1} className="truncate text-2xl font-extrabold">{title}</h1>
        <p className="mt-1 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>{subtitle}</p>
      </div>
    </header>
  )

  // ---------- Study ----------
  if (session && word && face && currentId) {
    const done = session.total - new Set(session.queue).size
    const origin = wordOrigin(currentId)
    const box = card?.box ?? 0
    const preview = (result: LeitnerGrade) => afterLabel(daysUntil(gradeCard(card, result, now).dueAt, now))
    const grades = gradeOptions(typedResult)
    const primary: LeitnerGrade = grades.some(item => item.result === 'good') ? 'good' : 'again'
    const frontWord = (
      <div className="flashcard-word font-en" lang="en" dir="ltr">{word.word}</div>
    )
    const speakerButton = (label: string, big = false): ReactNode => state.soundOn && (
      <button type="button" className={`btn-paper ${big ? 'flashcard-listen' : 'flashcard-speaker'}`} onClick={() => speak(word.word, 'w')} aria-label={label}>
        <SpeakerIcon className={big ? 'h-8 w-8' : 'h-5 w-5'} />
        {big && <span>پخش دوباره</span>}
      </button>
    )
    return (
      <div className="app-page luxury-flashcards page-in mx-auto max-w-3xl px-4 pb-28 pt-5">
        {header('جعبهٔ لایتنر', box ? `این کارت در جعبهٔ ${faNum(box)} است؛ ${everyLabel(box)} مرور می‌شود` : 'کارت تازه؛ اولین دیدار', leave, 'پایان مرور و بازگشت')}

        <div className="mt-5 flex items-center justify-between text-xs font-bold" style={{ color: 'var(--ink-soft)' }}>
          <span>کارت {faNum(Math.min(done + 1, session.total))} از {faNum(session.total)}</span>
          <span>{DIRECTION_LABELS[face]}</span>
        </div>
        <div className="mastery-progress mt-2" role="progressbar" aria-label="پیشرفت مرور" aria-valuemin={0} aria-valuemax={session.total} aria-valuenow={done}>
          <span style={{ width: `${(done / session.total) * 100}%` }} />
        </div>

        <section className="flashcard mt-5" aria-live="polite" data-testid="flashcard">
          <div key={`${currentId}:${flipped ? 'back' : 'front'}`} className="flashcard-face">
            {!flipped ? (
              <>
                <p className="flashcard-prompt">{FACE_PROMPTS[face]}</p>
                {face === 'enFa' && (
                  <>
                    {frontWord}
                    {word.ipa && <div className="flashcard-ipa font-en" lang="en" dir="ltr">{word.ipa}</div>}
                    <div className="mt-3 flex justify-center">{speakerButton('شنیدن تلفظ')}</div>
                  </>
                )}
                {face === 'faEn' && (
                  <>
                    <div className="flashcard-meaning">{word.fa}</div>
                    <div className="flashcard-pos">{persianPartOfSpeech(word.pos)}</div>
                  </>
                )}
                {face === 'listen' && <div className="mt-4 flex justify-center">{speakerButton('پخش دوبارهٔ واژه', true)}</div>}
              </>
            ) : (
              <>
                {typedResult && (
                  <div className={`feedback-panel mb-4 p-3 text-sm leading-7 ${typedResult === 'right' ? 'feedback-correct' : 'feedback-wrong'}`} role="status">
                    {typedResult === 'right' ? 'درست است.' : typed.trim() ? <>پاسخ تو: <span dir="auto">{typed.trim()}</span></> : 'پاسخی ننوشتی.'}
                  </div>
                )}
                <div className="flex items-center justify-center gap-3">
                  {frontWord}
                  {speakerButton('شنیدن تلفظ')}
                </div>
                {word.ipa && <div className="flashcard-ipa font-en" dir="ltr">{word.ipa}</div>}
                <div className="flashcard-meaning mt-3">{word.fa}</div>
                <div className="flashcard-pos">{persianPartOfSpeech(word.pos)}</div>
                {word.ex && (
                  <div className="flashcard-example">
                    <div className="flex items-start gap-2" lang="en" dir="ltr">
                      <p className="font-en flex-1">{word.ex}</p>
                      {state.soundOn && (
                        <button type="button" className="btn-quiet flashcard-example-play" onClick={() => speak(word.ex, 's')} aria-label="شنیدن جملهٔ نمونه">
                          <SpeakerIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {word.tr && <p className="mt-1 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>{word.tr}</p>}
                  </div>
                )}
                {origin && <div className="flashcard-origin">کتاب {faNum(origin.book)}، فصل {faNum(origin.n)}: {origin.titleFa}</div>}
              </>
            )}
          </div>
        </section>

        {audioNotice && <div className="paper-note mt-3" role="status">{audioNotice}</div>}

        {!flipped && settings.typed && (
          <form
            className="mt-4"
            onSubmit={event => {
              event.preventDefault()
              if (typed.trim()) checkTyped()
            }}
          >
            <label htmlFor="flashcard-answer" className="block text-sm font-bold">{face === 'enFa' ? 'معنی فارسی' : 'واژهٔ انگلیسی'}</label>
            <input
              id="flashcard-answer"
              ref={answerRef}
              className="answer-input mt-2 w-full"
              lang={face === 'enFa' ? 'fa' : 'en'}
              dir={face === 'enFa' ? 'rtl' : 'ltr'}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="done"
              value={typed}
              onChange={event => setTyped(event.target.value)}
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" className="btn-quiet py-3 text-sm" onClick={() => checkTyped(true)}>نمی‌دانم</button>
              <button type="submit" className="btn-ink py-3" disabled={!typed.trim()}>بررسی</button>
            </div>
          </form>
        )}

        {!flipped && !settings.typed && (
          <button ref={flipRef} type="button" className="btn-ink mt-4 w-full py-3.5 text-lg" onClick={flip}>
            <span className="inline-flex items-center justify-center gap-2"><RefreshCcwIcon className="h-5 w-5" />نمایش پاسخ</span>
          </button>
        )}

        {flipped && (
          <div className={`flashcard-grades mt-4 ${grades.length === 2 ? 'two' : ''}`} role="group" aria-label="چقدر به یاد آوردی؟">
            {grades.map(item => (
              <button
                key={item.result + item.label}
                ref={item.result === primary ? primaryGradeRef : undefined}
                type="button"
                className={`${item.className} flashcard-grade`}
                onClick={() => grade(item.result)}
              >
                <span className="font-extrabold">{item.label}</span>
                <small>{preview(item.result)}</small>
              </button>
            ))}
          </div>
        )}

        <p className="mt-4 hidden text-center text-xs leading-6 sm:block" style={{ color: 'var(--ink-soft)' }}>
          میان‌بُرها: {settings.typed ? 'Enter بررسی' : 'فاصله برگرداندن کارت'}، {settings.typed ? '۱ و ۲' : '۱ تا ۳'} ارزیابی{state.soundOn ? '، P پخش دوباره' : ''}
        </p>
      </div>
    )
  }

  // ---------- Session summary ----------
  if (finished) {
    const answers = Object.values(finished.first)
    const remembered = answers.filter(result => result !== 'again').length
    const backToOne = answers.filter(result => result === 'again').length
    return (
      <div className="app-page luxury-flashcards page-in mx-auto max-w-3xl px-4 pb-28 pt-5">
        {header('جعبهٔ لایتنر', 'نتیجهٔ این مرور', leave, 'بازگشت به جعبه‌ها')}
        <section className="learning-focus-card mt-5 p-6 text-center" data-testid="flashcards-summary">
          <BadgeCheckIcon className="mx-auto h-11 w-11" aria-hidden="true" />
          <h2 className="mt-3 text-2xl font-extrabold">مرور تمام شد</h2>
          <div className="leitner-kpis mt-5">
            <div className="metric-card"><b>{faNum(answers.length)}</b><span>کارت مرورشده</span></div>
            <div className="metric-card"><b>{answers.length ? percent(remembered / answers.length) : '—'}</b><span>به یاد آمده</span></div>
            <div className="metric-card"><b>{faNum(finished.promoted)}</b><span>یک جعبه بالاتر رفت</span></div>
            <div className="metric-card"><b>{faNum(backToOne)}</b><span>به جعبهٔ ۱ برگشت</span></div>
          </div>
          <p className="mt-4 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
            {summary.due
              ? `هنوز ${faNum(summary.due)} کارت برای امروز مانده است.`
              : forecast[1]
                ? `فردا ${faNum(forecast[1])} کارت منتظر توست.`
                : 'برای امروز همه‌چیز مرور شد.'}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" className="btn-paper py-3" onClick={leave}>بازگشت به جعبه‌ها</button>
            {summary.due + summary.newToday > 0 ? (
              <button type="button" className="btn-ink py-3" onClick={() => start()}>ادامهٔ مرور</button>
            ) : counts[0] > 0 ? (
              <button type="button" className="btn-ink py-3" onClick={() => start(10)}>۱۰ کارت تازهٔ دیگر</button>
            ) : (
              <button type="button" className="btn-ink py-3" onClick={onBack}>مسیر یادگیری</button>
            )}
          </div>
        </section>
      </div>
    )
  }

  // ---------- Dashboard ----------
  const available = summary.due + summary.newToday
  const maxBox = Math.max(1, ...counts.slice(1))
  const maxForecast = Math.max(1, ...forecast)
  const listIds = openBox === null ? [] : cardsInBox(state, scopeIds, openBox)

  return (
    <div className="app-page luxury-flashcards page-in mx-auto max-w-3xl px-4 pb-28 pt-5">
      {header('جعبهٔ لایتنر', 'کارت‌های مرور برای همهٔ واژه‌های مسیر؛ هر کارتی که به یاد بیاوری یک جعبه جلو می‌رود.', onBack, 'بازگشت به نقشه')}

      <section className="learning-focus-card mt-5 p-5 sm:p-6" aria-labelledby="leitner-today">
        <h2 id="leitner-today" className="text-lg font-extrabold">امروز</h2>
        <div className="leitner-kpis mt-3">
          <div className="metric-card"><b>{faNum(summary.due)}</b><span>کارت برای مرور</span></div>
          <div className="metric-card"><b>{faNum(summary.newToday)}</b><span>کارت تازه</span></div>
          <div className="metric-card"><b>{faNum(summary.reviewedToday)}</b><span>مرورشدهٔ امروز</span></div>
          <div className="metric-card"><b>{faNum(summary.streak)}</b><span>روز پیاپی</span></div>
        </div>
        {available > 0 ? (
          <button type="button" className="btn-crimson mt-4 w-full py-3.5 text-lg" onClick={() => start()}>
            <span className="inline-flex items-center justify-center gap-2"><FlashcardsIcon className="h-5 w-5" />شروع مرور ({faNum(Math.min(available, SESSION_LIMIT))} کارت)</span>
          </button>
        ) : (
          <div className="paper-note mt-4" role="status">
            {counts[0] > 0 && settings.newPerDay === 0
              ? 'کارت تازه‌ای برای امروز تعیین نشده است. از تنظیمات تعداد کارت تازه را بالا ببر یا چند کارت بیشتر بگیر.'
              : forecast[1] ? `برای امروز کارتی نمانده؛ فردا ${faNum(forecast[1])} کارت منتظر توست.` : 'برای امروز کارتی نمانده است.'}
          </div>
        )}
        {counts[0] > 0 && (
          <button type="button" className="btn-quiet mt-2 w-full py-2.5 text-sm" onClick={() => start(10)}>
            ۱۰ کارت تازهٔ بیشتر
          </button>
        )}
        <p className="mt-3 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
          {faNum(summary.started)} از {faNum(summary.total)} کارت شروع شده؛ {faNum(summary.mastered)} کارت در جعبهٔ آخر
          {summary.accuracy !== undefined && <>؛ به یاد آوردن در هفتهٔ اخیر: {percent(summary.accuracy)}</>}
        </p>
      </section>

      <section className="learning-focus-card mt-4 p-5 sm:p-6" aria-labelledby="leitner-boxes">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="leitner-boxes" className="text-lg font-extrabold">جعبه‌ها</h2>
          <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>{SCOPE_LABELS[settings.scope]}</span>
        </div>
        <p className="mt-1 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
          هر کارت با هر بار به یاد آوردن یک جعبه جلو می‌رود و دیرتر برمی‌گردد؛ اگر فراموشش کنی، به جعبهٔ ۱ برمی‌گردد. برای دیدن کارت‌های هر جعبه، آن را لمس کن.
        </p>
        <div className="leitner-boxes mt-4" role="group" aria-label="جعبه‌های لایتنر">
          {Array.from({ length: LEITNER_BOXES }, (_, index) => index + 1).map(box => (
            <button
              key={box}
              type="button"
              className={`leitner-box ${openBox === box ? 'open' : ''}`}
              aria-pressed={openBox === box}
              aria-label={`جعبهٔ ${faNum(box)}، ${everyLabel(box)}: ${faNum(counts[box])} کارت`}
              title={`${faNum(counts[box])} کارت`}
              onClick={() => { setOpenBox(openBox === box ? null : box); setListCount(LIST_PAGE) }}
            >
              <span className="leitner-box-track" aria-hidden="true">
                <span className="leitner-box-fill" style={{ height: `${(counts[box] / maxBox) * 100}%` }} />
              </span>
              <b>{faNum(counts[box])}</b>
              <span>جعبهٔ {faNum(box)}</span>
              <small>{everyLabel(box)}</small>
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`leitner-unstarted mt-3 ${openBox === 0 ? 'open' : ''}`}
          aria-pressed={openBox === 0}
          onClick={() => { setOpenBox(openBox === 0 ? null : 0); setListCount(LIST_PAGE) }}
        >
          {faNum(counts[0])} کارت هنوز شروع نشده
        </button>

        {openBox !== null && (
          <div className="leitner-list mt-4" data-testid="leitner-box-list">
            <h3 className="text-sm font-extrabold">
              {openBox === 0 ? 'کارت‌های شروع‌نشده' : `جعبهٔ ${faNum(openBox)}`} ({faNum(listIds.length)} کارت)
            </h3>
            {listIds.length === 0 ? (
              <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>این جعبه هنوز خالی است.</p>
            ) : (
              <ul className="mt-2">
                {listIds.slice(0, listCount).map(id => {
                  const entry = WORD_BY_ID.get(id)!
                  const due = leitner.cards[id]
                  return (
                    <li key={id}>
                      <button type="button" className="glossary-row" onClick={() => setGloss(entry)}>
                        <span className="glossary-word font-en" lang="en" dir="ltr">{entry.word}</span>
                        <span className="glossary-meaning" dir="rtl">{entry.fa}</span>
                        {due && <span className="glossary-status" dir="rtl">{afterLabel(Math.max(0, daysUntil(due.dueAt, now)))}</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {listCount < listIds.length && (
              <button type="button" className="btn-paper mt-3 w-full py-2.5" onClick={() => setListCount(count => count + LIST_PAGE)}>
                نمایش بیشتر ({faNum(listIds.length - listCount)} باقی مانده)
              </button>
            )}
          </div>
        )}
      </section>

      <section className="learning-focus-card mt-4 p-5 sm:p-6" aria-labelledby="leitner-week">
        <h2 id="leitner-week" className="text-lg font-extrabold">هفتهٔ پیش رو</h2>
        <p className="mt-1 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
          {forecast.some(Boolean)
            ? 'تعداد کارت‌هایی که هر روز نوبت مرورشان می‌رسد (کارت‌های تازه حساب نشده‌اند).'
            : 'هنوز کارتی برای این هفته در نوبت نیست؛ با اولین مرور، روزهای بعدی اینجا پر می‌شوند.'}
        </p>
        <ol className="leitner-forecast mt-4" aria-label="کارت‌های موعددار هفت روز آینده">
          {forecast.map((count, offset) => (
            <li key={offset} className={offset === 0 ? 'today' : ''} aria-label={`${weekdayLabel(offset, now)}: ${faNum(count)} کارت`} title={`${faNum(count)} کارت`}>
              <span className="leitner-forecast-value" aria-hidden="true">{count > 0 ? faNum(count) : ''}</span>
              <span className="leitner-forecast-track" aria-hidden="true">
                <span className="leitner-forecast-fill" style={{ height: `${(count / maxForecast) * 100}%` }} />
              </span>
              <span className="leitner-forecast-day" aria-hidden="true">{weekdayLabel(offset, now)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="learning-focus-card mt-4 p-5 sm:p-6" aria-labelledby="leitner-settings">
        <h2 id="leitner-settings" className="text-lg font-extrabold">تنظیمات مرور</h2>
        <div className="leitner-settings mt-3">
          <label className="leitner-setting">
            <span>کارت‌ها</span>
            <select className="settings-select" value={settings.scope} onChange={event => updateSettings({ scope: event.target.value as LeitnerScope })}>
              {(Object.keys(SCOPE_LABELS) as LeitnerScope[]).map(scope => <option key={scope} value={scope}>{SCOPE_LABELS[scope]}</option>)}
            </select>
          </label>
          <label className="leitner-setting">
            <span>کارت تازه در روز</span>
            <select className="settings-select" value={settings.newPerDay} onChange={event => updateSettings({ newPerDay: Number(event.target.value) })}>
              {NEW_PER_DAY_OPTIONS.map(count => <option key={count} value={count}>{count === 0 ? 'هیچ' : faNum(count)}</option>)}
            </select>
          </label>
        </div>
        <fieldset className="mt-4">
          <legend className="text-sm font-bold">روی کارت چه ببینم؟</legend>
          <div className="leitner-directions mt-2">
            {(Object.keys(DIRECTION_LABELS) as LeitnerDirection[]).map(direction => (
              <button
                key={direction}
                type="button"
                className={settings.direction === direction ? 'btn-ink' : 'btn-paper'}
                aria-pressed={settings.direction === direction}
                disabled={direction === 'listen' && !state.soundOn}
                onClick={() => updateSettings({ direction })}
              >
                {DIRECTION_LABELS[direction]}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="settings-toggle-row mt-4 flex items-center justify-between gap-4">
          <div>
            <div id="leitner-typed" className="text-sm font-bold">پاسخ را بنویس</div>
            <div className="text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>به جای برگرداندن کارت، پاسخ را تایپ کن تا خودکار بررسی شود.</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-labelledby="leitner-typed"
            aria-checked={settings.typed}
            className={settings.typed ? 'btn-ink px-4 py-2' : 'btn-paper px-4 py-2'}
            onClick={() => updateSettings({ typed: !settings.typed })}
          >
            {settings.typed ? 'روشن' : 'خاموش'}
          </button>
        </div>
        <p className="mt-4 text-xs leading-6" style={{ color: 'var(--ink-soft)' }}>
          <CheckIcon className="ml-1 inline h-3.5 w-3.5" aria-hidden="true" />
          جعبهٔ لایتنر تمرین آزاد است و در قفل فصل‌ها و آزمون‌ها حساب نمی‌شود؛ پیشرفتش با بقیهٔ پیشرفت تو ذخیره و پشتیبان‌گیری می‌شود.
        </p>
      </section>

      <GlossSheet
        word={gloss}
        state={state}
        soundOn={state.soundOn}
        narratorVoiceURI={state.narratorVoiceURI}
        narratorRate={state.narratorRate}
        onClose={() => setGloss(null)}
      />
    </div>
  )
}
