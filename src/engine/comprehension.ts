import type { Chapter, WordEntry } from './types'
import { tokenizeSentence, type LemmaMap } from './lemmatize'

export const READING_QUESTION_COUNT = 10
// Questions on the chapter's listening text (data/chapterListening).
export const LISTENING_QUESTION_COUNT = 5

export interface ReadingOption {
  id: string
  label: string
}

export interface ReadingQuestion {
  id: string
  /** English, like the story. */
  prompt: string
  /** A Persian gloss of a fixed question while it still uses untaught words. */
  promptHintFa?: string
  context?: string
  contextDir?: 'rtl' | 'ltr'
  optionDir: 'rtl' | 'ltr'
  options: ReadingOption[]
  answerId: string
  evidenceWordId?: string
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededRank(seed: string, value: string): number {
  return hashString(`${seed}:${value}`)
}

// Sentence scans are pure per chapter but run for every chapter in the pool
// (distractors come from other chapters), so they are computed once.
const uniqueIndexCache = new WeakMap<Chapter, Partial<Record<'en' | 'fa', number[]>>>()
const storyIndexCache = new WeakMap<Chapter, number[]>()

function uniqueSentenceIndices(chapter: Chapter, field: 'en' | 'fa'): number[] {
  const cached = uniqueIndexCache.get(chapter)?.[field]
  if (cached) return cached
  const seen = new Set<string>()
  const out: number[] = []
  chapter.sentences.forEach((sentence, index) => {
    const surface = sentence[field].trim().toLowerCase()
    if (!surface || seen.has(surface)) return
    seen.add(surface)
    out.push(index)
  })
  uniqueIndexCache.set(chapter, { ...uniqueIndexCache.get(chapter), [field]: out })
  return out
}

function wordCount(value: string): number {
  return value
    .replace(/[^\p{L}'’-]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length
}

const COMMON_CONTENT_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
  'to', 'of', 'in', 'on', 'at', 'for', 'from', 'with', 'it', 'this', 'that', 'her',
  'his', 'their', 'my', 'your', 'our', 'she', 'he', 'they', 'we', 'i',
])

function contentWords(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z'-]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 2 && !COMMON_CONTENT_WORDS.has(word)),
  )
}

function overlapRatio(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (!a.size || !b.size) return 0
  let overlap = 0
  for (const word of a) if (b.has(word)) overlap++
  return overlap / Math.min(a.size, b.size)
}

function storySentenceIndices(chapter: Chapter): number[] {
  const cached = storyIndexCache.get(chapter)
  if (cached) return cached
  const unique = uniqueSentenceIndices(chapter, 'en')
  const substantial = unique.filter(index => {
    const count = wordCount(chapter.sentences[index].en)
    return count >= 4 && count <= 18
  })
  const result = substantial.length >= 4 ? substantial : unique
  storyIndexCache.set(chapter, result)
  return result
}

function targetIndex(indices: readonly number[], fraction: number, used: Set<number>): number {
  const target = Math.max(0, Math.min(indices.length - 1, Math.round((indices.length - 1) * fraction)))
  for (let distance = 0; distance < indices.length; distance++) {
    for (const candidate of [target + distance, target - distance]) {
      const value = indices[candidate]
      if (value !== undefined && !used.has(value)) {
        used.add(value)
        return value
      }
    }
  }
  return indices[0] ?? 0
}

function optionIndices(
  chapter: Chapter,
  field: 'en' | 'fa',
  target: number,
  seed: string,
): number[] {
  const targetLabel = chapter.sentences[target]?.[field].trim().toLowerCase() ?? ''
  const candidates = uniqueSentenceIndices(chapter, field)
    .filter(index => index !== target)
    .filter(index => chapter.sentences[index][field].trim().toLowerCase() !== targetLabel)
    .sort((a, b) => seededRank(seed, String(a)) - seededRank(seed, String(b)))
    .slice(0, 3)
  return [target, ...candidates]
    .sort((a, b) => seededRank(`${seed}:shuffle`, String(a)) - seededRank(`${seed}:shuffle`, String(b)))
}

function sentenceOptions(
  chapter: Chapter,
  field: 'en' | 'fa',
  target: number,
  seed: string,
): ReadingOption[] {
  return optionIndices(chapter, field, target, seed)
    .map(index => ({ id: `sentence-${index}`, label: chapter.sentences[index][field] }))
}

function storyPresenceOptions(
  chapter: Chapter,
  chapterPool: readonly Chapter[],
  target: number,
  fraction: number,
  seed: string,
): ReadingOption[] {
  const answerLabel = chapter.sentences[target].en
  const answerWords = contentWords(answerLabel)
  const chapterWords = contentWords(chapter.sentences.map(sentence => sentence.en).join(' '))
  const seen = new Set([answerLabel.trim().toLowerCase()])
  const candidates: Array<ReadingOption & { overlap: number }> = []

  for (const other of chapterPool) {
    if (other.id === chapter.id) continue
    const indices = storySentenceIndices(other)
    if (!indices.length) continue
    const position = Math.max(0, Math.min(indices.length - 1, Math.round((indices.length - 1) * fraction)))
    const index = indices[position]
    const label = other.sentences[index].en
    const normalized = label.trim().toLowerCase()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    const words = contentWords(label)
    const overlap = Math.max(overlapRatio(answerWords, words), overlapRatio(chapterWords, words) * 0.5)
    candidates.push({ id: `story-${other.id}-${index}`, label, overlap })
  }

  const distractors: ReadingOption[] = candidates
    .sort((a, b) => a.overlap - b.overlap || seededRank(seed, a.id) - seededRank(seed, b.id))
    .slice(0, 3)
    .map(({ id, label }) => ({ id, label }))

  // Production always supplies all 40 chapters. Keep a deterministic fallback
  // for isolated unit/integration consumers without making the builder fragile.
  if (distractors.length < 3) {
    const fallback = sentenceOptions(chapter, 'en', target, `${seed}:fallback`)
      .filter(option => option.id !== `sentence-${target}`)
      .map(option => ({ ...option, id: `fallback-${option.id}` }))
    for (const option of fallback) {
      const normalized = option.label.trim().toLowerCase()
      if (seen.has(normalized)) continue
      seen.add(normalized)
      distractors.push(option)
      if (distractors.length === 3) break
    }
  }

  const answerId = `story-${chapter.id}-${target}`
  return [
    { id: answerId, label: answerLabel },
    ...distractors,
  ].sort((a, b) => seededRank(`${seed}:shuffle`, a.id) - seededRank(`${seed}:shuffle`, b.id))
}

function sequenceAnchorIndices(chapter: Chapter): number[] {
  const indices = storySentenceIndices(chapter)
  const used = new Set<number>()
  return [0.08, 0.35, 0.63, 0.9].map(fraction => targetIndex(indices, fraction, used)).sort((a, b) => a - b)
}

// The fixed question stems, in English, with a Persian gloss for the
// chapters where a stem still has words the learner has not been taught.
const STEMS = {
  meaningEn: ['Which one means this?', 'کدام جملهٔ انگلیسی دقیقاً این معنی را می‌رساند؟'],
  early: ['Which one happens near the beginning of this part of the story?', 'کدام اتفاق در اوایل همین فصل رخ می‌دهد؟'],
  inChapter: ['Which one happens in this part of the story?', 'کدام اتفاق واقعاً در همین فصل رخ می‌دهد؟'],
  nearEnd: ['Which one happens near the end of this part of the story?', 'کدام اتفاق نزدیک پایان همین فصل رخ می‌دهد؟'],
  first: ['Which happens first in the story?', 'کدام اتفاق زودتر از بقیه در قصه رخ می‌دهد؟'],
  last: ['Which happens last in the story?', 'کدام اتفاق دیرتر از بقیه در قصه رخ می‌دهد؟'],
  next: ['What happens after this?', 'بعد از این جمله، چه اتفاقی می‌افتد؟'],
  previous: ['What happens before this?', 'پیش از این جمله، چه اتفاقی می‌افتد؟'],
} as const

type Stem = keyof typeof STEMS

function stemmed(
  stem: Stem,
  known: ReadonlySet<string>,
  lemmaMap: LemmaMap | undefined,
): Pick<ReadingQuestion, 'prompt' | 'promptHintFa'> {
  const [prompt, hint] = STEMS[stem]
  if (!lemmaMap) return { prompt, promptHintFa: hint }
  const taught = tokenizeSentence(prompt, lemmaMap).every(token => !token.isWord || (token.id !== undefined && known.has(token.id)))
  return taught ? { prompt } : { prompt, promptHintFa: hint }
}

function authoredQuestions(
  chapter: Chapter,
  wordById: ReadonlyMap<string, WordEntry>,
): ReadingQuestion[] {
  return chapter.check.slice(0, 2).map((checkpoint, index) => ({
    id: `${chapter.id}:authored:${index}`,
    prompt: checkpoint.q,
    optionDir: 'ltr',
    options: checkpoint.options.map(id => ({
      id,
      label: wordById.get(id)?.word ?? id,
    })),
    answerId: checkpoint.a,
    evidenceWordId: checkpoint.a,
  }))
}

export function buildReadingQuestions(
  chapter: Chapter,
  wordById: ReadonlyMap<string, WordEntry>,
  chapterPool: readonly Chapter[],
  lemmaMap?: LemmaMap,
): ReadingQuestion[] {
  // Words taught by the end of this chapter, for the stems' Persian gloss.
  const position = chapterPool.findIndex(item => item.id === chapter.id)
  const known = new Set((position < 0 ? [chapter] : chapterPool.slice(0, position + 1)).flatMap(item => item.new))
  const stem = (name: Stem) => stemmed(name, known, lemmaMap)
  const questions: ReadingQuestion[] = [...authoredQuestions(chapter, wordById)]
  const enIndices = storySentenceIndices(chapter)
  const usedEn = new Set<number>()

  const meaningEnTarget = targetIndex(enIndices, 0.3, usedEn)
  questions.push({
    id: `${chapter.id}:meaning-en`,
    ...stem('meaningEn'),
    context: chapter.sentences[meaningEnTarget].fa,
    contextDir: 'rtl',
    optionDir: 'ltr',
    options: sentenceOptions(chapter, 'en', meaningEnTarget, `${chapter.id}:meaning-en`),
    answerId: `sentence-${meaningEnTarget}`,
  })

  // Which event belongs to this chapter: early, in the middle and near the
  // end, against events from other chapters at the same point.
  for (const [slot, fraction, name] of [[2, 0.15, 'early'], [0, 0.42, 'inChapter'], [1, 0.84, 'nearEnd']] as const) {
    const target = targetIndex(enIndices, fraction, usedEn)
    const answerId = `story-${chapter.id}-${target}`
    questions.push({
      id: `${chapter.id}:story-event:${slot}`,
      ...stem(name),
      optionDir: 'ltr',
      options: storyPresenceOptions(chapter, chapterPool, target, fraction, `${chapter.id}:story-event:${slot}`),
      answerId,
    })
  }

  const anchors = sequenceAnchorIndices(chapter)
  const earliest = anchors[0]
  const latest = anchors[anchors.length - 1]
  const sequenceOptions = anchors
    .map(index => ({ id: `sentence-${index}`, label: chapter.sentences[index].en }))
    .sort((a, b) => seededRank(`${chapter.id}:sequence`, a.id) - seededRank(`${chapter.id}:sequence`, b.id))

  questions.push({
    id: `${chapter.id}:sequence:first`,
    ...stem('first'),
    optionDir: 'ltr',
    options: sequenceOptions,
    answerId: `sentence-${earliest}`,
  })

  questions.push({
    id: `${chapter.id}:sequence:last`,
    ...stem('last'),
    optionDir: 'ltr',
    options: [...sequenceOptions].sort((a, b) => seededRank(`${chapter.id}:sequence:last`, a.id) - seededRank(`${chapter.id}:sequence:last`, b.id)),
    answerId: `sentence-${latest}`,
  })

  const nextAnchor = Math.max(0, Math.min(chapter.sentences.length - 2, Math.round(chapter.sentences.length * 0.45)))
  const nextTarget = nextAnchor + 1
  questions.push({
    id: `${chapter.id}:sequence:next`,
    ...stem('next'),
    context: chapter.sentences[nextAnchor].en,
    contextDir: 'ltr',
    optionDir: 'ltr',
    options: sentenceOptions(chapter, 'en', nextTarget, `${chapter.id}:sequence:next`),
    answerId: `sentence-${nextTarget}`,
  })

  const previousAnchor = Math.max(1, Math.min(chapter.sentences.length - 1, Math.round(chapter.sentences.length * 0.7)))
  const previousTarget = previousAnchor - 1
  questions.push({
    id: `${chapter.id}:sequence:previous`,
    ...stem('previous'),
    context: chapter.sentences[previousAnchor].en,
    contextDir: 'ltr',
    optionDir: 'ltr',
    options: sentenceOptions(chapter, 'en', previousTarget, `${chapter.id}:sequence:previous`),
    answerId: `sentence-${previousTarget}`,
  })

  return questions.slice(0, READING_QUESTION_COUNT)
}
