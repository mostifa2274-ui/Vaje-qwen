import { describe, expect, it } from 'vitest'
import { emptyState } from './store'
import { blankWordProgress } from './review'
import { masteryNextRequirementFa, wordMastery } from './mastery'

describe('learner-facing mastery explanations', () => {
  it('explains untouched and taught-only words without implying mastery', () => {
    const state = emptyState(1, 'b1c1')
    expect(wordMastery('book', state)).toBe('new')
    expect(masteryNextRequirementFa('book', state)).toContain('ابتدا')

    state.words.book = blankWordProgress(1)
    expect(wordMastery('book', state)).toBe('seen')
    expect(masteryNextRequirementFa('book', state)).toContain('اولین بازیابی مستقل')
  })

  it('points a learning word to its next missing observable evidence', () => {
    const state = emptyState(1, 'b1c1')
    state.words.book = {
      ...blankWordProgress(1),
      reviewStage: 2,
      reviewCorrect: 2,
      reviewWrong: 0,
      lastReviewWasCorrect: true,
      successDays: ['2026-09-01'],
      skillStats: {
        meaning: { correct: 2, wrong: 0 },
        context: { correct: 1, wrong: 0 },
        production: { correct: 0, wrong: 0 },
        form: { correct: 0, wrong: 0 },
      },
    }

    expect(wordMastery('book', state)).toBe('learning')
    expect(masteryNextRequirementFa('book', state)).toContain('۲ روز متفاوت')
  })

  it('keeps a strong word focused on durable evidence until mastery', () => {
    const state = emptyState(1, 'b1c1')
    state.words.book = {
      ...blankWordProgress(1),
      reviewStage: 4,
      reviewCorrect: 8,
      reviewWrong: 1,
      lastReviewWasCorrect: true,
      intervalDays: 21,
      successDays: ['2026-09-01', '2026-09-04', '2026-09-08'],
      productiveSuccessDays: ['2026-09-04'],
      productiveCorrect: 2,
      skillStats: {
        meaning: { correct: 2, wrong: 0 },
        context: { correct: 2, wrong: 0 },
        production: { correct: 2, wrong: 0 },
        form: { correct: 2, wrong: 0 },
      },
    }

    expect(wordMastery('book', state)).toBe('strong')
    expect(masteryNextRequirementFa('book', state)).toContain('۴ روز متفاوت')
  })

  it('labels genuinely durable evidence as maintenance, not another unlock task', () => {
    const state = emptyState(1, 'b1c1')
    state.words.book = {
      ...blankWordProgress(1),
      reviewStage: 5,
      reviewCorrect: 12,
      reviewWrong: 1,
      lastReviewWasCorrect: true,
      intervalDays: 30,
      successDays: ['2026-09-01', '2026-09-05', '2026-09-10', '2026-09-16'],
      productiveSuccessDays: ['2026-09-05', '2026-09-16'],
      productiveCorrect: 3,
      skillStats: {
        meaning: { correct: 3, wrong: 0 },
        context: { correct: 3, wrong: 0 },
        production: { correct: 3, wrong: 0 },
        form: { correct: 3, wrong: 0 },
      },
    }

    expect(wordMastery('book', state)).toBe('mastered')
    expect(masteryNextRequirementFa('book', state)).toContain('نگهداری حافظه')
  })
})
