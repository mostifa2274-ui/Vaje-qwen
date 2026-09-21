import type { GhesseState, Chapter, SkillDimension, WordProgress } from './types'

export type MasteryLevel = 'new' | 'seen' | 'learning' | 'strong' | 'mastered'

export let containment: Map<string, Set<string>> = new Map()

export function setContainment(c: Map<string, Set<string>>): void {
  containment = c
}

export function chapterContains(ch: Chapter, wordId: string): boolean {
  return containment.get(ch.id)?.has(wordId) ?? ch.new.includes(wordId)
}

export function completedExposures(wordId: string, state: GhesseState, chapters: Chapter[]): number {
  let exposures = 0
  for (const ch of chapters) {
    const progress = state.chapters[ch.id]
    if (!progress?.completed || !chapterContains(ch, wordId)) continue
    exposures += Math.max(1, progress.reads)
  }
  return exposures
}

function daySpan(days: string[]): number {
  if (days.length < 2) return 0
  const first = Date.parse(`${days[0]}T00:00:00Z`)
  const last = Date.parse(`${days[days.length - 1]}T00:00:00Z`)
  if (!Number.isFinite(first) || !Number.isFinite(last)) return 0
  return Math.floor((last - first) / 86_400_000)
}


function skillAccuracy(progress: WordProgress, dimension: SkillDimension): number {
  const stat = progress.skillStats?.[dimension] ?? { correct: 0, wrong: 0 }
  const total = stat.correct + stat.wrong
  return total ? stat.correct / total : 0
}

function skillCorrect(progress: WordProgress, dimension: SkillDimension): number {
  return progress.skillStats?.[dimension]?.correct ?? 0
}

export function skillCoverage(progress: WordProgress): number {
  const dimensions: SkillDimension[] = ['meaning', 'context', 'production', 'form']
  const covered = dimensions.filter(d => skillCorrect(progress, d) > 0).length
  return covered / dimensions.length
}

export function recallAccuracy(progress: WordProgress): number {
  const total = progress.reviewCorrect + progress.reviewWrong
  return total ? progress.reviewCorrect / total : 0
}

export interface MasteryEvidence {
  level: MasteryLevel
  accuracy: number
  successDays: number
  productiveDays: number
  spanDays: number
  intervalDays: number
  stage: number
}

export function masteryEvidence(wordId: string, state: GhesseState): MasteryEvidence {
  const word = state.words[wordId]
  if (!word?.introduced) {
    return { level: 'new', accuracy: 0, successDays: 0, productiveDays: 0, spanDays: 0, intervalDays: 0, stage: 0 }
  }
  if (word.reviewCorrect === 0 && word.reviewWrong === 0) {
    return { level: 'seen', accuracy: 0, successDays: 0, productiveDays: 0, spanDays: 0, intervalDays: word.intervalDays, stage: word.reviewStage }
  }

  const successDays = word.successDays ?? []
  const productiveDays = word.productiveSuccessDays ?? []
  const span = daySpan(successDays)
  const accuracy = recallAccuracy(word)
  const allSkillsCovered = skillCoverage(word) === 1
  const skillFloor = (['meaning', 'context', 'production', 'form'] as SkillDimension[])
    .every(dimension => skillAccuracy(word, dimension) >= 0.67)
  const mastered =
    word.reviewStage >= 5 &&
    successDays.length >= 4 &&
    productiveDays.length >= 2 &&
    span >= 14 &&
    word.lastReviewWasCorrect !== false &&
    word.intervalDays >= 30 &&
    accuracy >= 0.8 &&
    allSkillsCovered &&
    skillFloor &&
    skillCorrect(word, 'production') >= 2

  let level: MasteryLevel
  if (mastered) level = 'mastered'
  else if (
    word.reviewStage >= 3 &&
    successDays.length >= 2 &&
    productiveDays.length >= 1 &&
    word.lastReviewWasCorrect !== false &&
    accuracy >= 0.7 &&
    skillCoverage(word) >= 0.75
  ) level = 'strong'
  else level = 'learning'

  return {
    level,
    accuracy,
    successDays: successDays.length,
    productiveDays: productiveDays.length,
    spanDays: span,
    intervalDays: word.intervalDays,
    stage: word.reviewStage,
  }
}

export function wordMastery(wordId: string, state: GhesseState): MasteryLevel {
  return masteryEvidence(wordId, state).level
}

export function masteryWeight(level: MasteryLevel): number {
  switch (level) {
    case 'mastered': return 1
    case 'strong': return 0.75
    case 'learning': return 0.4
    case 'seen': return 0.15
    default: return 0
  }
}

export function chapterMastery(ch: Chapter, state: GhesseState): number {
  if (ch.new.length === 0) return 1
  return ch.new.reduce((sum, id) => sum + masteryWeight(wordMastery(id, state)), 0) / ch.new.length
}

export function masteryCounts(state: GhesseState, ids: string[]): Record<MasteryLevel, number> {
  const counts: Record<MasteryLevel, number> = { new: 0, seen: 0, learning: 0, strong: 0, mastered: 0 }
  for (const id of ids) counts[wordMastery(id, state)]++
  return counts
}

export function durableCoverage(state: GhesseState, ids: string[]): number {
  if (ids.length === 0) return 0
  const counts = masteryCounts(state, ids)
  return (counts.mastered + counts.strong) / ids.length
}

export function masteredCoverage(state: GhesseState, ids: string[]): number {
  if (ids.length === 0) return 0
  return masteryCounts(state, ids).mastered / ids.length
}