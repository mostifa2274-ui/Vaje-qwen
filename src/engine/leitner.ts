import { CHAPTERS, VOCAB, WORD_BY_ID } from '../data/chapters'
import type { GhesseState, LeitnerCard, LeitnerDay, LeitnerDirection, LeitnerScope, LeitnerSettings, LeitnerState, WordEntry } from './types'
import { isHeadwordTranslationCorrect } from './persianTranslation'

// A Leitner deck over every course word. Cards start in box 1 and climb one
// box per remembered review; each box waits twice as long as the one before.
// A forgotten card drops back to box 1. Days follow the learner's own clock,
// so a card due "tomorrow" is due from the start of tomorrow.

export const LEITNER_BOXES = 6
/** Days a card waits in each box (index 0 is box 1). */
export const BOX_INTERVAL_DAYS = [1, 2, 4, 8, 16, 32] as const
export const NEW_PER_DAY_OPTIONS = [0, 5, 10, 20, 30, 50] as const
/** Cards in one session, before in-session repeats of missed cards. */
export const SESSION_LIMIT = 40
/** A missed card comes back after this many other cards in the session. */
export const REPEAT_GAP = 4
/** Days kept in the activity log. */
const LOG_DAYS = 120

export type LeitnerGrade = 'again' | 'hard' | 'good'
export type CardFace = Exclude<LeitnerDirection, 'mixed'>

const DAY_MS = 24 * 60 * 60 * 1000

export const DEFAULT_LEITNER_SETTINGS: LeitnerSettings = { direction: 'enFa', scope: 'all', newPerDay: 10, typed: false }
export const LEITNER_SCOPES: readonly LeitnerScope[] = ['all', 'learned', 'book-1', 'book-2', 'book-3', 'book-4', 'book-5', 'book-6', 'book-7', 'book-8']
export const LEITNER_DIRECTIONS: readonly LeitnerDirection[] = ['enFa', 'faEn', 'listen', 'mixed']

export function emptyLeitner(): LeitnerState {
  return { cards: {}, settings: { ...DEFAULT_LEITNER_SETTINGS }, days: {} }
}

/** Local calendar day, YYYY-MM-DD. */
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
function dayStartAfter(time: number, days: number): number {
  const date = new Date(startOfDay(time))
  date.setDate(date.getDate() + days)
  return date.getTime()
}

export function intervalDays(box: number): number {
  return BOX_INTERVAL_DAYS[Math.min(LEITNER_BOXES, Math.max(1, box)) - 1]
}

/** A card is due for the whole of its due day. */
export function isDue(card: LeitnerCard, now: number): boolean {
  return card.dueAt < dayStartAfter(now, 1)
}

export function gradeCard(card: LeitnerCard | undefined, grade: LeitnerGrade, now: number): LeitnerCard {
  const current = card ?? { box: 1, dueAt: now, addedAt: now, reviews: 0, correct: 0, lapses: 0 }
  // Remembered moves up one box; hard stays for a day; forgotten starts over.
  const box = grade === 'good' ? Math.min(LEITNER_BOXES, current.box + 1) : grade === 'hard' ? current.box : 1
  const wait = grade === 'good' ? intervalDays(box) : 1
  return {
    box,
    dueAt: dayStartAfter(now, wait),
    addedAt: current.addedAt,
    lastReviewedAt: now,
    reviews: current.reviews + 1,
    correct: current.correct + (grade === 'again' ? 0 : 1),
    lapses: current.lapses + (grade === 'again' && card && card.box > 1 ? 1 : 0),
  }
}

function pruneDays(days: Record<string, LeitnerDay>, now: number): Record<string, LeitnerDay> {
  const oldest = dayKey(dayStartAfter(now, -LOG_DAYS))
  return Object.fromEntries(Object.entries(days).filter(([key]) => key >= oldest))
}

/** Record a card's review in the deck and in today's activity. */
export function recordLeitnerReview(leitner: LeitnerState, wordId: string, grade: LeitnerGrade, now: number): LeitnerState {
  const previous = leitner.cards[wordId]
  const today = dayKey(now)
  const day = leitner.days[today] ?? { reviewed: 0, correct: 0, added: 0 }
  return {
    ...leitner,
    cards: { ...leitner.cards, [wordId]: gradeCard(previous, grade, now) },
    days: pruneDays({
      ...leitner.days,
      [today]: {
        reviewed: day.reviewed + 1,
        correct: day.correct + (grade === 'again' ? 0 : 1),
        added: day.added + (previous ? 0 : 1),
      },
    }, now),
  }
}

// Course order: the order in which the chapters teach the words.
const COURSE_ORDER: string[] = (() => {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const chapter of CHAPTERS) for (const id of chapter.new) if (!seen.has(id)) { seen.add(id); ids.push(id) }
  for (const word of VOCAB) if (!seen.has(word.id)) { seen.add(word.id); ids.push(word.id) }
  return ids
})()

const BOOK_OF = new Map<string, number>()
const CHAPTER_OF = new Map<string, { book: number; n: number; titleFa: string }>()
for (const chapter of CHAPTERS) {
  for (const id of chapter.new) {
    if (BOOK_OF.has(id)) continue
    BOOK_OF.set(id, chapter.book)
    CHAPTER_OF.set(id, { book: chapter.book, n: chapter.n, titleFa: chapter.titleFa })
  }
}

export function wordOrigin(wordId: string): { book: number; n: number; titleFa: string } | undefined {
  return CHAPTER_OF.get(wordId)
}

/** Every word the scope covers, in course order. */
export function scopeWordIds(scope: LeitnerScope, state: GhesseState): string[] {
  if (scope === 'all') return COURSE_ORDER
  if (scope === 'learned') return COURSE_ORDER.filter(id => state.words[id]?.introduced)
  const book = Number(scope.slice(5))
  return COURSE_ORDER.filter(id => BOOK_OF.get(id) === book)
}

export function newCardsLeftToday(leitner: LeitnerState, now: number): number {
  return Math.max(0, leitner.settings.newPerDay - (leitner.days[dayKey(now)]?.added ?? 0))
}

/** Unstarted cards in the order they are offered: words met in the course first. */
export function newCardOrder(state: GhesseState, scopeIds: readonly string[]): string[] {
  const fresh = scopeIds.filter(id => !state.leitner.cards[id])
  const met = fresh.filter(id => state.words[id]?.introduced)
  const unmet = fresh.filter(id => !state.words[id]?.introduced)
  return [...met, ...unmet]
}

export function dueCards(state: GhesseState, scopeIds: readonly string[], now: number): string[] {
  return scopeIds
    .filter(id => {
      const card = state.leitner.cards[id]
      return card !== undefined && isDue(card, now)
    })
    .sort((a, b) => {
      const left = state.leitner.cards[a]
      const right = state.leitner.cards[b]
      return left.box - right.box || left.dueAt - right.dueAt
    })
}

/**
 * Today's session: due cards, lowest box first, with the day's new cards
 * mixed in after every third one. Due work comes first; new cards only fill
 * the room the session has left.
 */
export function buildSession(state: GhesseState, now: number, extraNew = 0): string[] {
  const scopeIds = scopeWordIds(state.leitner.settings.scope, state)
  const due = dueCards(state, scopeIds, now).slice(0, SESSION_LIMIT)
  const room = Math.max(0, SESSION_LIMIT - due.length)
  // `extraNew` lets the learner ask for more new cards than the daily number.
  const fresh = newCardOrder(state, scopeIds).slice(0, Math.min(room, newCardsLeftToday(state.leitner, now) + extraNew))
  const session: string[] = []
  let next = 0
  due.forEach((id, index) => {
    session.push(id)
    if ((index + 1) % 3 === 0 && next < fresh.length) session.push(fresh[next++])
  })
  while (next < fresh.length) session.push(fresh[next++])
  return session
}

/** How many cards of a scope sit in each box; index 0 counts unstarted cards. */
export function boxCounts(state: GhesseState, scopeIds: readonly string[]): number[] {
  const counts = Array.from({ length: LEITNER_BOXES + 1 }, () => 0)
  for (const id of scopeIds) counts[state.leitner.cards[id]?.box ?? 0]++
  return counts
}

export function cardsInBox(state: GhesseState, scopeIds: readonly string[], box: number): string[] {
  return scopeIds
    .filter(id => (state.leitner.cards[id]?.box ?? 0) === box)
    .sort((a, b) => (state.leitner.cards[a]?.dueAt ?? 0) - (state.leitner.cards[b]?.dueAt ?? 0))
}

/** Consecutive days with at least one review, ending today (or yesterday). */
export function streakDays(leitner: LeitnerState, now: number): number {
  let day = startOfDay(now)
  if (!leitner.days[dayKey(day)]?.reviewed) day = dayStartAfter(day, -1)
  let streak = 0
  while (leitner.days[dayKey(day)]?.reviewed) {
    streak++
    day = dayStartAfter(day, -1)
  }
  return streak
}

/** Cards due on each of the next `days` days (index 0 is today, overdue included). */
export function dueForecast(state: GhesseState, scopeIds: readonly string[], now: number, days = 7): number[] {
  const forecast = Array.from({ length: days }, () => 0)
  const tomorrow = dayStartAfter(now, 1)
  for (const id of scopeIds) {
    const card = state.leitner.cards[id]
    if (!card) continue
    const offset = card.dueAt < tomorrow ? 0 : Math.round((startOfDay(card.dueAt) - startOfDay(now)) / DAY_MS)
    if (offset < days) forecast[offset]++
  }
  return forecast
}

/** Reviews of each of the last `days` days, oldest first. */
export function recentActivity(leitner: LeitnerState, now: number, days = 7): Array<{ key: string; day: LeitnerDay }> {
  return Array.from({ length: days }, (_, index) => {
    const key = dayKey(dayStartAfter(now, index - (days - 1)))
    return { key, day: leitner.days[key] ?? { reviewed: 0, correct: 0, added: 0 } }
  })
}

export interface LeitnerSummary {
  due: number
  newToday: number
  started: number
  mastered: number
  total: number
  reviewedToday: number
  streak: number
  /** Share of remembered reviews over the last seven days; undefined without reviews. */
  accuracy?: number
}

export function leitnerSummary(state: GhesseState, now: number): LeitnerSummary {
  const scopeIds = scopeWordIds(state.leitner.settings.scope, state)
  const counts = boxCounts(state, scopeIds)
  const week = recentActivity(state.leitner, now, 7)
  const reviewed = week.reduce((sum, entry) => sum + entry.day.reviewed, 0)
  const correct = week.reduce((sum, entry) => sum + entry.day.correct, 0)
  return {
    due: dueCards(state, scopeIds, now).length,
    newToday: Math.min(newCardsLeftToday(state.leitner, now), counts[0]),
    started: scopeIds.length - counts[0],
    mastered: counts[LEITNER_BOXES],
    total: scopeIds.length,
    reviewedToday: state.leitner.days[dayKey(now)]?.reviewed ?? 0,
    streak: streakDays(state.leitner, now),
    accuracy: reviewed ? correct / reviewed : undefined,
  }
}

function hash(value: string): number {
  let result = 2166136261
  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

/** The face a card shows. Mixed rotates per card and per review. */
export function cardFace(direction: LeitnerDirection, wordId: string, reviews: number, soundOn: boolean): CardFace {
  if (direction !== 'mixed') return direction === 'listen' && !soundOn ? 'enFa' : direction
  const faces: CardFace[] = soundOn ? ['enFa', 'faEn', 'listen'] : ['enFa', 'faEn']
  return faces[hash(`${wordId}:${reviews}`) % faces.length]
}

function englishForms(word: WordEntry): string[] {
  const clean = (value: string) => value.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z' -]/g, ' ').replace(/\s+/g, ' ').trim()
  return [clean(word.word), ...word.word.split(/[,/]/).map(clean)].filter(Boolean)
}

/** Whether a typed answer matches the card's hidden side. */
export function typedAnswerCorrect(face: CardFace, wordId: string, typed: string): boolean {
  const word = WORD_BY_ID.get(wordId)
  if (!word || !typed.trim()) return false
  if (face === 'enFa') return isHeadwordTranslationCorrect(typed, word, VOCAB)
  const answer = typed.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z' -]/g, ' ').replace(/\s+/g, ' ').trim()
  return englishForms(word).includes(answer)
}

function wholeNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback
}

function time(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

/** Repair a stored or imported deck; unknown words and malformed entries are dropped. */
export function normalizeLeitner(raw: unknown, now: number, validWordIds?: ReadonlySet<string>): LeitnerState {
  if (!raw || typeof raw !== 'object') return emptyLeitner()
  const value = raw as Partial<LeitnerState>
  const cards: Record<string, LeitnerCard> = {}
  if (value.cards && typeof value.cards === 'object') {
    for (const [id, card] of Object.entries(value.cards as Record<string, unknown>)) {
      if (validWordIds && !validWordIds.has(id)) continue
      if (!card || typeof card !== 'object') continue
      const c = card as Partial<LeitnerCard>
      const dueAt = time(c.dueAt)
      if (dueAt === undefined) continue
      const reviews = wholeNumber(c.reviews, 0, 0, 100_000)
      cards[id] = {
        box: wholeNumber(c.box, 1, 1, LEITNER_BOXES),
        dueAt,
        addedAt: time(c.addedAt) ?? dueAt,
        ...(time(c.lastReviewedAt) ? { lastReviewedAt: time(c.lastReviewedAt) } : {}),
        reviews,
        correct: wholeNumber(c.correct, 0, 0, reviews),
        lapses: wholeNumber(c.lapses, 0, 0, reviews),
      }
    }
  }
  const s = (value.settings ?? {}) as Partial<LeitnerSettings>
  const settings: LeitnerSettings = {
    direction: LEITNER_DIRECTIONS.includes(s.direction as LeitnerDirection) ? s.direction as LeitnerDirection : DEFAULT_LEITNER_SETTINGS.direction,
    scope: LEITNER_SCOPES.includes(s.scope as LeitnerScope) ? s.scope as LeitnerScope : DEFAULT_LEITNER_SETTINGS.scope,
    newPerDay: (NEW_PER_DAY_OPTIONS as readonly number[]).includes(s.newPerDay as number) ? s.newPerDay as number : DEFAULT_LEITNER_SETTINGS.newPerDay,
    typed: s.typed === true,
  }
  const days: Record<string, LeitnerDay> = {}
  if (value.days && typeof value.days === 'object') {
    for (const [key, day] of Object.entries(value.days as Record<string, unknown>)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !day || typeof day !== 'object') continue
      const d = day as Partial<LeitnerDay>
      const reviewed = wholeNumber(d.reviewed, 0, 0, 100_000)
      days[key] = { reviewed, correct: wholeNumber(d.correct, 0, 0, reviewed), added: wholeNumber(d.added, 0, 0, 100_000) }
    }
  }
  return { cards, settings, days: pruneDays(days, now) }
}
