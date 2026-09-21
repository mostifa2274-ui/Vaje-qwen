import type { Chapter, WordEntry } from './types'

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

function uniqueSentenceIndices(chapter: Chapter, field: 'en' | 'fa'): number[] {
  const seen = new Set<string>()
  const out: number[] = []
  chapter.sentences.forEach((sentence, index) => {
    const surface = sentence[field].trim().toLowerCase()
    if (!surface || seen.has(surface)) return
    seen.add(surface)
    out.push(index)
  })
  return out
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

function sequenceAnchorIndices(chapter: Chapter): number[] {
  const indices = uniqueSentenceIndices(chapter, 'en')
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
): ReadingQuestion[] {
  const questions: ReadingQuestion[] = [...authoredQuestions(chapter, wordById)]
  const enIndices = uniqueSentenceIndices(chapter, 'en')
  const faIndices = uniqueSentenceIndices(chapter, 'fa')
  const usedEn = new Set<number>()
  const usedFa = new Set<number>()

  for (const [slot, fraction] of [0.2, 0.5, 0.8].entries()) {
    const target = targetIndex(enIndices, fraction, usedEn)
    questions.push({
      id: `${chapter.id}:meaning-en:${slot}`,
      prompt: 'کدام جملهٔ انگلیسی دقیقاً این معنی را می‌رساند؟',
      context: chapter.sentences[target].fa,
      contextDir: 'rtl',
      optionDir: 'ltr',
      options: sentenceOptions(chapter, 'en', target, `${chapter.id}:meaning-en:${slot}`),
      answerId: `sentence-${target}`,
    })
  }

  for (const [slot, fraction] of [0.34, 0.68].entries()) {
    const target = targetIndex(faIndices, fraction, usedFa)
    questions.push({
      id: `${chapter.id}:meaning-fa:${slot}`,
      prompt: 'این جمله در قصه چه معنایی دارد؟',
      context: chapter.sentences[target].en,
      contextDir: 'ltr',
      optionDir: 'rtl',
      options: sentenceOptions(chapter, 'fa', target, `${chapter.id}:meaning-fa:${slot}`),
      answerId: `sentence-${target}`,
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

  return questions.slice(0, 10)
}
