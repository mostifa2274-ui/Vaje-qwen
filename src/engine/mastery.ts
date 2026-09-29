import type { GhesseState, Chapter, SkillDimension, WordProgress } from './types'

export type MasteryLevel = 'new' | 'seen' | 'learning' | 'strong' | 'mastered'

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

/**
 * Learner-facing explanation for the next evidence gap. This intentionally
 * describes observable learning evidence instead of exposing scheduler math or
 * implying that one successful session equals mastery.
 */
export function masteryNextRequirementFa(wordId: string, state: GhesseState): string {
  const word = state.words[wordId]
  const evidence = masteryEvidence(wordId, state)

  if (!word?.introduced) return 'ابتدا این واژه را در فصل مربوط یاد بگیر.'
  if (evidence.level === 'seen') return 'اولین بازیابی مستقل را در مرور هوشمند انجام بده.'
  if (word.lastReviewWasCorrect === false) return 'یک بازیابی مستقلِ درست لازم است تا روند دوباره رو به جلو برود.'

  const accuracy = recallAccuracy(word)
  const productionCorrect = skillCorrect(word, 'production')
  const coveredSkills = skillCoverage(word)

  if (evidence.level === 'learning') {
    if (evidence.successDays < 2) return 'این واژه را در دست‌کم ۲ روز متفاوت، بدون کمک درست به یاد بیاور.'
    if (evidence.productiveDays < 1) return 'دست‌کم یک بار واژه را از حافظه به‌صورت تولیدی بنویس.'
    if (accuracy < 0.7) return 'دقت بازیابی را با مرورهای مستقل بیشتر به دست‌کم ۷۰٪ برسان.'
    if (coveredSkills < 0.75) return 'برای دست‌کم ۳ مهارتِ معنی، بافت، تولید و املاء شواهد موفق بساز.'
    return 'مرورهای فاصله‌دار را ادامه بده تا شواهد کافی برای سطح «قوی» جمع شود.'
  }

  if (evidence.level === 'strong') {
    if (evidence.successDays < 4) return 'برای تسلط، بازیابی موفق را در دست‌کم ۴ روز متفاوت ثبت کن.'
    if (evidence.productiveDays < 2) return 'برای تسلط، در دست‌کم ۲ روز متفاوت بازیابی تولیدیِ درست لازم است.'
    if (evidence.spanDays < 14) return 'برای تسلط، شواهد موفق باید دست‌کم ۱۴ روز را پوشش دهد.'
    if (evidence.intervalDays < 30) return 'مرورهای فاصله‌دار را ادامه بده تا فاصلهٔ مرور پایدارتر و بلندتر شود.'
    if (accuracy < 0.8) return 'برای تسلط، دقت بازیابی مستقل باید دست‌کم ۸۰٪ باشد.'
    if (coveredSkills < 1) return 'برای تسلط، هر چهار مهارتِ معنی، بافت، تولید و املاء باید شواهد موفق داشته باشند.'
    const weakSkill = (['meaning', 'context', 'production', 'form'] as SkillDimension[])
      .find(dimension => skillAccuracy(word, dimension) < 0.67)
    if (weakSkill) {
      const label = weakSkill === 'meaning'
        ? 'معنی'
        : weakSkill === 'context'
          ? 'بافت'
          : weakSkill === 'production'
            ? 'تولید فعال'
            : 'املاء و فرم'
      return `دقت مهارت «${label}» را با مرورهای مستقل بیشتر به دست‌کم ۶۷٪ برسان.`
    }
    if (productionCorrect < 2) return 'برای تسلط، دست‌کم ۲ بازیابی تولیدیِ درست لازم است.'
    return 'چند مرور فاصله‌دار دیگر لازم است تا همهٔ معیارهای تسلط پایدار کامل شود.'
  }

  return 'معیارهای فعلی تسلط پایدار کامل است؛ مرورهای سررسید را برای نگهداری حافظه ادامه بده.'
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