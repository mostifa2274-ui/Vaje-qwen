import { useMemo } from 'react'
import { tokenizeSentence } from '../engine/lemmatize'
import { lemmaMap, WORD_BY_ID } from '../data/chapters'

interface Props {
  en: string
  fa: string
  showFa: boolean
  isPlaying: boolean
  soundOn: boolean
  newIds: Set<string>
  onToggleFa: () => void
  onPlay: () => void
  onWordTap: (wordId: string) => void
}

export default function SentenceRow({ en, fa, showFa, isPlaying, soundOn, newIds, onToggleFa, onPlay, onWordTap }: Props) {
  const tokens = useMemo(() => tokenizeSentence(en, lemmaMap), [en])

  return (
    <div className="flex items-start gap-2">
      <div className="mt-1 flex shrink-0 flex-col gap-2">
        <button
          type="button"
          className="btn-paper flex h-8 w-8 items-center justify-center text-xs"
          onClick={onPlay}
          disabled={!soundOn}
          aria-label="شنیدن جمله"
          style={isPlaying ? { background: 'var(--gold)' } : undefined}
        >
          {isPlaying ? '▶' : '🔊'}
        </button>
        <button
          type="button"
          className="btn-paper flex h-8 w-8 items-center justify-center text-[10px]"
          onClick={onToggleFa}
          aria-expanded={showFa}
          aria-label={showFa ? 'پنهان کردن ترجمهٔ فارسی' : 'نمایش ترجمهٔ فارسی'}
        >
          FA
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <p className="story-en">
          {tokens.map((token, index) => {
            if (!token.isWord) return <span key={index}>{token.raw}</span>
            const entry = token.id ? WORD_BY_ID.get(token.id) : undefined
            const isNew = token.id ? newIds.has(token.id) : false
            if (!entry) return <span key={index} className="tok tok-unknown">{token.raw}</span>
            return (
              <button
                type="button"
                key={index}
                className={`tok tok-word${isNew ? ' tok-new' : ''}`}
                onClick={() => onWordTap(entry.id)}
                aria-label={`معنی ${token.raw}`}
              >
                {token.raw}
              </button>
            )
          })}
        </p>
        {showFa && (
          <p className="story-fa mt-1 text-[0.95rem] page-in" style={{ color: 'var(--ink-soft)' }}>
            {fa}
          </p>
        )}
      </div>
    </div>
  )
}
