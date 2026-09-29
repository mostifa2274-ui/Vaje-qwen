import { describe, expect, it } from 'vitest'
import { consolidationEligibleAt, dayKey, isDelayedLearningEvidence, MIN_CONSOLIDATION_DELAY_MS } from './days'
import { isConsolidated } from './consolidation'
import { blankWordProgress, recordRetrieval } from './review'

describe('learner-local delayed evidence', () => {
  it('does not count a few minutes across midnight as consolidation', () => {
    const first = new Date(2026, 8, 29, 23, 58, 0, 0).getTime()
    const fiveMinutesLater = first + 5 * 60_000
    expect(dayKey(fiveMinutesLater)).not.toBe(dayKey(first))
    expect(isDelayedLearningEvidence(first, fiveMinutesLater)).toBe(false)
  })

  it('requires both a later local day and at least eight elapsed hours', () => {
    const first = new Date(2026, 8, 29, 23, 0, 0, 0).getTime()
    const sevenHours = first + 7 * 60 * 60_000
    const eightHours = first + MIN_CONSOLIDATION_DELAY_MS
    expect(isDelayedLearningEvidence(first, sevenHours)).toBe(false)
    expect(isDelayedLearningEvidence(first, eightHours)).toBe(true)
    expect(consolidationEligibleAt(first)).toBe(eightHours)
  })

  it('also rejects a long same-day interval before the local date changes', () => {
    const first = new Date(2026, 8, 29, 8, 0, 0, 0).getTime()
    const tenHours = first + 10 * 60 * 60_000
    expect(dayKey(tenHours)).toBe(dayKey(first))
    expect(isDelayedLearningEvidence(first, tenHours)).toBe(false)
  })

  it('uses the delayed rule for book consolidation evidence', () => {
    const first = new Date(2026, 8, 29, 23, 58, 0, 0).getTime()
    const progress = blankWordProgress(first)
    expect(isConsolidated({ ...progress, lastIndependentSuccessAt: first + 5 * 60_000 })).toBe(false)
    expect(isConsolidated({ ...progress, lastIndependentSuccessAt: consolidationEligibleAt(first) })).toBe(true)
  })

  it('records success-day evidence with the same learner-local day key', () => {
    const first = new Date(2026, 8, 29, 9, 0, 0, 0).getTime()
    const later = new Date(2026, 8, 30, 10, 0, 0, 0).getTime()
    const progress = recordRetrieval(blankWordProgress(first), true, 'productive', later, 'review', 5_000)
    expect(progress.successDays).toContain(dayKey(later))
    expect(progress.productiveSuccessDays).toContain(dayKey(later))
  })
})
