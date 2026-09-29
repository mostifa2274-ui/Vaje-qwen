import { bookWordIds } from './bookTestSize'
import { consolidationEligibleAt, isDelayedLearningEvidence } from './days'
import type { GhesseState, WordProgress } from './types'

// A book's words are consolidated only after genuinely delayed independent
// retrieval. A local date boundary alone is not enough: evidence must occur on
// a later learner-local day and at least eight real hours after first exposure.
// This prevents a few minutes around midnight from masquerading as overnight
// retention while keeping the rule understandable and DST-safe.

/** Recalled without help on a later local day than it was taught. */
export function isConsolidated(progress: WordProgress | undefined): boolean {
  if (!progress?.introduced || progress.lastIndependentSuccessAt === undefined) return false
  // Progress from before first-seen times were kept counts any independent recall.
  if (progress.firstSeenAt === undefined) return true
  return isDelayedLearningEvidence(progress.firstSeenAt, progress.lastIndependentSuccessAt)
}

export interface BookConsolidation {
  book: number
  total: number
  consolidated: number
  /** Taught before today and not yet proven: today's review can prove them. */
  ready: string[]
  /** Taught today: they can be proven from tomorrow. */
  waiting: string[]
}

export function bookConsolidation(state: GhesseState, book: number, now: number): BookConsolidation {
  const ids = bookWordIds(book)
  const ready: string[] = []
  const waiting: string[] = []
  let consolidated = 0
  for (const id of ids) {
    const progress = state.words[id]
    if (isConsolidated(progress)) consolidated++
    else if (!progress?.introduced) continue
    else if (progress.firstSeenAt !== undefined && now < consolidationEligibleAt(progress.firstSeenAt)) waiting.push(id)
    else ready.push(id)
  }
  return { book, total: ids.length, consolidated, ready, waiting }
}

export function bookConsolidated(state: GhesseState, book: number): boolean {
  const ids = bookWordIds(book)
  return ids.length > 0 && ids.every(id => isConsolidated(state.words[id]))
}
