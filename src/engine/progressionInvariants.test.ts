import { describe, expect, it } from 'vitest'
import { CHAPTERS } from '../data/chapters'
import { MIDPOINT_EXAM_ID, bookExamId, canPrepareChapter, canReadChapter, canTakeExam } from './gates'
import { emptyState } from './store'

describe('progression gate invariants', () => {
  it('fails closed across malformed preparation-count combinations', () => {
    const chapter = CHAPTERS[0]
    const required = chapter.new.length
    expect(required).toBeGreaterThan(1)

    // Deterministically sweep hundreds of imported/corrupted combinations,
    // including negative-like normalized boundaries, partial totals and values
    // larger than the real assignment. Only the exact 100%/100% state may read.
    for (let seed = 0; seed < 512; seed++) {
      const state = emptyState(1, chapter.id)
      const writtenTotal = (seed * 17) % (required + 5)
      const writtenCorrect = (seed * 29 + 3) % (required + 5)
      const listeningTotal = (seed * 31 + 1) % (required + 5)
      const listeningCorrect = (seed * 43 + 2) % (required + 5)
      const exact = writtenTotal === required
        && writtenCorrect === required
        && listeningTotal === required
        && listeningCorrect === required

      state.chapters[chapter.id] = {
        preparedAt: 10,
        prepAttempts: 1,
        prepWrittenCorrect: writtenCorrect,
        prepWrittenTotal: writtenTotal,
        prepListeningCorrect: listeningCorrect,
        prepListeningTotal: listeningTotal,
        completed: false,
        checksCorrect: 0,
        checksTotal: 0,
        reads: 0,
      }

      expect(canReadChapter(state, chapter.id)).toBe(exact)
    }
  })

  it('never lets a passed previous-book record substitute for missing earlier chapters', () => {
    const state = emptyState(1, 'b1c1')
    state.exams[bookExamId(1)] = {
      attempts: 1,
      passed: true,
      passedAt: 2,
      lastAttemptAt: 2,
      lastScore: 1,
      bestScore: 1,
      lastProductiveScore: 1,
      bestProductiveScore: 1,
      missedWordIds: [],
      testedWordIds: [],
    }

    expect(canPrepareChapter(state, 'b2c1')).toBe(false)
  })

  it('never lets cumulative exam records substitute for missing chapter completion', () => {
    const state = emptyState(1, 'b1c1')
    const passed = {
      attempts: 1,
      passed: true,
      passedAt: 2,
      lastAttemptAt: 2,
      lastScore: 1,
      bestScore: 1,
      lastProductiveScore: 1,
      bestProductiveScore: 1,
      missedWordIds: [],
      testedWordIds: [],
    }
    for (const book of [1, 2, 3, 4]) state.exams[bookExamId(book)] = { ...passed }

    expect(canTakeExam(state, MIDPOINT_EXAM_ID)).toBe(false)
  })

  it('never lets a perfectly forged later chapter skip its unfinished predecessor', () => {
    const first = CHAPTERS[0]
    const second = CHAPTERS[1]
    expect(second.book).toBe(first.book)

    const state = emptyState(1, first.id)
    const required = second.new.length
    state.chapters[second.id] = {
      preparedAt: 10,
      prepAttempts: 1,
      prepWrittenCorrect: required,
      prepWrittenTotal: required,
      prepListeningCorrect: required,
      prepListeningTotal: required,
      completed: false,
      checksCorrect: 0,
      checksTotal: 0,
      reads: 0,
    }

    expect(canPrepareChapter(state, second.id)).toBe(false)
    expect(canReadChapter(state, second.id)).toBe(false)
  })
})
