import type { Chapter, WordEntry } from './types'

export const READING_QUESTION_COUNT = 10

export interface ReadingOption {
  id: string
  label: string
}

export interface ReadingQuestion {
  id: string
  prompt: string
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
): ReadingQuestion[] {
  const questions: ReadingQuestion[] = [...authoredQuestions(chapter, wordById)]
  const enIndices = storySentenceIndices(chapter)
  const faIndices = uniqueSentenceIndices(chapter, 'fa')
  const usedEn = new Set<number>()
  const usedFa = new Set<number>()

  const meaningEnTarget = targetIndex(enIndices, 0.3, usedEn)
  questions.push({
    id: `${chapter.id}:meaning-en`,
    prompt: 'کدام جملهٔ انگلیسی دقیقاً این معنی را می‌رساند؟',
    context: chapter.sentences[meaningEnTarget].fa,
    contextDir: 'rtl',
    optionDir: 'ltr',
    options: sentenceOptions(chapter, 'en', meaningEnTarget, `${chapter.id}:meaning-en`),
    answerId: `sentence-${meaningEnTarget}`,
  })

  const meaningFaTarget = targetIndex(faIndices, 0.68, usedFa)
  questions.push({
    id: `${chapter.id}:meaning-fa`,
    prompt: 'این جمله در قصه چه معنایی دارد؟',
    context: chapter.sentences[meaningFaTarget].en,
    contextDir: 'ltr',
    optionDir: 'rtl',
    options: sentenceOptions(chapter, 'fa', meaningFaTarget, `${chapter.id}:meaning-fa`),
    answerId: `sentence-${meaningFaTarget}`,
  })

  for (const [slot, fraction] of [0.42, 0.84].entries()) {
    const target = targetIndex(enIndices, fraction, usedEn)
    const answerId = `story-${chapter.id}-${target}`
    questions.push({
      id: `${chapter.id}:story-event:${slot}`,
      prompt: slot === 0
        ? 'کدام اتفاق واقعاً در همین فصل رخ می‌دهد؟'
        : 'کدام اتفاق نزدیک پایان همین فصل رخ می‌دهد؟',
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
    prompt: 'کدام اتفاق زودتر از بقیه در قصه رخ می‌دهد؟',
    optionDir: 'ltr',
    options: sequenceOptions,
    answerId: `sentence-${earliest}`,
  })

  questions.push({
    id: `${chapter.id}:sequence:last`,
    prompt: 'کدام اتفاق دیرتر از بقیه در قصه رخ می‌دهد؟',
    optionDir: 'ltr',
    options: [...sequenceOptions].sort((a, b) => seededRank(`${chapter.id}:sequence:last`, a.id) - seededRank(`${chapter.id}:sequence:last`, b.id)),
    answerId: `sentence-${latest}`,
  })

  const nextAnchor = Math.max(0, Math.min(chapter.sentences.length - 2, Math.round(chapter.sentences.length * 0.45)))
  const nextTarget = nextAnchor + 1
  questions.push({
    id: `${chapter.id}:sequence:next`,
    prompt: 'بعد از این جمله، چه اتفاقی می‌افتد؟',
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
    prompt: 'پیش از این جمله، چه اتفاقی می‌افتد؟',
    context: chapter.sentences[previousAnchor].en,
    contextDir: 'ltr',
    optionDir: 'ltr',
    options: sentenceOptions(chapter, 'en', previousTarget, `${chapter.id}:sequence:previous`),
    answerId: `sentence-${previousTarget}`,
  })

  return questions.slice(0, READING_QUESTION_COUNT)
}
