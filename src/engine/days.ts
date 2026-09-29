// Calendar days on the learner's own clock.

/** Local calendar day, YYYY-MM-DD. Keys sort in date order. */
export function dayKey(time: number): string {
  const date = new Date(time)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function startOfDay(time: number): number {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** The start of the local day `days` days after `time`. */
export function dayStartAfter(time: number, days: number): number {
  const date = new Date(startOfDay(time))
  date.setDate(date.getDate() + days)
  return date.getTime()
}

export function isDayKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** Minimum elapsed time before a retrieval can count as delayed consolidation. */
export const MIN_CONSOLIDATION_DELAY_MS = 8 * 60 * 60 * 1000

/**
 * Earliest instant that can count as delayed evidence for something first seen
 * at `firstSeenAt`: both the next local calendar day and at least eight real
 * hours must have elapsed. This prevents a 23:58 -> 00:03 review from being
 * treated as overnight consolidation while remaining DST-safe.
 */
export function consolidationEligibleAt(firstSeenAt: number): number {
  return Math.max(dayStartAfter(firstSeenAt, 1), firstSeenAt + MIN_CONSOLIDATION_DELAY_MS)
}

export function isDelayedLearningEvidence(firstSeenAt: number, evidenceAt: number): boolean {
  return evidenceAt >= consolidationEligibleAt(firstSeenAt)
    && dayKey(evidenceAt) > dayKey(firstSeenAt)
}
