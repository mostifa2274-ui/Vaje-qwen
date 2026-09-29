import { describe, expect, it } from 'vitest'
import { CHAPTERS, VOCAB } from '../data/chapters'
import { canPrepareChapter } from './gates'
import { blankWordProgress } from './review'
import { emptyState, importStateJson, mergeConcurrentState } from './store'

function seeded(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 0x1_0000_0000
  }
}

describe('adversarial state invariants', () => {
  it('merges independent learning records without fabricating or dropping either side', () => {
    const random = seeded(0x475345)
    const ids = VOCAB.slice(0, 24).map(word => word.id)

    for (let sample = 0; sample < 100; sample++) {
      const base = emptyState(1_000_000 + sample, CHAPTERS[0].id)
      const localId = ids[Math.floor(random() * ids.length)]
      let remoteId = ids[Math.floor(random() * ids.length)]
      if (remoteId === localId) remoteId = ids[(ids.indexOf(localId) + 1) % ids.length]

      const local = {
        ...base,
        words: {
          ...base.words,
          [localId]: { ...blankWordProgress(2_000_000 + sample), reviewCorrect: 1 + sample % 3 },
        },
      }
      const remote = {
        ...base,
        words: {
          ...base.words,
          [remoteId]: { ...blankWordProgress(3_000_000 + sample), reviewWrong: 1 + sample % 2 },
        },
      }

      const merged = mergeConcurrentState(base, local, remote)
      expect(merged).toBeDefined()
      expect(merged?.words[localId]).toEqual(local.words[localId])
      expect(merged?.words[remoteId]).toEqual(remote.words[remoteId])

      const reverse = mergeConcurrentState(base, remote, local)
      expect(reverse?.words).toEqual(merged?.words)
    }
  })

  it('rejects divergent edits to the same atomic learning record', () => {
    const base = emptyState(1, CHAPTERS[0].id)
    const id = VOCAB[0].id
    const original = blankWordProgress(10)
    base.words[id] = original

    const local = {
      ...base,
      words: { ...base.words, [id]: { ...original, reviewCorrect: 2, lastReviewedAt: 20 } },
    }
    const remote = {
      ...base,
      words: { ...base.words, [id]: { ...original, reviewWrong: 1, lastReviewedAt: 30 } },
    }

    expect(mergeConcurrentState(base, local, remote)).toBeUndefined()
  })

  it('normalizes hostile backup values and filters unknown ids instead of trusting imported mastery', () => {
    const raw = {
      ...emptyState(100, CHAPTERS[0].id),
      narratorRate: 999,
      dailyReviewGoal: 999,
      currentChapter: 'not-a-chapter',
      words: {
        [VOCAB[0].id]: {
          introduced: true,
          reviewStage: 999,
          reviewCorrect: -200,
          reviewWrong: -5,
          intervalDays: 999999,
          difficulty: -100,
          stabilityDays: 999999,
          productiveCorrect: -2,
          successDays: ['2026-09-01', 'bad-day', '2026-09-01'],
          productiveSuccessDays: ['bad-day'],
        },
        '__unknown_word__': { introduced: true, reviewStage: 8, reviewCorrect: 999 },
      },
      chapters: {
        '__unknown_chapter__': { completed: true, reads: 999 },
      },
    }

    const state = importStateJson(
      JSON.stringify(raw),
      200,
      CHAPTERS[0].id,
      CHAPTERS.map(chapter => chapter.id),
      VOCAB.map(word => word.id),
    )

    const word = state.words[VOCAB[0].id]
    expect(state.currentChapter).toBe(CHAPTERS[0].id)
    expect(state.words.__unknown_word__).toBeUndefined()
    expect(state.chapters.__unknown_chapter__).toBeUndefined()
    expect(state.narratorRate).toBe(1.1)
    expect(state.dailyReviewGoal).toBe(15)
    expect(word.reviewStage).toBe(8)
    expect(word.reviewCorrect).toBe(0)
    expect(word.intervalDays).toBe(3650)
    expect(word.difficulty).toBe(1)
    expect(word.stabilityDays).toBe(3650)
    expect(word.productiveCorrect).toBe(0)
    expect(word.successDays).toEqual(['2026-09-01'])
    expect(word.productiveSuccessDays).toEqual([])
  })

  it('never allows a sparse imported state to skip chapters or cross a book boundary', () => {
    const state = emptyState(1, CHAPTERS[0].id)
    const second = CHAPTERS[1]
    const firstOfBook2 = CHAPTERS.find(chapter => chapter.book === 2)!
    expect(canPrepareChapter(state, second.id)).toBe(false)
    expect(canPrepareChapter(state, firstOfBook2.id)).toBe(false)

    // Even forging a later chapter complete does not satisfy the ordered gate.
    state.chapters[second.id] = {
      prepAttempts: 1,
      completed: true,
      completedAt: 2,
      checksCorrect: 10,
      checksTotal: 10,
      reads: 1,
    }
    expect(canPrepareChapter(state, firstOfBook2.id)).toBe(false)
  })
})
