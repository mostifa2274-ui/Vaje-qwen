import type { RetrievalMode, SkillDimension, WordEntry, WordProgress } from './types'
import { forgottenStability, inferFsrsGrade, initialDifficulty, initialStability, intervalForRetention, nextDifficulty, retrievability, sameDayStability, successfulStability } from './fsrs'
import { differentlySpelledHomophones, soundsAlike } from './homophones'

export type ReviewMode = RetrievalMode
export type ReviewSource = 'review' | 'exam' | 'relearn'

export function isTypedMode(mode: ReviewMode): boolean {
  return mode === 'productive' || mode === 'contextProductive' || mode === 'spelling'
}

const DAY = 86_400_000

export interface ReviewQuestion {
  wordId: string
  mode: ReviewMode
  prompt: string
  promptDir: 'rtl' | 'ltr'
  options?: Array<{ id: string; label: string }>
  answerId: string
  acceptedAnswers: string[]
  audioCue?: boolean
  /**
   * Persian meaning shown beside an audio-only prompt whose sound another
   * deck word shares with a different spelling (right/write), so the learner
   * knows which spelling is asked for.
   */
  hintFa?: string
}

function clamp(min: number, max: number, value: number): number {
  return Math.max(min, Math.min(max, value))
}

// FSRS can legitimately recommend very long intervals after a handful of
// fast Easy grades. For an A1 acquisition course we deliberately cap early
// intervals so a new word must survive several consolidation milestones
// before it can disappear for months. Once mature, yearly maintenance is the
// longest interval used by Ghesse.
function consolidationCeiling(stage: number): number {
  const ceilings = [1, 2, 5, 10, 21, 45, 90, 180, 365, 365]
  return ceilings[Math.max(0, Math.min(ceilings.length - 1, stage))]
}

export function blankWordProgress(now: number): WordProgress {
  return {
    introduced: true,
    taps: 0,
    checkCorrect: 0,
    checkWrong: 0,
    firstSeenAt: now,
    reviewStage: 0,
    reviewCorrect: 0,
    reviewWrong: 0,
    reviewStreak: 0,
    intervalDays: 0,
    productiveCorrect: 0,
    successDays: [],
    productiveSuccessDays: [],
    difficulty: 5,
    stabilityDays: 0,
    lapses: 0,
    retrievalMsTotal: 0,
    retrievalMsCount: 0,
    skillStats: {
      meaning: { correct: 0, wrong: 0 },
      context: { correct: 0, wrong: 0 },
      production: { correct: 0, wrong: 0 },
      form: { correct: 0, wrong: 0 },
    },
  }
}

export function normalizeTypedAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .replace(/[.!?]+$/g, '')
}

export function acceptedAnswers(word: WordEntry): string[] {
  const raw = word.word.trim()
  const candidates = raw === 'a, an'
    ? ['a', 'an', 'a, an']
    : [raw]
  return [...new Set(candidates.map(normalizeTypedAnswer).filter(Boolean))]
}

export function isTypedCorrect(input: string, word: WordEntry): boolean {
  const normalized = normalizeTypedAnswer(input)
  return acceptedAnswers(word).includes(normalized)
}

export function isQuestionTypedCorrect(input: string, question: Pick<ReviewQuestion, 'acceptedAnswers'>): boolean {
  return question.acceptedAnswers.includes(normalizeTypedAnswer(input))
}

function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10)
}

export function modeForStage(stage: number): ReviewMode {
  if (stage <= 0) return 'recognition'
  if (stage === 1) return 'reverse'
  if (stage === 2) return 'cloze'
  if (stage === 3) return 'productive'
  if (stage === 4) return 'contextProductive'
  return 'spelling'
}

export function dimensionForMode(mode: ReviewMode): SkillDimension {
  if (mode === 'recognition' || mode === 'reverse') return 'meaning'
  if (mode === 'cloze' || mode === 'contextProductive') return 'context'
  if (mode === 'spelling') return 'form'
  return 'production'
}

function statAccuracy(correct: number, wrong: number): number {
  const total = correct + wrong
  return total ? correct / total : 0
}

function dimensionNeed(progress: WordProgress, dimension: SkillDimension): number {
  const stat = progress.skillStats?.[dimension] ?? { correct: 0, wrong: 0 }
  const total = stat.correct + stat.wrong
  const minimum: Record<SkillDimension, number> = { meaning: 3, context: 2, production: 2, form: 1 }
  const coverageGap = Math.max(0, minimum[dimension] - total)
  const errorPressure = total ? (1 - statAccuracy(stat.correct, stat.wrong)) * 5 : 2.5
  const recencyBonus = progress.lastErrorMode && dimensionForMode(progress.lastErrorMode) === dimension ? 2.5 : 0
  return coverageGap * 2 + errorPressure + recencyBonus
}

/**
 * Select the next retrieval mode from the learner's weakest evidence channel.
 * Recognition is intentionally front-loaded; later reviews rotate through
 * semantic recall, contextual production, free production, and spelling.
 */
export function modeForProgress(progress: WordProgress): ReviewMode {
  if (progress.reviewStage <= 0) return 'recognition'
  if (progress.reviewStage === 1) return 'reverse'
  if (progress.reviewStage === 2) return 'cloze'

  const dimensions: SkillDimension[] = ['production', 'context', 'form', 'meaning']
  const weakest = [...dimensions].sort((a, b) => dimensionNeed(progress, b) - dimensionNeed(progress, a))[0]
  if (weakest === 'production') return 'productive'
  if (weakest === 'context') return progress.reviewStage >= 4 ? 'contextProductive' : 'cloze'
  if (weakest === 'form') return 'spelling'
  return 'reverse'
}

export function averageResponseMs(progress: WordProgress): number | undefined {
  return progress.retrievalMsCount > 0 ? progress.retrievalMsTotal / progress.retrievalMsCount : undefined
}

/**
 * Approximate probability of recall now. stabilityDays is defined as the
 * interval at which expected recall is about 90%; this is a display/priority
 * signal, not a claim of psychometric precision.
 */
export function retentionEstimate(progress: WordProgress, now: number): number {
  if (!progress.lastReviewedAt || progress.stabilityDays <= 0) return 0
  const elapsedDays = Math.max(0, (now - progress.lastReviewedAt) / DAY)
  return retrievability(progress.stabilityDays, elapsedDays)
}

function updatedSkillStats(progress: WordProgress, mode: ReviewMode, correct: boolean): WordProgress['skillStats'] {
  const base = progress.skillStats ?? {
    meaning: { correct: 0, wrong: 0 },
    context: { correct: 0, wrong: 0 },
    production: { correct: 0, wrong: 0 },
    form: { correct: 0, wrong: 0 },
  }
  const dimension = dimensionForMode(mode)
  const current = base[dimension] ?? { correct: 0, wrong: 0 }
  return {
    ...base,
    [dimension]: {
      correct: current.correct + (correct ? 1 : 0),
      wrong: current.wrong + (correct ? 0 : 1),
    },
  }
}

export function recordRetrieval(
  progress: WordProgress,
  correct: boolean,
  mode: ReviewMode,
  now: number,
  source: ReviewSource = 'review',
  elapsedMs?: number,
): WordProgress {
  // Relearning after corrective feedback is pedagogically useful but is not
  // an independent memory observation. It must not train FSRS, inflate skill
  // accuracy, create success days, or stack additional lapses.
  if (source === 'relearn') {
    return {
      ...progress,
      // Keep the existing due time but do not update FSRS difficulty,
      // stability, skill accuracy, lapse count or independent recall history.
      dueAt: progress.dueAt ?? now + 10 * 60_000,
    }
  }

  const day = utcDay(now)
  const next: WordProgress = {
    ...progress,
    reviewCorrect: progress.reviewCorrect + (correct ? 1 : 0),
    reviewWrong: progress.reviewWrong + (correct ? 0 : 1),
    reviewStreak: correct ? progress.reviewStreak + 1 : 0,
    lastReviewedAt: now,
    lastCheckAt: now,
    lastReviewWasCorrect: correct,
    lastMode: mode,
    successDays: [...progress.successDays],
    productiveSuccessDays: [...(progress.productiveSuccessDays ?? [])],
    retrievalMsTotal: progress.retrievalMsTotal + (elapsedMs && elapsedMs > 0 ? Math.min(elapsedMs, 120_000) : 0),
    retrievalMsCount: progress.retrievalMsCount + (elapsedMs && elapsedMs > 0 ? 1 : 0),
    skillStats: updatedSkillStats(progress, mode, correct),
    lastErrorMode: correct ? progress.lastErrorMode : mode,
  }

  if (correct) {
    next.lastIndependentSuccessAt = now
    if (progress.lastErrorMode && dimensionForMode(progress.lastErrorMode) === dimensionForMode(mode)) next.lastErrorMode = undefined
    const isNewSuccessDay = !next.successDays.includes(day)
    if (isNewSuccessDay) next.successDays.push(day)
    next.successDays.sort()

    if (mode === 'productive' || mode === 'contextProductive' || mode === 'spelling') {
      next.productiveCorrect = progress.productiveCorrect + 1
      if (!next.productiveSuccessDays.includes(day)) next.productiveSuccessDays.push(day)
      next.productiveSuccessDays.sort()
    }

    // Same-day independent practice is valid evidence for skill accuracy but
    // cannot advance spacing. Only a new successful day can increase stage.
    if (isNewSuccessDay) {
      const inferredGrade = inferFsrsGrade(true, mode, elapsedMs)
      // A fast answer during initial acquisition is encouraging, but it is
      // not enough evidence to skip consolidation. Reserve Easy for mature
      // words that have already survived several spaced reviews.
      const grade = inferredGrade === 4 && progress.reviewStage < 5 ? 3 : inferredGrade
      const elapsedDays = progress.lastReviewedAt ? Math.max(0, (now - progress.lastReviewedAt) / DAY) : 0
      const currentR = progress.stabilityDays > 0 ? retrievability(progress.stabilityDays, elapsedDays) : 0
      const modelDifficulty = progress.stabilityDays > 0
        ? nextDifficulty(progress.difficulty, grade)
        : clamp(1, 10, initialDifficulty(grade) * 0.75 + progress.difficulty * 0.25)
      const modelStability = progress.stabilityDays <= 0
        ? initialStability(grade)
        : elapsedDays < 1
          ? sameDayStability(progress.stabilityDays, grade)
          : successfulStability(progress.stabilityDays, modelDifficulty, currentR, grade)
      const desiredRetention = isTroubleWord(progress) ? 0.93 : 0.9
      const nextStage = Math.min(8, progress.reviewStage + 1)
      const fsrsInterval = Math.max(1, Math.round(intervalForRetention(modelStability, desiredRetention)))
      const interval = Math.min(365, fsrsInterval, consolidationCeiling(nextStage))
      next.reviewStage = nextStage
      next.intervalDays = interval
      next.stabilityDays = modelStability
      next.dueAt = now + interval * DAY
      next.difficulty = modelDifficulty
    } else if (progress.dueAt !== undefined && progress.dueAt <= now) {
      // It does close today's relearning, though. A word that lapsed after an
      // earlier success today comes back tomorrow, when a correct answer is
      // new spaced evidence, instead of staying due for the rest of the day.
      next.dueAt = now + DAY
    }
  } else {
    const grade = inferFsrsGrade(false, mode, elapsedMs)
    const elapsedDays = progress.lastReviewedAt ? Math.max(0, (now - progress.lastReviewedAt) / DAY) : 0
    const currentR = progress.stabilityDays > 0 ? retrievability(progress.stabilityDays, elapsedDays) : 0
    const modelDifficulty = progress.stabilityDays > 0
      ? nextDifficulty(progress.difficulty, grade)
      : clamp(1, 10, initialDifficulty(grade) * 0.75 + progress.difficulty * 0.25)
    next.reviewStage = Math.max(0, progress.reviewStage - 2)
    next.intervalDays = 0
    next.stabilityDays = progress.stabilityDays > 0
      ? forgottenStability(progress.stabilityDays, modelDifficulty, currentR)
      : initialStability(1)
    next.difficulty = modelDifficulty
    next.lapses = progress.lapses + 1
    next.dueAt = now + (source === 'exam' ? 0 : progress.lapses >= 2 ? 5 * 60_000 : 10 * 60_000)
  }
  return next
}

export function scheduleAfterChapter(progress: WordProgress, now: number): WordProgress {
  const due = now + DAY
  return {
    ...progress,
    introduced: true,
    dueAt: progress.dueAt === undefined ? due : Math.min(progress.dueAt, due),
  }
}

function accuracy(progress: WordProgress): number {
  const total = progress.reviewCorrect + progress.reviewWrong
  return total ? progress.reviewCorrect / total : 1
}

export function isTroubleWord(progress: WordProgress): boolean {
  const attempts = progress.reviewCorrect + progress.reviewWrong
  return progress.introduced && attempts >= 3 && (
    progress.lapses >= 2 ||
    progress.difficulty >= 7.5 ||
    (attempts >= 5 && accuracy(progress) < 0.65)
  )
}

export function troubleWordIds(words: Record<string, WordProgress>): string[] {
  return Object.entries(words)
    .filter(([, progress]) => isTroubleWord(progress))
    .sort((a, b) => b[1].difficulty - a[1].difficulty || b[1].lapses - a[1].lapses)
    .map(([id]) => id)
}

function reviewPriority(progress: WordProgress, now: number): number {
  const overdueDays = progress.dueAt ? Math.max(0, (now - progress.dueAt) / DAY) : 0
  const attempts = progress.reviewCorrect + progress.reviewWrong
  const missRate = attempts ? progress.reviewWrong / attempts : 0
  const productiveGap = progress.reviewStage >= 3 && (progress.productiveSuccessDays?.length ?? 0) === 0 ? 2 : 0
  return overdueDays * 2.5 + progress.lapses * 2 + progress.difficulty * 0.35 + missRate * 4 + productiveGap - progress.reviewStage * 0.15
}

export function dueWordIds(words: Record<string, WordProgress>, now: number): string[] {
  return Object.entries(words)
    .filter(([, p]) => p.introduced && p.dueAt !== undefined && p.dueAt <= now)
    .sort((a, b) => reviewPriority(b[1], now) - reviewPriority(a[1], now) || (a[1].dueAt ?? 0) - (b[1].dueAt ?? 0))
    .map(([id]) => id)
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededRank(seed: string, id: string): number {
  return hashString(`${seed}:${id}`)
}

function uniqueDistractors(
  target: WordEntry,
  vocab: WordEntry[],
  label: (word: WordEntry) => string,
  seed: string,
): WordEntry[] {
  const targetLabel = label(target).trim().toLowerCase()
  const used = new Set([targetLabel])
  // Prefer same part of speech and topic because plausible distractors make
  // recognition tests diagnostic instead of trivial visual elimination.
  //
  // Only the four best unique labels from each priority bucket can possibly
  // affect the final three distractors: at most the target plus two labels
  // selected from earlier buckets can collide. Keeping a bounded shortlist
  // avoids sorting the full 899-word vocabulary for every question.
  type Ranked = { word: WordEntry; surface: string; rank: number }
  const buckets: Ranked[][] = [[], [], [], []]

  const keepBest = (bucket: Ranked[], candidate: Ranked) => {
    const duplicate = bucket.findIndex(item => item.surface === candidate.surface)
    if (duplicate >= 0) {
      if (candidate.rank < bucket[duplicate].rank) bucket[duplicate] = candidate
    } else if (bucket.length < 4) {
      bucket.push(candidate)
    } else {
      let worst = 0
      for (let i = 1; i < bucket.length; i++) if (bucket[i].rank > bucket[worst].rank) worst = i
      if (candidate.rank < bucket[worst].rank) bucket[worst] = candidate
    }
    bucket.sort((a, b) => a.rank - b.rank)
  }

  for (const word of vocab) {
    if (word.id === target.id) continue
    const surface = label(word).trim().toLowerCase()
    if (!surface || surface === targetLabel) continue
    const bucketIndex =
      word.pos === target.pos && word.topic === target.topic ? 0 :
      word.pos === target.pos ? 1 :
      word.topic === target.topic ? 2 : 3
    keepBest(buckets[bucketIndex], { word, surface, rank: seededRank(seed, word.id) })
  }

  const out: WordEntry[] = []
  for (const bucket of buckets) {
    for (const candidate of bucket) {
      if (used.has(candidate.surface)) continue
      used.add(candidate.surface)
      out.push(candidate.word)
      if (out.length === 3) return out
    }
  }
  return out
}

function shuffleOptions<T extends { id: string }>(items: T[], seed: string): T[] {
  return [...items].sort((a, b) => seededRank(seed, a.id) - seededRank(seed, b.id))
}

function contextSurface(word: WordEntry): { prompt: string; accepted: string[] } | undefined {
  const base = word.word.trim()
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const candidates = [escaped]
  if (!/[\s,]/.test(base)) {
    candidates.push(`${escaped}s`, `${escaped}es`, `${escaped}ed`, `${escaped}ing`)
    if (/y$/i.test(base)) candidates.push(`${escaped.slice(0, -1)}ies`)
    if (/e$/i.test(base)) candidates.push(`${escaped.slice(0, -1)}ing`)
  }
  for (const candidate of [...new Set(candidates)].sort((a, b) => b.length - a.length)) {
    const regex = new RegExp(`\\b${candidate}\\b`, 'i')
    const match = word.ex.match(regex)
    if (!match) continue
    return {
      prompt: word.ex.replace(regex, '_____'),
      accepted: [normalizeTypedAnswer(match[0])],
    }
  }
  return undefined
}

function clozePrompt(word: WordEntry): string {
  return contextSurface(word)?.prompt ?? `${word.fa} → _____`
}

export function buildReviewQuestion(
  target: WordEntry,
  vocab: WordEntry[],
  mode: ReviewMode,
  seed: string,
): ReviewQuestion {
  if (mode === 'productive') {
    return {
      wordId: target.id,
      mode,
      prompt: target.fa,
      promptDir: 'rtl',
      answerId: target.id,
      acceptedAnswers: acceptedAnswers(target),
    }
  }

  if (mode === 'contextProductive') {
    const context = contextSurface(target)
    return {
      wordId: target.id,
      mode,
      prompt: context?.prompt ?? `${target.fa} → _____`,
      promptDir: context ? 'ltr' : 'rtl',
      answerId: target.id,
      acceptedAnswers: context?.accepted ?? acceptedAnswers(target),
    }
  }

  if (mode === 'spelling') {
    return {
      wordId: target.id,
      mode,
      prompt: 'به واژه گوش کن و آن را به انگلیسی بنویس.',
      promptDir: 'rtl',
      answerId: target.id,
      acceptedAnswers: acceptedAnswers(target),
      audioCue: true,
      hintFa: differentlySpelledHomophones(target, vocab).length > 0 ? target.fa : undefined,
    }
  }

  if (mode === 'reverse') {
    const distractors = uniqueDistractors(target, vocab, w => w.fa, seed)
    const options = shuffleOptions(
      [target, ...distractors].map(word => ({ id: word.id, label: word.fa })),
      `${seed}:options`,
    )
    const duplicateSurface = vocab.some(word => word.id !== target.id && normalizeTypedAnswer(word.word) === normalizeTypedAnswer(target.word))
    return {
      wordId: target.id,
      mode,
      prompt: duplicateSurface && target.ex ? target.ex : target.word,
      promptDir: 'ltr',
      options,
      answerId: target.id,
      acceptedAnswers: acceptedAnswers(target),
    }
  }

  const distractors = uniqueDistractors(target, vocab, w => w.word, seed)
  const options = shuffleOptions(
    [target, ...distractors].map(word => ({ id: word.id, label: word.word })),
    `${seed}:options`,
  )
  return {
    wordId: target.id,
    mode,
    prompt: mode === 'cloze' ? clozePrompt(target) : target.fa,
    promptDir: mode === 'cloze' ? 'ltr' : 'rtl',
    options,
    answerId: target.id,
    acceptedAnswers: acceptedAnswers(target),
  }
}

/**
 * Meaning options for a word the learner only hears. A deck word that sounds
 * the same (right/write, the two "like" entries) is never offered beside it,
 * because the audio alone cannot tell them apart.
 */
export function listeningChoiceOptions(target: WordEntry, vocab: WordEntry[], seed: string): Array<{ id: string; label: string }> {
  const pool = vocab.filter(word => word.id === target.id || !soundsAlike(word, target))
  return buildReviewQuestion(target, pool, 'reverse', seed).options ?? []
}

function weaknessScore(progress: WordProgress | undefined): number {
  if (!progress) return 100
  const attempts = progress.reviewCorrect + progress.reviewWrong
  const missRate = attempts ? progress.reviewWrong / attempts : 0
  const skillNeed = (['meaning', 'context', 'production', 'form'] as SkillDimension[])
    .reduce((sum, dimension) => sum + dimensionNeed(progress, dimension), 0) / 4
  return (8 - progress.reviewStage) * 2 + progress.difficulty + progress.lapses * 2.5 + missRate * 5 + skillNeed + ((progress.productiveSuccessDays?.length ?? 0) === 0 ? 2 : 0)
}

export function selectWeakestWordIds(
  ids: string[],
  words: Record<string, WordProgress>,
  count: number,
  seed: string,
): string[] {
  return [...new Set(ids)]
    .sort((a, b) => weaknessScore(words[b]) - weaknessScore(words[a]) || seededRank(seed, a) - seededRank(seed, b))
    .slice(0, count)
}

export function seededSample(ids: string[], count: number, seed: string): string[] {
  return [...new Set(ids)]
    .sort((a, b) => seededRank(seed, a) - seededRank(seed, b))
    .slice(0, count)
}