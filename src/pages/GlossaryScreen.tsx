import { useMemo, useState } from 'react'
import type { GhesseState, WordEntry } from '../engine/types'
import { VOCAB } from '../data/chapters'
import { wordMastery, type MasteryLevel } from '../engine/mastery'
import { acceptedAnswers, troubleWordIds } from '../engine/review'
import GlossSheet from '../components/GlossSheet'
import { BackIcon, SearchIcon } from '../components/Icons'
import { acceptedPersianAnswers, compactPersianAnswer } from '../engine/persianTranslation'
import { faNum } from '../engine/format'

interface Props {
  state: GhesseState
  onChange: (next: GhesseState) => void
  onBack: () => void
}

const PAGE_SIZE = 200
type GlossaryFilter = 'all' | 'trouble' | MasteryLevel

// Arabic-layout letters (ي/ك), a half-space typed as a space or left out,
// diacritics and punctuation must not hide a word from a learner typing on a
// different keyboard.
interface SearchRecord {
  courseIndex: number
  words: string[]
  meanings: string[]
}

const SEARCH_RECORDS = new Map(VOCAB.map((word, courseIndex) => [word.id, {
  courseIndex,
  words: acceptedAnswers(word).map(compactPersianAnswer),
  meanings: acceptedPersianAnswers(word).map(compactPersianAnswer),
} satisfies SearchRecord]))

function searchRank(word: WordEntry, query: string): number | null {
  if (!query) return 0
  const record = SEARCH_RECORDS.get(word.id)
  if (!record) return null
  if (record.words.includes(query) || record.meanings.includes(query)) return 0
  if (record.words.some(value => value.startsWith(query)) || record.meanings.some(value => value.startsWith(query))) return 1
  if (record.words.some(value => value.includes(query)) || record.meanings.some(value => value.includes(query))) return 2
  return null
}

const LEVEL_FA: Record<MasteryLevel, string> = {
  new: 'تازه',
  seen: 'دیده‌شده',
  learning: 'در حال یادگیری',
  strong: 'قوی',
  mastered: 'مسلط',
}

export default function GlossaryScreen({ state, onChange, onBack }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<GlossaryFilter>('all')
  const [gloss, setGloss] = useState<WordEntry | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const counts = useMemo(() => {
    const result: Record<MasteryLevel, number> = { new: 0, seen: 0, learning: 0, strong: 0, mastered: 0 }
    for (const word of VOCAB) result[wordMastery(word.id, state)]++
    return result
  }, [state])

  const trouble = useMemo(() => new Set(troubleWordIds(state.words)), [state.words])

  const list = useMemo(() => {
    const q = compactPersianAnswer(query)
    return VOCAB
      .flatMap(word => {
        const level = wordMastery(word.id, state)
        if (filter === 'trouble' && !trouble.has(word.id)) return []
        if (filter !== 'all' && filter !== 'trouble' && level !== filter) return []
        const rank = searchRank(word, q)
        if (rank === null) return []
        return [{ word, rank, courseIndex: SEARCH_RECORDS.get(word.id)?.courseIndex ?? Number.MAX_SAFE_INTEGER }]
      })
      .sort((a, b) => a.rank - b.rank || a.courseIndex - b.courseIndex)
      .map(item => item.word)
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
    <div className="app-page page-in mx-auto max-w-3xl px-4 pb-28 pt-5">
      <header className="flex items-center gap-3">
        <button type="button" className="btn-paper reader-header-button" onClick={onBack} aria-label="بازگشت به نقشه"><BackIcon className="h-5 w-5" /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold">واژه‌نامه</h1>
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

      <div className="glossary-toolbar mt-3">
        <label className="glossary-filter-label" htmlFor="glossary-filter">
          <span>نمایش</span>
          <select
            id="glossary-filter"
            className="settings-select"
            aria-label="فیلتر سطح تسلط"
            value={filter}
            onChange={event => {
              setFilter(event.target.value as GlossaryFilter)
              setVisibleCount(PAGE_SIZE)
            }}
          >
            <option value="all">همه · {faNum(VOCAB.length)}</option>
            <option value="trouble">نیاز به تمرین · {faNum(trouble.size)}</option>
            <option value="mastered">مسلط · {faNum(counts.mastered)}</option>
            <option value="strong">قوی · {faNum(counts.strong)}</option>
            <option value="learning">در حال یادگیری · {faNum(counts.learning)}</option>
            <option value="seen">دیده‌شده · {faNum(counts.seen)}</option>
            <option value="new">تازه · {faNum(counts.new)}</option>
          </select>
        </label>
        <span className="glossary-result-count" aria-live="polite">{faNum(list.length)} واژه</span>
      </div>

      <div className="glossary-list mt-4">
        {list.slice(0, visibleCount).map(word => {
          const level = wordMastery(word.id, state)
          const needsWork = trouble.has(word.id)
          return (
            <button
              type="button"
              key={word.id}
              className="glossary-row"
              onClick={() => tapWord(word)}
            >
              <span className="glossary-word font-en" dir="ltr">{word.word}</span>
              <span className="glossary-meaning" dir="rtl">{word.fa}</span>
              <span className={`glossary-status ${needsWork ? 'needs-work' : level}`} dir="rtl">
                {needsWork ? 'تمرین' : LEVEL_FA[level]}
              </span>
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
        state={state}
        soundOn={state.soundOn}
        narratorVoiceURI={state.narratorVoiceURI}
        narratorRate={state.narratorRate}
        onClose={() => setGloss(null)}
      />
    </div>
  )
}
