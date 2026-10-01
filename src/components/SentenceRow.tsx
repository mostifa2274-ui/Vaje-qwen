import { useId, useMemo } from 'react'
import { tokenizeSentence } from '../engine/lemmatize'
import { lemmaMap, WORD_BY_ID } from '../data/chapters'
import { SpeakerIcon } from './Icons'

interface Props {
  en: string
  fa: string
  showFa: boolean
  isPlaying: boolean
  soundOn: boolean
  onToggleFa: () => void
  onPlay: () => void
  onWordTap: (wordId: string) => void
}

export default function SentenceRow({ en, fa, showFa, isPlaying, soundOn, onToggleFa, onPlay, onWordTap }: Props) {
  const tokens = useMemo(() => tokenizeSentence(en, lemmaMap), [en])
  const wordActionHintId = useId()

  return (
    <div className="story-sentence luxury-story-sentence">
      <div className="story-sentence-actions">
        <button
          type="button"
          className="story-action"
          onClick={onPlay}
          disabled={!soundOn}
          aria-label={isPlaying ? 'جمله در حال پخش است' : 'شنیدن جمله'}
          aria-pressed={isPlaying}
        >
          <SpeakerIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="story-action story-action-fa"
          onClick={onToggleFa}
          aria-expanded={showFa}
          aria-label={showFa ? 'پنهان کردن ترجمهٔ فارسی' : 'نمایش ترجمهٔ فارسی'}
        >
          FA
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <span id={wordActionHintId} className="sr-only" lang="fa">برای نمایش معنی فارسی، فعال کن.</span>
        <p className="story-en" lang="en" dir="ltr">
          {tokens.map((token, index) => {
            if (!token.isWord) return <span key={index}>{token.raw}</span>
            const entry = token.id ? WORD_BY_ID.get(token.id) : undefined
            if (!entry) return <span key={index} className="tok tok-unknown">{token.raw}</span>
            return (
              <button
                type="button"
                key={index}
                className="tok tok-word"
                aria-describedby={wordActionHintId}
                onClick={() => onWordTap(entry.id)}
              >
                {token.raw}
              </button>
            )
          })}
        </p>
        {showFa && (
          <p className="story-fa page-in mt-1" style={{ color: 'var(--ink-soft)' }}>
            {fa}
          </p>
        )}
      </div>
    </div>
  )
}
