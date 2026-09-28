import type { TestText } from '../data/bookTests'
import type { ListeningCheck } from './progress'

/**
 * The chapter's listening check. The text is only heard; its questions open
 * after one full hearing. "Check" confirms the right answers and marks the
 * wrong ones, which the learner answers again (after listening again) until
 * every question is right. The first check's score is kept for the record.
 */
export interface ListeningRound {
  heard: boolean
  answers: Array<number | null>
  /** Confirmed right by a check; closed for changes. */
  locked: boolean[]
  /** Options tried and found wrong, per question. */
  rejected: number[][]
  /** Right answers at the first check; set once checked. */
  firstPassCorrect?: number
}

export function emptyListeningRound(text: TestText): ListeningRound {
  return {
    heard: false,
    answers: text.questions.map(() => null),
    locked: text.questions.map(() => false),
    rejected: text.questions.map(() => []),
  }
}

/** Heard, and every open question has an answer. */
export function listeningRoundReady(text: TestText, round: ListeningRound): boolean {
  return round.heard && text.questions.every((_, index) => round.locked[index] || round.answers[index] !== null)
}

export function listeningRoundDone(text: TestText, round: ListeningRound): boolean {
  return text.questions.every((_, index) => round.locked[index])
}

export function chooseListeningAnswer(text: TestText, round: ListeningRound, question: number, option: number): ListeningRound {
  if (!round.heard || round.locked[question] || round.rejected[question]?.includes(option)) return round
  if (!text.questions[question] || !Number.isInteger(option) || option < 0 || option >= text.questions[question].options.length) return round
  const answers = [...round.answers]
  answers[question] = option
  return { ...round, answers }
}

export function checkListeningRound(text: TestText, round: ListeningRound): ListeningRound {
  if (!listeningRoundReady(text, round)) return round
  const answers = [...round.answers]
  const locked = [...round.locked]
  const rejected = round.rejected.map(options => [...options])
  text.questions.forEach((question, index) => {
    if (locked[index]) return
    if (answers[index] === question.answer) {
      locked[index] = true
    } else {
      rejected[index].push(answers[index]!)
      answers[index] = null
    }
  })
  const firstPassCorrect = round.firstPassCorrect ?? locked.filter(Boolean).length
  return { ...round, answers, locked, rejected, firstPassCorrect }
}

export function listeningCheckResult(text: TestText, round: ListeningRound): ListeningCheck | undefined {
  if (!listeningRoundDone(text, round) || round.firstPassCorrect === undefined) return undefined
  return {
    firstPassCorrect: round.firstPassCorrect,
    total: text.questions.length,
    verifiedCorrect: round.locked.filter(Boolean).length,
  }
}

function isOption(value: unknown, text: TestText, question: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < text.questions[question].options.length
}

export function sanitizeListeningRound(raw: unknown, text: TestText): ListeningRound | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as Partial<ListeningRound>
  const total = text.questions.length
  if (typeof value.heard !== 'boolean') return undefined
  if (!Array.isArray(value.answers) || value.answers.length !== total) return undefined
  if (!Array.isArray(value.locked) || value.locked.length !== total) return undefined
  if (!Array.isArray(value.rejected) || value.rejected.length !== total) return undefined

  const answers: Array<number | null> = []
  const locked: boolean[] = []
  const rejected: number[][] = []
  for (let index = 0; index < total; index++) {
    const answer = value.answers[index]
    if (answer !== null && !isOption(answer, text, index)) return undefined
    const isLocked = value.locked[index]
    if (typeof isLocked !== 'boolean') return undefined
    if (isLocked && answer !== text.questions[index].answer) return undefined
    const tried = value.rejected[index]
    if (!Array.isArray(tried) || tried.length >= text.questions[index].options.length) return undefined
    if (new Set(tried).size !== tried.length) return undefined
    for (const option of tried) {
      if (!isOption(option, text, index) || option === text.questions[index].answer || option === answer) return undefined
    }
    answers.push(answer)
    locked.push(isLocked)
    rejected.push([...tried])
  }

  if (!value.heard && answers.some(answer => answer !== null)) return undefined

  let firstPassCorrect: number | undefined
  if (value.firstPassCorrect !== undefined) {
    const first = value.firstPassCorrect
    if (typeof first !== 'number' || !Number.isInteger(first) || first < 0 || first > total) return undefined
    if (locked.filter(Boolean).length < first) return undefined
    firstPassCorrect = first
  } else if (locked.some(Boolean) || rejected.some(options => options.length > 0)) {
    return undefined
  }

  return { heard: value.heard, answers, locked, rejected, ...(firstPassCorrect !== undefined ? { firstPassCorrect } : {}) }
}

// Saved per chapter for a reload in the same tab.
export interface ListeningDraft {
  version: 1
  textId: string
  signature: string
  round: ListeningRound
  updatedAt: number
}

const PREFIX = 'ghesse:chapter-listening:v1:'
const MAX_AGE_MS = 24 * 60 * 60 * 1000

function storageKey(chapterId: string): string {
  return `${PREFIX}${chapterId}`
}

export function listeningTextSignature(text: TestText): string {
  return JSON.stringify([text.id, text.sentences.map(sentence => sentence.en), text.questions.map(question => [question.q, question.options, question.answer])])
}

export function sanitizeListeningDraft(raw: unknown, text: TestText, now = Date.now()): ListeningDraft | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as Partial<ListeningDraft>
  if (value.version !== 1 || value.textId !== text.id || value.signature !== listeningTextSignature(text)) return undefined
  const round = sanitizeListeningRound(value.round, text)
  if (!round) return undefined
  const updatedAt = typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) && value.updatedAt > 0 ? value.updatedAt : now
  if (now - updatedAt > MAX_AGE_MS || updatedAt - now > 5 * 60 * 1000) return undefined
  return { version: 1, textId: text.id, signature: value.signature, round, updatedAt }
}

export function loadListeningDraft(chapterId: string, text: TestText, now = Date.now()): ListeningRound | undefined {
  if (typeof sessionStorage === 'undefined') return undefined
  try {
    const raw = sessionStorage.getItem(storageKey(chapterId))
    if (!raw) return undefined
    const draft = sanitizeListeningDraft(JSON.parse(raw) as unknown, text, now)
    if (!draft) sessionStorage.removeItem(storageKey(chapterId))
    return draft?.round
  } catch {
    clearListeningDraft(chapterId)
    return undefined
  }
}

export function saveListeningDraft(chapterId: string, text: TestText, round: ListeningRound, now = Date.now()): boolean {
  if (typeof sessionStorage === 'undefined') return false
  const draft = sanitizeListeningDraft({ version: 1, textId: text.id, signature: listeningTextSignature(text), round, updatedAt: now }, text, now)
  if (!draft) return false
  try {
    sessionStorage.setItem(storageKey(chapterId), JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

export function clearListeningDraft(chapterId: string): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(storageKey(chapterId))
  } catch {
    // Listening recovery is optional and must never block the chapter.
  }
}
