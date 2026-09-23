import { useMemo, useState } from 'react'
import type { GhesseState, WordEntry } from '../engine/types'
import { VOCAB } from '../data/chapters'
import { wordMastery, type MasteryLevel } from '../engine/mastery'
import { troubleWordIds } from '../engine/review'
import GlossSheet from '../components/GlossSheet'
import { BackIcon, SearchIcon } from '../components/Icons'
import { faNum } from '../engine/format'

interface Props {
  state: GhesseState
  onChange: (next: GhesseState) => void
  onBack: () => void
}

const PAGE_SIZE = 200

const LEVEL_FA: Record<MasteryLevel, string> = {
  new: 'تازه',
  seen: 'دیده‌شده',
  learning: 'در حال یادگیری',
  strong: 'قوی',
  mastered: 'مسلط',
}

const LEVEL_STYLE: Record<MasteryLevel, React.CSSProperties> = {
  new: { background: 'var(--cream-soft)', color: 'var(--ink-soft)' },
  seen: { background: 'var(--paper)', color: 'var(--ink)' },
  learning: { background: '#f2d79f', color: 'var(--ink)' },
  strong: { background: 'var(--gold)', color: 'var(--ink)' },
  mastered: { background: 'var(--ink)', color: 'var(--cream)' },
}

export default function GlossaryScreen({ state, onChange, onBack }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'trouble' | MasteryLevel>('all')
  const [gloss, setGloss] = useState<WordEntry | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const counts = useMemo(() => {
    const result: Record<MasteryLevel, number> = { new: 0, seen: 0, learning: 0, strong: 0, mastered: 0 }
    for (const word of VOCAB) result[wordMastery(word.id, state)]++
    return result
  }, [state])

  const trouble = useMemo(() => new Set(troubleWordIds(state.words)), [state.words])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return VOCAB.filter(word => {
      const level = wordMastery(word.id, state)
      if (filter === 'trouble' && !trouble.has(word.id)) return false
      if (filter !== 'all' && filter !== 'trouble' && level !== filter) return false
      if (!q) return true
      return word.word.toLowerCase().includes(q) || word.fa.includes(q)
    })
  }, [query, filter, state, trouble])

  function tapWord(word: WordEntry) {
    setGloss(word)
    const previous = state.words[word.id]
    if (!previous?.introduced) return
    onChange({
      ...state,
      words: { ...state.words, [word.id]: { ...previous, taps: previous.taps + 1 } },
    })
  }

  return (
    <div className="page-in mx-auto min-h-screen max-w-3xl px-4 pb-28 pt-5" style={{ background: 'var(--cream)' }}>
      <header className="flex items-center gap-3">
        <button type="button" className="btn-paper reader-header-button" onClick={onBack} aria-label="بازگشت به نقشه"><BackIcon className="h-5 w-5" /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold">واژه‌نامه</h1>
          <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>
            {faNum(counts.mastered)} مسلط · {faNum(counts.strong)} قوی · {faNum(trouble.size)} نیازمند تمرین
          </p>
        </div>
      </header>

      <label className="search-shell mt-4">
        <SearchIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <input
          className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none"
          placeholder="جست‌وجو: book یا کتاب…"
          value={query}
          onChange={event => { setQuery(event.target.value); setVisibleCount(PAGE_SIZE) }}
          aria-label="جست‌وجو در واژه‌نامه"
        />
      </label>

      <div className="strip-scroll mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="فیلتر سطح تسلط">
        {(['all', 'trouble', 'mastered', 'strong', 'learning', 'seen', 'new'] as const).map(value => (
          <button
            type="button"
            key={value}
            className={filter === value ? 'btn-ink shrink-0 px-3 py-1.5 text-sm' : 'btn-paper shrink-0 px-3 py-1.5 text-sm'}
            aria-pressed={filter === value}
            onClick={() => { setFilter(value); setVisibleCount(PAGE_SIZE) }}
          >
            {value === 'all' ? 'همه' : value === 'trouble' ? 'نیاز به تمرین' : LEVEL_FA[value]}
          </button>
        ))}
      </div>

      <div className="glossary-list mt-4">
        {list.slice(0, visibleCount).map(word => {
          const level = wordMastery(word.id, state)
          const needsWork = trouble.has(word.id)
          return (
            <button
              type="button"
              key={word.id}
              className="glossary-row flex w-full items-center gap-3 px-3 py-3 text-right"
              onClick={() => tapWord(word)}
            >
              <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={needsWork ? { background: '#f7d7d7', color: 'var(--ink)' } : LEVEL_STYLE[level]}>
                {needsWork ? 'تمرین' : LEVEL_FA[level]}
              </span>
              <span className="font-en min-w-0 flex-1 truncate text-left font-semibold" dir="ltr">{word.word}</span>
              <span className="min-w-0 max-w-[48%] text-sm leading-6" style={{ color: 'var(--ink-soft)' }}>{word.fa}</span>
            </button>
          )
        })}

        {visibleCount < list.length && (
          <button
            type="button"
            className="btn-paper mt-3 w-full py-2.5"
            onClick={() => setVisibleCount(count => Math.min(count + PAGE_SIZE, list.length))}
          >
            نمایش واژه‌های بیشتر ({faNum(list.length - visibleCount)} باقی مانده)
          </button>
        )}

        {list.length === 0 && (
          <p className="pt-6 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>چیزی پیدا نشد.</p>
        )}
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