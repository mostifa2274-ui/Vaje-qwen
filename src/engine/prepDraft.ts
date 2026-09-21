export type PrepPhase = 'teach' | 'written' | 'listening'
export type PrepFeedback = 'correct' | 'wrong' | null

export interface PrepDraft {
  version: 1
  chapterId: string
  phase: PrepPhase
  teachIndex: number
  writtenQueue: string[]
  writtenPassed: string[]
  writtenMissed: string[]
  listeningQueue: string[]
  listeningPassed: string[]
  listeningMissed: string[]
  feedback: PrepFeedback
  selected: string
  typed: string
  updatedAt: number
}

const PREFIX = 'ghesse:prep:v1:'
const MAX_TEXT = 300

function storageKey(chapterId: string): string {
  return `${PREFIX}${chapterId}`
}

function isPhase(value: unknown): value is PrepPhase {
  return value === 'teach' || value === 'written' || value === 'listening'
}

function isFeedback(value: unknown): value is PrepFeedback {
  return value === null || value === 'correct' || value === 'wrong'
}

function safeText(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_TEXT) : ''
}

function validIds(value: unknown, allowed: ReadonlySet<string>): string[] {
  if (!Array.isArray(value)) return []
  const result: string[] = []
  const seen = new Set<string>()
  for (const valueId of value) {
    if (typeof valueId !== 'string' || !allowed.has(valueId) || seen.has(valueId)) continue
    seen.add(valueId)
    result.push(valueId)
  }
  return result
}

export function sanitizePrepDraft(raw: unknown, chapterId: string, chapterWordIds: readonly string[]): PrepDraft | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as Partial<PrepDraft>
  if (value.version !== 1 || value.chapterId !== chapterId || !isPhase(value.phase)) return undefined

  const allowed = new Set(chapterWordIds)
  if (allowed.size === 0) return undefined

  const maxTeachIndex = Math.max(0, chapterWordIds.length - 1)
  const teachIndexRaw = typeof value.teachIndex === 'number' && Number.isFinite(value.teachIndex) ? Math.floor(value.teachIndex) : 0
  const teachIndex = Math.min(maxTeachIndex, Math.max(0, teachIndexRaw))

  const writtenPassed = validIds(value.writtenPassed, allowed)
  let writtenQueue = validIds(value.writtenQueue, allowed).filter(id => !writtenPassed.includes(id))
  const writtenMissed = validIds(value.writtenMissed, allowed)

  const listeningPassed = validIds(value.listeningPassed, allowed)
  let listeningQueue = validIds(value.listeningQueue, allowed).filter(id => !listeningPassed.includes(id))
  const listeningMissed = validIds(value.listeningMissed, allowed)

  // A malformed or interrupted draft must never leave a test in an empty,
  // incomplete state. Rebuild the remaining queue from the authoritative
  // chapter assignment rather than treating an empty queue as completion.
  if (value.phase === 'written' && writtenQueue.length === 0 && writtenPassed.length < chapterWordIds.length) {
    writtenQueue = chapterWordIds.filter(id => !writtenPassed.includes(id))
  }
  if (value.phase === 'listening' && listeningQueue.length === 0 && listeningPassed.length < chapterWordIds.length) {
    listeningQueue = chapterWordIds.filter(id => !listeningPassed.includes(id))
  }

  return {
    version: 1,
    chapterId,
    phase: value.phase,
    teachIndex,
    writtenQueue,
    writtenPassed,
    writtenMissed,
    listeningQueue,
    listeningPassed,
    listeningMissed,
    feedback: isFeedback(value.feedback) ? value.feedback : null,
    selected: safeText(value.selected),
    typed: safeText(value.typed),
    updatedAt: typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) && value.updatedAt > 0
      ? value.updatedAt
      : Date.now(),
  }
}

export function loadPrepDraft(chapterId: string, chapterWordIds: readonly string[]): PrepDraft | undefined {
  if (typeof sessionStorage === 'undefined') return undefined
  try {
    const raw = sessionStorage.getItem(storageKey(chapterId))
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as unknown
    const draft = sanitizePrepDraft(parsed, chapterId, chapterWordIds)
    if (!draft) sessionStorage.removeItem(storageKey(chapterId))
    return draft
  } catch {
    return undefined
  }
}

export function savePrepDraft(draft: PrepDraft, chapterWordIds: readonly string[]): boolean {
  if (typeof sessionStorage === 'undefined') return false
  const normalized = sanitizePrepDraft(draft, draft.chapterId, chapterWordIds)
  if (!normalized) return false
  try {
    sessionStorage.setItem(storageKey(draft.chapterId), JSON.stringify(normalized))
    return true
  } catch {
    return false
  }
}

export function clearPrepDraft(chapterId: string): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(storageKey(chapterId))
  } catch {
    // Session drafts are optional resilience only. Never block learning.
  }
}
