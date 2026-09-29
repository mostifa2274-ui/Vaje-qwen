import { bookWordIds } from './bookTestSize'
import { dayKey } from './days'
import type { GhesseState, WordProgress } from './types'

// A book's words are consolidated when each one has been recalled without
// help on a later day than it was taught. Recall after a night's sleep is what
// predicts that a word stays learned; a same-day success mostly measures
// short-term memory. Every word of a book must pass this before the book's
// test opens, so no word reaches the next book on a single day's evidence.

/** Recalled without help on a later local day than it was taught. */
export function isConsolidated(progress: WordProgress | undefined): boolean {
  if (!progress?.introduced || progress.lastIndependentSuccessAt === undefined) return false
  // Progress from before first-seen times were kept counts any recall.
  if (progress.firstSeenAt === undefined) return true
  return dayKey(progress.lastIndependentSuccessAt) > dayKey(progress.firstSeenAt)
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
  const today = dayKey(now)
  const ids = bookWordIds(book)
  const ready: string[] = []
  const waiting: string[] = []
  let consolidated = 0
  for (const id of ids) {
    const progress = state.words[id]
    if (isConsolidated(progress)) consolidated++
    else if (!progress?.introduced) continue
    else if (progress.firstSeenAt !== undefined && dayKey(progress.firstSeenAt) >= today) waiting.push(id)
    else ready.push(id)
  }
  return { book, total: ids.length, consolidated, ready, waiting }
}

export function bookConsolidated(state: GhesseState, book: number): boolean {
  const ids = bookWordIds(book)
  return ids.length > 0 && ids.every(id => isConsolidated(state.words[id]))
}
