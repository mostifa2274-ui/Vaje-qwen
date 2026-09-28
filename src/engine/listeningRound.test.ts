import { beforeEach, describe, expect, it } from 'vitest'
import { CHAPTER_LISTENING } from '../data/chapterListening'
import {
  checkListeningRound,
  chooseListeningAnswer,
  clearListeningDraft,
  emptyListeningRound,
  listeningCheckResult,
  listeningRoundDone,
  listeningRoundReady,
  listeningTextSignature,
  loadListeningDraft,
  sanitizeListeningDraft,
  sanitizeListeningRound,
  saveListeningDraft,
  type ListeningRound,
} from './listeningRound'

const sessionMem = new Map<string, string>()
globalThis.sessionStorage = {
  getItem: (key: string) => sessionMem.get(key) ?? null,
  setItem: (key: string, value: string) => void sessionMem.set(key, value),
  removeItem: (key: string) => void sessionMem.delete(key),
  clear: () => sessionMem.clear(),
  key: (index: number) => [...sessionMem.keys()][index] ?? null,
  get length() { return sessionMem.size },
} as Storage

const NOW = 1_900_000_000_000
const text = CHAPTER_LISTENING.get('b2c3')!
const wrong = (question: number) => (text.questions[question].answer + 1) % 4

function answerAll(round: ListeningRound, pick: (question: number) => number): ListeningRound {
  return text.questions.reduce((next, _, index) => chooseListeningAnswer(text, next, index, pick(index)), round)
}

describe('chapter listening round', () => {
  beforeEach(() => sessionMem.clear())

  it('opens the questions only after one full hearing', () => {
    const fresh = emptyListeningRound(text)
    expect(chooseListeningAnswer(text, fresh, 0, 1)).toBe(fresh)
    expect(listeningRoundReady(text, fresh)).toBe(false)
    const heard = { ...fresh, heard: true }
    expect(chooseListeningAnswer(text, heard, 0, 1).answers[0]).toBe(1)
  })

  it('keeps the first score and asks again only for the wrong answers', () => {
    let round = answerAll({ ...emptyListeningRound(text), heard: true }, index => index < 2 ? wrong(index) : text.questions[index].answer)
    expect(listeningRoundReady(text, round)).toBe(true)
    round = checkListeningRound(text, round)
    expect(round.firstPassCorrect).toBe(3)
    expect(round.locked).toEqual([false, false, true, true, true])
    expect(round.answers.slice(0, 2)).toEqual([null, null])
    expect(round.rejected[0]).toEqual([wrong(0)])
    expect(listeningRoundReady(text, round)).toBe(false)
    expect(listeningCheckResult(text, round)).toBeUndefined()

    // A rejected option and a confirmed question cannot be chosen again.
    expect(chooseListeningAnswer(text, round, 0, wrong(0))).toBe(round)
    expect(chooseListeningAnswer(text, round, 2, wrong(2))).toBe(round)

    round = chooseListeningAnswer(text, round, 0, text.questions[0].answer)
    round = chooseListeningAnswer(text, round, 1, (wrong(1) + 1) % 4 === text.questions[1].answer ? (wrong(1) + 2) % 4 : (wrong(1) + 1) % 4)
    round = checkListeningRound(text, round)
    expect(round.firstPassCorrect).toBe(3)
    expect(round.locked[0]).toBe(true)
    expect(round.locked[1]).toBe(false)
    expect(round.rejected[1]).toHaveLength(2)

    round = checkListeningRound(text, chooseListeningAnswer(text, round, 1, text.questions[1].answer))
    expect(listeningRoundDone(text, round)).toBe(true)
    expect(listeningCheckResult(text, round)).toEqual({ firstPassCorrect: 3, total: 5, verifiedCorrect: 5 })
  })

  it('rejects impossible saved rounds', () => {
    const fresh = emptyListeningRound(text)
    expect(sanitizeListeningRound(fresh, text)).toEqual(fresh)
    expect(sanitizeListeningRound({ ...fresh, answers: [0, null, null, null, null] }, text)).toBeUndefined()
    const lockedWrong = { ...fresh, heard: true, firstPassCorrect: 1, answers: [wrong(0), null, null, null, null], locked: [true, false, false, false, false] }
    expect(sanitizeListeningRound(lockedWrong, text)).toBeUndefined()
    const rejectedRight = { ...fresh, heard: true, firstPassCorrect: 0, rejected: [[text.questions[0].answer], [], [], [], []] }
    expect(sanitizeListeningRound(rejectedRight, text)).toBeUndefined()
    const uncheckedLocks = { ...fresh, heard: true, answers: [text.questions[0].answer, null, null, null, null], locked: [true, false, false, false, false] }
    expect(sanitizeListeningRound(uncheckedLocks, text)).toBeUndefined()
    expect(sanitizeListeningRound({ ...fresh, answers: [null, null] }, text)).toBeUndefined()
  })

  it('saves, restores and clears a round for its own text only', () => {
    const round = checkListeningRound(text, answerAll({ ...emptyListeningRound(text), heard: true }, index => index === 4 ? wrong(4) : text.questions[index].answer))
    expect(saveListeningDraft('b2c3', text, round, NOW)).toBe(true)
    expect(loadListeningDraft('b2c3', text, NOW + 1_000)).toEqual(round)
    expect(loadListeningDraft('b2c3', CHAPTER_LISTENING.get('b2c4')!, NOW)).toBeUndefined()
    expect(sessionMem.size).toBe(0)

    saveListeningDraft('b2c3', text, round, NOW)
    expect(loadListeningDraft('b2c3', text, NOW + 2 * 24 * 60 * 60 * 1000)).toBeUndefined()
    saveListeningDraft('b2c3', text, round, NOW)
    clearListeningDraft('b2c3')
    expect(loadListeningDraft('b2c3', text, NOW)).toBeUndefined()

    const stale = { version: 1, textId: text.id, signature: listeningTextSignature(text) + 'x', round, updatedAt: NOW }
    expect(sanitizeListeningDraft(stale, text, NOW)).toBeUndefined()
  })
})
