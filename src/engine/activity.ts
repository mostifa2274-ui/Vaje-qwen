import { dayKey, dayStartAfter, isDayKey, latestPlausibleDayKey } from './days'
import type { GhesseState, LeitnerDay } from './types'

// A daily goal and a streak built on effort, not on scores: a day counts when
// the learner gave the day's goal of answers, whatever they were. Answers are
// counted from what progress records, so every screen contributes without
// knowing about the goal.

/** Days kept in the log: enough for a long streak and a year's calendar. */
export const ACTIVITY_LOG_DAYS = 400
const MAX_DAY_ANSWERS = 100_000

/**
 * Graded answers recorded in progress: review and test answers, story
 * questions, chapter preparation (both tests, counted when they are passed),
 * chapter listening questions and flashcards.
 */
export function answerCount(state: GhesseState): number {
  let total = 0
  for (const word of Object.values(state.words)) total += word.reviewCorrect + word.reviewWrong + word.checkCorrect + word.checkWrong
  for (const chapter of Object.values(state.chapters)) {
    total += (chapter.prepWrittenTotal ?? 0) + (chapter.prepListeningTotal ?? 0) + (chapter.listeningTotal ?? 0)
    if (chapter.prepDiagnosticPassed) total += (chapter.prepDiagnosticTotal ?? 0) * 2
  }
  for (const card of Object.values(state.leitner.cards)) total += card.reviews
  return total
}

/** Credits today with the answers `next` records beyond `previous`. */
export function recordActivity(next: GhesseState, previous: GhesseState, now: number): GhesseState {
  const added = answerCount(next) - answerCount(previous)
  if (added <= 0) return next
  const key = dayKey(now)
  return { ...next, activity: pruneActivity({ ...next.activity, [key]: Math.min(MAX_DAY_ANSWERS, (next.activity[key] ?? 0) + added) }, now) }
}

/**
 * Credits graded effort that intentionally does not mutate mastery evidence.
 * The main example is a correct relearning answer after corrective feedback:
 * it should count toward the effort goal, but must not become an independent
 * recall observation or train the scheduler.
 */
export function creditGradedEffort(state: GhesseState, now: number, count = 1): GhesseState {
  const added = Math.max(0, Math.floor(count))
  if (!added) return state
  const key = dayKey(now)
  return {
    ...state,
    activity: pruneActivity({
      ...state.activity,
      [key]: Math.min(MAX_DAY_ANSWERS, (state.activity[key] ?? 0) + added),
    }, now),
  }
}

export interface DailyProgress {
  /** Answers given today. */
  today: number
  goal: number
  met: boolean
  /** Consecutive days with the goal met, ending today, or yesterday while today is still open. */
  streak: number
}

export function dailyProgress(state: GhesseState, now: number): DailyProgress {
  const goal = state.dailyReviewGoal
  const today = state.activity[dayKey(now)] ?? 0
  const met = today >= goal
  let streak = 0
  for (let offset = met ? 0 : 1; offset <= ACTIVITY_LOG_DAYS; offset++) {
    if ((state.activity[dayKey(dayStartAfter(now, -offset))] ?? 0) < goal) break
    streak++
  }
  return { today, goal, met, streak }
}

function pruneActivity(activity: Record<string, number>, now: number): Record<string, number> {
  const oldest = dayKey(dayStartAfter(now, -ACTIVITY_LOG_DAYS))
  const newest = latestPlausibleDayKey(now)
  const result: Record<string, number> = {}
  for (const [key, value] of Object.entries(activity)) if (key >= oldest && key <= newest) result[key] = value
  return result
}

/** Keeps only valid day entries from stored or imported progress. */
export function normalizeActivity(raw: unknown, now: number): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const result: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isDayKey(key) || typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue
    result[key] = Math.min(MAX_DAY_ANSWERS, Math.floor(value))
  }
  return pruneActivity(result, now)
}

/**
 * Counts from two tabs add up: each keeps what the other recorded since their
 * common base, so studying in two tabs never conflicts.
 */
export function mergeActivity(base: Record<string, number>, local: Record<string, number>, remote: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = { ...remote }
  for (const [key, value] of Object.entries(local)) {
    const added = value - (base[key] ?? 0)
    if (added > 0) result[key] = Math.min(MAX_DAY_ANSWERS, (result[key] ?? 0) + added)
  }
  return result
}

/** The Leitner day log adds up across tabs the same way. */
export function mergeLeitnerDays(base: Record<string, LeitnerDay>, local: Record<string, LeitnerDay>, remote: Record<string, LeitnerDay>): Record<string, LeitnerDay> {
  const result: Record<string, LeitnerDay> = { ...remote }
  for (const [key, day] of Object.entries(local)) {
    const before = base[key] ?? { reviewed: 0, correct: 0, added: 0 }
    const into = result[key] ?? { reviewed: 0, correct: 0, added: 0 }
    const reviewed = Math.max(0, day.reviewed - before.reviewed)
    const correct = Math.max(0, day.correct - before.correct)
    const added = Math.max(0, day.added - before.added)
    if (reviewed || correct || added) result[key] = { reviewed: into.reviewed + reviewed, correct: into.correct + correct, added: into.added + added }
  }
  return result
}

/** What the goal celebration says for a streak of this length. */
export function streakMessage(streak: number): string {
  const days = String(streak).replace(/\d/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])
  if (streak >= 365) return `یک سال کامل، ${days} روز پیاپی! شگفت‌انگیز است.`
  if (streak >= 100) return `${days} روز پیاپی! این دیگر یک عادت واقعی است.`
  if (streak === 30) return 'یک ماه کامل پیاپی! واژه‌ها دارند ماندگار می‌شوند.'
  if (streak === 7) return 'یک هفتهٔ کامل پیاپی! آفرین.'
  if (streak > 1) return `${days} روز پیاپی؛ فردا هم ادامه بده.`
  return 'اولین روز از روزهای پیاپی‌ات؛ فردا دومی را بساز.'
}
