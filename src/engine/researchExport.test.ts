import { describe, expect, it } from 'vitest'
import { buildResearchExport } from './researchExport'
import { blankWordProgress } from './review'
import { emptyState } from './store'

describe('research export', () => {
  it('exports learning evidence without raw dates, recordings or answer text', () => {
    const now = new Date(2026, 8, 29, 12, 0, 0).getTime()
    const state = emptyState(now - 3 * 86_400_000, 'b1c1')
    state.words.demo = {
      ...blankWordProgress(now - 2 * 86_400_000),
      reviewStage: 2, reviewCorrect: 3, reviewWrong: 1,
      successDays: ['2026-09-27', '2026-09-29'],
      productiveSuccessDays: ['2026-09-29'],
      lastReviewedAt: now, lastIndependentSuccessAt: now, dueAt: now + 86_400_000,
    }
    const exported = buildResearchExport(state, now)
    const json = JSON.stringify(exported)
    expect(exported.courseAgeDays).toBe(3)
    expect(exported.words).toHaveLength(1)
    expect(json).not.toContain('2026-09-29')
    expect(json).not.toContain('lastReviewedAt')
    expect(json).not.toContain('firstSeenAt')
    expect(json).not.toContain('dueAt')
    expect(json).not.toContain('audio')
    expect(json).not.toContain('typed')
  })
})
