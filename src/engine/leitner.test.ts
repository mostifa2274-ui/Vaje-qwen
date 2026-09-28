import { describe, expect, it } from 'vitest'
import { CHAPTERS, VOCAB } from '../data/chapters'
import { blankWordProgress } from './review'
import { emptyState, importStateJson, mergeConcurrentState } from './store'
import {
  BOX_INTERVAL_DAYS,
  LEITNER_BOXES,
  SESSION_LIMIT,
  boxCounts,
  buildSession,
  cardFace,
  dayKey,
  dueForecast,
  gradeCard,
  isDue,
  leitnerSummary,
  newCardOrder,
  normalizeLeitner,
  recordLeitnerReview,
  scopeWordIds,
  startOfDay,
  streakDays,
  typedAnswerCorrect,
} from './leitner'
import type { GhesseState, LeitnerScope } from './types'

// Noon on a fixed local day, so day arithmetic is independent of the run time.
const NOON = new Date(2026, 2, 10, 12, 0, 0).getTime()
const DAY = 24 * 60 * 60 * 1000
const days = (count: number) => new Date(2026, 2, 10 + count, 12, 0, 0).getTime()

function fresh(): GhesseState {
  return emptyState(1, CHAPTERS[0].id)
}

describe('Leitner boxes', () => {
  it('covers every course word, in teaching order', () => {
    const state = fresh()
    const all = scopeWordIds('all', state)
    expect(all).toHaveLength(VOCAB.length)
    expect(new Set(all).size).toBe(VOCAB.length)
    expect(all.slice(0, CHAPTERS[0].new.length)).toEqual([...new Set(CHAPTERS[0].new)].slice(0, CHAPTERS[0].new.length))
    const byBook = [1, 2, 3, 4, 5, 6, 7, 8].reduce((sum, book) => sum + scopeWordIds(`book-${book}` as LeitnerScope, state).length, 0)
    expect(byBook).toBe(VOCAB.length)
    expect(scopeWordIds('learned', state)).toEqual([])
  })

  it('moves a remembered card up one box and waits twice as long each time', () => {
    let card = gradeCard(undefined, 'good', NOON)
    expect(card.box).toBe(2)
    expect(card.dueAt).toBe(startOfDay(days(2)))
    for (let box = 3; box <= LEITNER_BOXES; box++) {
      card = gradeCard(card, 'good', NOON)
      expect(card.box).toBe(box)
      expect(card.dueAt).toBe(startOfDay(days(BOX_INTERVAL_DAYS[box - 1])))
    }
    // The last box keeps its card.
    expect(gradeCard(card, 'good', NOON).box).toBe(LEITNER_BOXES)
    expect(card).toMatchObject({ reviews: 5, correct: 5, lapses: 0 })
  })

  it('sends a forgotten card back to box 1 and keeps a hard one where it is', () => {
    const inBox4 = { box: 4, dueAt: NOON, addedAt: 1, reviews: 3, correct: 3, lapses: 0 }
    expect(gradeCard(inBox4, 'again', NOON)).toMatchObject({ box: 1, dueAt: startOfDay(days(1)), reviews: 4, correct: 3, lapses: 1 })
    expect(gradeCard(inBox4, 'hard', NOON)).toMatchObject({ box: 4, dueAt: startOfDay(days(1)), correct: 4, lapses: 0 })
  })

  it('treats a card as due for the whole of its due day', () => {
    const card = gradeCard(undefined, 'again', NOON)
    expect(isDue(card, NOON)).toBe(false)
    expect(isDue(card, startOfDay(days(1)))).toBe(true)
    expect(isDue(card, days(1) + 11 * 60 * 60 * 1000)).toBe(true)
  })

  it('logs each day and counts the streak', () => {
    let leitner = fresh().leitner
    const [first, second] = VOCAB
    leitner = recordLeitnerReview(leitner, first.id, 'good', days(-2))
    leitner = recordLeitnerReview(leitner, second.id, 'again', days(-1))
    leitner = recordLeitnerReview(leitner, first.id, 'good', NOON)
    expect(leitner.days[dayKey(days(-1))]).toEqual({ reviewed: 1, correct: 0, added: 1 })
    expect(leitner.days[dayKey(NOON)]).toEqual({ reviewed: 1, correct: 1, added: 0 })
    expect(streakDays(leitner, NOON)).toBe(3)
    // A streak survives until the end of the next day, then breaks.
    expect(streakDays(leitner, days(1))).toBe(3)
    expect(streakDays(leitner, days(2))).toBe(0)
  })

  it('builds a session of due cards first, lowest box first, with new cards mixed in', () => {
    let state = fresh()
    const ids = scopeWordIds('all', state)
    // Six started cards: two due in box 3, one in box 1, three not due yet.
    const cards = {
      [ids[0]]: { box: 3, dueAt: days(-1), addedAt: 1, reviews: 2, correct: 2, lapses: 0 },
      [ids[1]]: { box: 1, dueAt: NOON, addedAt: 1, reviews: 1, correct: 0, lapses: 0 },
      [ids[2]]: { box: 3, dueAt: days(-3), addedAt: 1, reviews: 2, correct: 2, lapses: 0 },
      [ids[3]]: { box: 2, dueAt: days(2), addedAt: 1, reviews: 1, correct: 1, lapses: 0 },
      [ids[4]]: { box: 5, dueAt: days(9), addedAt: 1, reviews: 4, correct: 4, lapses: 0 },
      [ids[5]]: { box: 6, dueAt: days(20), addedAt: 1, reviews: 5, correct: 5, lapses: 0 },
    }
    state = { ...state, leitner: { ...state.leitner, cards, settings: { ...state.leitner.settings, newPerDay: 5 } } }
    const session = buildSession(state, NOON)
    expect(session.slice(0, 3)).toEqual([ids[1], ids[2], ids[0]])
    expect(session).toHaveLength(8)
    expect(session[3]).toBe(ids[6])
    expect(session.slice(4)).toEqual([ids[7], ids[8], ids[9], ids[10]])

    const summary = leitnerSummary(state, NOON)
    expect(summary).toMatchObject({ due: 3, newToday: 5, started: 6, mastered: 1, total: VOCAB.length, reviewedToday: 0 })
    expect(boxCounts(state, ids)).toEqual([VOCAB.length - 6, 1, 1, 2, 0, 1, 1])
    expect(dueForecast(state, ids, NOON, 7)).toEqual([3, 0, 1, 0, 0, 0, 0])
  })

  it('offers words met in the course before unmet ones, and respects the daily new-card limit', () => {
    let state = fresh()
    const ids = scopeWordIds('all', state)
    const met = ids.slice(100, 103)
    for (const id of met) state.words[id] = { ...blankWordProgress(1), introduced: true }
    expect(newCardOrder(state, ids).slice(0, 4)).toEqual([...met, ids[0]])
    expect(scopeWordIds('learned', state)).toEqual(met)

    state = { ...state, leitner: { ...state.leitner, settings: { ...state.leitner.settings, newPerDay: 10 } } }
    for (const id of ids.slice(0, 8)) state = { ...state, leitner: recordLeitnerReview(state.leitner, id, 'good', NOON) }
    expect(buildSession(state, NOON)).toHaveLength(2)
    expect(buildSession(state, days(1))).toHaveLength(10)
    // A long backlog of due cards leaves no room for new ones.
    const cards = Object.fromEntries(ids.slice(0, SESSION_LIMIT + 5).map(id => [id, { box: 1, dueAt: NOON, addedAt: 1, reviews: 1, correct: 0, lapses: 0 }]))
    const busy = { ...state, leitner: { ...state.leitner, cards, days: {} } }
    expect(buildSession(busy, NOON)).toHaveLength(SESSION_LIMIT)
  })

  it('checks typed answers in both directions', () => {
    const word = VOCAB.find(item => item.word === 'chicken')!
    expect(typedAnswerCorrect('faEn', word.id, ' Chicken ')).toBe(true)
    expect(typedAnswerCorrect('listen', word.id, 'chickens')).toBe(false)
    expect(typedAnswerCorrect('enFa', word.id, word.fa.split(/[،,؛;/]/)[0])).toBe(true)
    expect(typedAnswerCorrect('enFa', word.id, '')).toBe(false)
    const article = VOCAB.find(item => item.word === 'a, an')!
    expect(typedAnswerCorrect('faEn', article.id, 'an')).toBe(true)
    expect(typedAnswerCorrect('faEn', VOCAB.find(item => item.word === 'ice cream')!.id, 'ice  cream')).toBe(true)
  })

  it('rotates faces in mixed mode, and never asks to listen without sound', () => {
    const faces = new Set(VOCAB.slice(0, 60).map(word => cardFace('mixed', word.id, 0, true)))
    expect(faces).toEqual(new Set(['enFa', 'faEn', 'listen']))
    expect(VOCAB.slice(0, 60).some(word => cardFace('mixed', word.id, 0, false) === 'listen')).toBe(false)
    expect(cardFace('listen', VOCAB[0].id, 0, false)).toBe('enFa')
  })

  it('repairs stored decks and keeps them through import and a concurrent tab', () => {
    const [first, second] = VOCAB
    const repaired = normalizeLeitner({
      cards: {
        [first.id]: { box: 9, dueAt: NOON, addedAt: NOON, reviews: 2, correct: 7, lapses: -1 },
        unknown: { box: 1, dueAt: NOON },
        [second.id]: { box: 2 },
      },
      settings: { direction: 'sideways', scope: 'book-3', newPerDay: 7, typed: true },
      days: { [dayKey(NOON)]: { reviewed: 3, correct: 9, added: 1 }, junk: { reviewed: 1 } },
    }, NOON, new Set(VOCAB.map(word => word.id)))
    expect(repaired.cards).toEqual({ [first.id]: { box: LEITNER_BOXES, dueAt: NOON, addedAt: NOON, reviews: 2, correct: 2, lapses: 0 } })
    expect(repaired.settings).toEqual({ direction: 'enFa', scope: 'book-3', newPerDay: 10, typed: true })
    expect(repaired.days).toEqual({ [dayKey(NOON)]: { reviewed: 3, correct: 3, added: 1 } })

    // Older backups without a deck import with an empty one.
    const imported = importStateJson(JSON.stringify({ ...fresh(), leitner: undefined }), NOON, CHAPTERS[0].id)
    expect(imported.leitner.cards).toEqual({})

    // Two tabs studying different cards merge; the same card studied
    // differently in both is a conflict.
    const base = fresh()
    const local = { ...base, leitner: recordLeitnerReview(base.leitner, first.id, 'good', NOON) }
    const remote = { ...base, leitner: { ...base.leitner, cards: { [second.id]: gradeCard(undefined, 'again', NOON + DAY / 24) } } }
    const merged = mergeConcurrentState(base, local, remote)!
    expect(Object.keys(merged.leitner.cards).sort()).toEqual([first.id, second.id].sort())
    const clash = { ...base, leitner: recordLeitnerReview(base.leitner, first.id, 'again', NOON) }
    expect(mergeConcurrentState(base, local, clash)).toBeUndefined()
  })
})
