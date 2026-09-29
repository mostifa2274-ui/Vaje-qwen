import { describe, expect, it } from 'vitest'
import { CHAPTERS } from '../data/chapters'
import { emptyState, importStateJson, mergeConcurrentState } from './store'
import { blankWordProgress, recordRetrieval } from './review'
import { recordLeitnerReview } from './leitner'
import { answerCount, creditGradedEffort, dailyProgress, mergeActivity, mergeLeitnerDays, normalizeActivity, recordActivity, streakMessage } from './activity'
import { dayKey } from './days'
import { consolidationFocus, nextBestAction } from './analytics'
import { bookWordIds } from './bookTestSize'
import type { GhesseState } from './types'

// Noon on fixed local days, so day arithmetic is independent of the run time.
const at = (day: number, hour = 12) => new Date(2026, 2, 10 + day, hour, 0, 0).getTime()

function fresh(): GhesseState {
  return emptyState(at(-30), CHAPTERS[0].id)
}

describe('daily goal and streak', () => {
  it('counts every graded answer that progress records, whichever screen gave it', () => {
    const base = fresh()
    const id = CHAPTERS[0].new[0]
    let next: GhesseState = { ...base, words: { ...base.words, [id]: recordRetrieval(blankWordProgress(at(0)), true, 'reverse', at(0), 'review') } }
    next = { ...next, leitner: recordLeitnerReview(next.leitner, id, 'good', at(0)) }
    next = { ...next, chapters: { ...next.chapters, b1c1: { prepAttempts: 1, preparedAt: at(0), prepWrittenTotal: 10, prepListeningTotal: 10, completed: false, checksCorrect: 0, checksTotal: 0, reads: 0 } } }
    expect(answerCount(next) - answerCount(base)).toBe(22)
    const credited = recordActivity(next, base, at(0))
    expect(credited.activity).toEqual({ [dayKey(at(0))]: 22 })
    // Settings changes and removals credit nothing.
    expect(recordActivity({ ...credited, soundOn: false }, credited, at(0))).toEqual({ ...credited, soundOn: false })
    expect(recordActivity(base, next, at(0)).activity).toEqual({})
  })

  it('credits corrective relearning as effort without creating fake mastery evidence', () => {
    const base = fresh()
    const id = CHAPTERS[0].new[0]
    const progress = blankWordProgress(at(0))
    const wrong = recordRetrieval(progress, false, 'productive', at(0), 'review')
    const relearned = recordRetrieval(wrong, true, 'productive', at(0) + 30_000, 'relearn')

    expect(relearned.reviewCorrect).toBe(wrong.reviewCorrect)
    expect(relearned.productiveCorrect).toBe(wrong.productiveCorrect)
    expect(relearned.successDays).toEqual(wrong.successDays)
    expect(answerCount({ ...base, words: { [id]: relearned } }) - answerCount({ ...base, words: { [id]: wrong } })).toBe(0)

    const credited = creditGradedEffort({ ...base, words: { [id]: relearned } }, at(0), 1)
    expect(dailyProgress(credited, at(0)).today).toBe(1)

    // App-level automatic accounting sees no mastery-answer delta here, so it
    // leaves the explicit effort credit intact instead of double-counting it.
    const afterAppAccounting = recordActivity(credited, { ...base, words: { [id]: wrong } }, at(0))
    expect(dailyProgress(afterAppAccounting, at(0)).today).toBe(1)
  })

  it('keeps a streak alive until the end of the day and breaks it after a missed day', () => {
    const state = { ...fresh(), dailyReviewGoal: 15 }
    state.activity = { [dayKey(at(-3))]: 15, [dayKey(at(-2))]: 20, [dayKey(at(-1))]: 30, [dayKey(at(0))]: 4 }
    expect(dailyProgress(state, at(0))).toEqual({ today: 4, goal: 15, met: false, streak: 3 })
    state.activity[dayKey(at(0))] = 15
    expect(dailyProgress(state, at(0))).toEqual({ today: 15, goal: 15, met: true, streak: 4 })
    // A day below the goal breaks the chain.
    state.activity[dayKey(at(-2))] = 14
    expect(dailyProgress(state, at(0)).streak).toBe(2)
    expect(dailyProgress(state, at(2)).streak).toBe(0)
    expect(streakMessage(1)).toContain('اولین روز')
    expect(streakMessage(7)).toContain('یک هفتهٔ کامل')
    expect(streakMessage(12)).toContain('۱۲ روز پیاپی')
  })

  it('repairs stored logs, survives import and adds up across two tabs', () => {
    expect(normalizeActivity({ [dayKey(at(0))]: 12.7, junk: 3, [dayKey(at(-1))]: -2, [dayKey(at(-500))]: 9 }, at(0))).toEqual({ [dayKey(at(0))]: 12 })
    const imported = importStateJson(JSON.stringify({ ...fresh(), activity: undefined }), at(0), CHAPTERS[0].id)
    expect(imported.activity).toEqual({})

    const today = dayKey(at(0))
    expect(mergeActivity({ [today]: 10 }, { [today]: 14 }, { [today]: 13 })).toEqual({ [today]: 17 })
    const day = { reviewed: 2, correct: 1, added: 1 }
    expect(mergeLeitnerDays({ [today]: day }, { [today]: { reviewed: 5, correct: 3, added: 2 } }, { [today]: { reviewed: 4, correct: 4, added: 1 } }))
      .toEqual({ [today]: { reviewed: 7, correct: 6, added: 2 } })

    // Two tabs studying on the same day no longer conflict.
    const base = { ...fresh(), activity: { [today]: 5 } }
    const local = { ...base, activity: { [today]: 9 }, leitner: recordLeitnerReview(base.leitner, CHAPTERS[0].new[0], 'good', at(0)) }
    const remote = { ...base, activity: { [today]: 8 }, leitner: recordLeitnerReview(base.leitner, CHAPTERS[0].new[1], 'again', at(0)) }
    const merged = mergeConcurrentState(base, local, remote)!
    expect(merged.activity[today]).toBe(12)
    expect(merged.leitner.days[today]).toEqual({ reviewed: 2, correct: 1, added: 2 })
  })
})

describe('book consolidation on the path', () => {
  function finishedBook1(): GhesseState {
    const state = fresh()
    for (const chapter of CHAPTERS.filter(ch => ch.book === 1)) {
      state.chapters[chapter.id] = { preparedAt: at(-1), prepAttempts: 1, completed: true, checksCorrect: 10, checksTotal: 10, reads: 1 }
      for (const id of chapter.new) state.words[id] = { ...blankWordProgress(at(-1)), dueAt: at(9) }
    }
    return state
  }

  it('asks for consolidation reviews, then to come back tomorrow, then for the test', () => {
    const state = finishedBook1()
    const ids = bookWordIds(1)
    let action = nextBestAction(state, at(0))
    expect(action).toMatchObject({ kind: 'review', title: 'تثبیت واژه‌های کتاب ۱', progress: { done: 0, total: ids.length } })
    expect(consolidationFocus(state, at(0))).toMatchObject({ book: 1, blocking: true })

    // Everything proven except words taught today.
    const today = ids.slice(0, 3)
    for (const id of ids) {
      state.words[id] = today.includes(id)
        ? { ...state.words[id], firstSeenAt: at(0, 9) }
        : recordRetrieval(state.words[id], true, 'reverse', at(0), 'review')
    }
    action = nextBestAction(state, at(0))
    expect(action).toMatchObject({ kind: 'rest', progress: { done: ids.length - 3, total: ids.length } })

    for (const id of today) state.words[id] = recordRetrieval(state.words[id], true, 'reverse', at(1), 'review')
    expect(consolidationFocus(state, at(1))).toBeUndefined()
    expect(nextBestAction(state, at(1))).toMatchObject({ kind: 'exam', examId: 'book-1' })
  })
})
