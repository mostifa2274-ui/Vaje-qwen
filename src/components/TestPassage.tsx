import type { Ref } from 'react'
import type { TestText } from '../data/bookTests'
import { faNum } from '../engine/format'
import { PauseIcon, PlayIcon } from './Icons'
import { usePassagePlayer, type PassagePlayer } from './usePassagePlayer'

const NO_OP = () => {}

export function SoundOffNote({ onEnable }: { onEnable: () => void }) {
  return (
    <div className="paper-note mt-4">
      بخش شنیداری بدون صدا انجام نمی‌شود.
      <button type="button" className="btn-ink mt-3 w-full py-2.5" onClick={onEnable}>روشن کردن صدا</button>
    </div>
  )
}

export function Passage({ text, showTranslation = false }: { text: TestText; showTranslation?: boolean }) {
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

/** Play button and status for a text that is only heard. */
export function ListeningPlayer({
  player,
  text,
  heard,
  buttonRef,
  testId = 'listening-player',
}: {
  player: PassagePlayer
  text: TestText
  heard: boolean
  buttonRef?: Ref<HTMLButtonElement>
  testId?: string
}) {
  const playing = player.playing >= 0
  return (
    <div className="test-player mt-4" data-testid={testId}>
      <button
        ref={buttonRef}
        type="button"
        className={playing ? 'btn-paper min-h-14 w-full text-lg' : 'btn-crimson min-h-14 w-full text-lg'}
        onClick={() => playing ? player.stop() : player.play()}
      >
        <span className="inline-flex items-center justify-center gap-2">
          {playing ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
          {playing ? 'توقف' : heard ? 'پخش دوبارهٔ متن' : 'پخش متن'}
        </span>
      </button>
      <div className="mt-3 text-center text-xs leading-6" role="status" style={{ color: 'var(--ink-soft)' }}>
        {playing
          ? `در حال پخش: جملهٔ ${faNum(player.playing + 1)} از ${faNum(text.sentences.length)}`
          : heard
            ? 'متن را کامل شنیدی؛ حالا به سؤال‌ها پاسخ بده.'
            : `${faNum(text.sentences.length)} جمله؛ سؤال‌ها پس از یک‌بار شنیدن کامل فعال می‌شوند.`}
      </div>
      {player.notice && <div className="paper-note mt-3" role="alert">{player.notice}</div>}
    </div>
  )
}

export function Questions({
  text,
  prefix,
  chosen,
  disabled,
  locked,
  rejected,
  onChoose,
}: {
  text: TestText
  prefix: string
  chosen: Array<number | null>
  disabled: boolean
  /** Questions already confirmed right: shown green and closed. */
  locked?: readonly boolean[]
  /** Options already tried and found wrong, per question. */
  rejected?: ReadonlyArray<readonly number[]>
  onChoose: (question: number, option: number) => void
}) {
  return (
    <ol className="mt-5 space-y-5">
      {text.questions.map((question, index) => {
        const done = locked?.[index] === true
        const tried = rejected?.[index] ?? []
        return (
          <li key={index} data-testid={`${prefix}-question`}>
            <div id={`${prefix}-q${index}`} className="text-sm font-extrabold leading-7">
              {faNum(index + 1)}. {question.q}
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-labelledby={`${prefix}-q${index}`}>
              {question.options.map((option, optionIndex) => {
                const wrong = tried.includes(optionIndex)
                let className = 'btn-paper test-option min-h-12 px-3 py-2.5 text-sm leading-6'
                if (done && chosen[index] === optionIndex) className += ' answer-correct'
                else if (wrong) className += ' answer-wrong'
                return (
                  <button
                    key={optionIndex}
                    type="button"
                    className={className}
                    aria-pressed={chosen[index] === optionIndex}
                    disabled={disabled || done || wrong}
                    onClick={() => onChoose(index, optionIndex)}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
            {done && <div className="mt-1 text-xs font-bold leading-6" style={{ color: 'var(--ink-soft)' }}>✓ درست است.</div>}
            {!done && tried.length > 0 && (
              <div className="mt-1 text-xs font-bold leading-6" role="status" style={{ color: 'var(--crimson-deep)' }}>
                پاسخ قبلی درست نبود؛ دوباره گوش کن و پاسخ دیگری انتخاب کن.
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export function QuestionReview({ text, chosen }: { text: TestText; chosen: Array<number | null> }) {
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
              پاسخ تو: {answer === null || answer === undefined ? '—' : question.options[answer]}
            </div>
            {!right && <div className="text-sm font-bold leading-7">پاسخ درست: {question.options[question.answer]}</div>}
          </li>
        )
      })}
    </ol>
  )
}

/** A heard text's review: replay button, transcript with translation, answers. */
export function ListeningReview({
  text,
  chosen,
  player,
  soundOn,
  summary,
}: {
  text: TestText
  chosen: Array<number | null>
  player: PassagePlayer
  soundOn: boolean
  summary: string
}) {
  const playing = player.playing >= 0
  return (
    <details className="test-review-details mt-3">
      <summary>{summary}</summary>
      <div className="mt-3 flex items-center justify-between gap-3">
        <h4 className="font-en text-base font-bold" dir="ltr">{text.titleEn}</h4>
        {soundOn && (
          <button
            type="button"
            className="btn-paper shrink-0 px-3 py-2 text-sm"
            aria-label={playing ? 'توقف متن شنیداری' : 'پخش دوبارهٔ متن شنیداری'}
            onClick={() => playing ? player.stop() : player.play()}
          >
            <span className="inline-flex items-center gap-2">
              {playing ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
              {playing ? 'توقف' : 'پخش دوباره'}
            </span>
          </button>
        )}
      </div>
      {player.notice && <div className="paper-note mt-3" role="status">{player.notice}</div>}
      <Passage text={text} showTranslation />
      <QuestionReview text={text} chosen={chosen} />
    </details>
  )
}

/** One heard text with its questions and a player of its own, so texts never share playback. */
export function ListeningText({
  text,
  prefix,
  heard,
  chosen,
  soundOn,
  voiceURI,
  rate,
  testId,
  onHeard,
  onEnableSound,
  onChoose,
}: {
  text: TestText
  prefix: string
  heard: boolean
  chosen: Array<number | null>
  soundOn: boolean
  voiceURI: string
  rate: number
  testId?: string
  onHeard: () => void
  onEnableSound: () => void
  onChoose: (question: number, option: number) => void
}) {
  const player = usePassagePlayer(text.sentences, voiceURI, rate, onHeard)
  return (
    <>
      {!soundOn ? <SoundOffNote onEnable={onEnableSound} /> : <ListeningPlayer player={player} text={text} heard={heard} testId={testId} />}
      <Questions text={text} prefix={prefix} chosen={chosen} disabled={!heard} onChoose={onChoose} />
    </>
  )
}

/** A heard text's review with a player of its own. */
export function ListeningTextReview({
  text,
  chosen,
  soundOn,
  voiceURI,
  rate,
  summary,
}: {
  text: TestText
  chosen: Array<number | null>
  soundOn: boolean
  voiceURI: string
  rate: number
  summary: string
}) {
  const player = usePassagePlayer(text.sentences, voiceURI, rate, NO_OP)
  return <ListeningReview text={text} chosen={chosen} player={player} soundOn={soundOn} summary={summary} />
}

/** A read text's review: the text with its translation and the answers. */
export function ReadingTextReview({ text, chosen, summary }: { text: TestText; chosen: Array<number | null>; summary: string }) {
  return (
    <details className="test-review-details mt-3">
      <summary>{summary}</summary>
      <h4 className="mt-3 font-en text-base font-bold" dir="ltr">{text.titleEn}</h4>
      <Passage text={text} showTranslation />
      <QuestionReview text={text} chosen={chosen} />
    </details>
  )
}
