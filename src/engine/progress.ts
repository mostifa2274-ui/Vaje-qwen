import type { GhesseState, WordProgress } from './types'
import { CHAPTER_BY_ID } from '../data/chapters'
import { blankWordProgress, scheduleAfterChapter } from './review'
import { LISTENING_QUESTION_COUNT, READING_QUESTION_COUNT } from './comprehension'
import { canPrepareChapter, canReadChapter } from './gates'

export function recordPreparedChapter(
  state: GhesseState,
  chapterId: string,
  wordIds: string[],
  writtenPassedIds: readonly string[],
  listeningPassedIds: readonly string[],
  writtenMissedIds: readonly string[],
  listeningMissedIds: readonly string[],
  now: number,
): GhesseState {
  // Synthetic chapter ids are used by isolated engine tests, but every real
  // course chapter must still be reachable when evidence is committed.
  if (CHAPTER_BY_ID.has(chapterId) && !canPrepareChapter(state, chapterId)) return state

  const previous = state.chapters[chapterId]
  const writtenPassed = new Set(writtenPassedIds)
  const listeningPassed = new Set(listeningPassedIds)

  // Engine-level fail-closed gate: UI bugs, imported sparse state, or direct
  // callers cannot unlock a chapter unless every word passed both tests.
  const fullWrittenPass = wordIds.length > 0 && wordIds.every(id => writtenPassed.has(id))
  const fullListeningPass = wordIds.length > 0 && wordIds.every(id => listeningPassed.has(id))
  if (!fullWrittenPass || !fullListeningPass) return state

  const words = { ...state.words }
  const writtenMissed = new Set(writtenMissedIds)
  const listeningMissed = new Set(listeningMissedIds)
  const alreadyUsedCurrentGate =
    (previous?.prepWrittenTotal ?? 0) > 0
    || (previous?.prepListeningTotal ?? 0) > 0
    || previous?.prepDiagnosticPassed === true
  const tuneDifficulty = !alreadyUsedCurrentGate
  // Count only misses that belong to this chapter. Direct callers/imported
  // draft data must not be able to drive first-pass evidence below zero.
  const writtenFirstPassCorrect = wordIds.filter(id => !writtenMissed.has(id)).length
  const listeningFirstPassCorrect = wordIds.filter(id => !listeningMissed.has(id)).length

  for (const id of wordIds) {
    const existing = words[id] ?? blankWordProgress(now)
    // Prep still does not grant long-term mastery. Misses only tune initial
    // difficulty so the later spaced-retrieval scheduler reacts to friction.
    const difficultyDelta = tuneDifficulty
      ? (writtenMissed.has(id) ? 0.85 : -0.08) + (listeningMissed.has(id) ? 0.6 : -0.05)
      : 0
    words[id] = {
      ...existing,
      introduced: true,
      firstSeenAt: existing.firstSeenAt ?? now,
      difficulty: Math.max(1, Math.min(10, existing.difficulty + difficultyDelta)),
    }
  }

  return {
    ...state,
    words,
    chapters: {
      ...state.chapters,
      [chapterId]: {
        ...(previous ?? {}),
        preparedAt: now,
        prepAttempts: (previous?.prepAttempts ?? 0) + 1,
        prepWrittenCorrect: wordIds.length,
        prepWrittenTotal: wordIds.length,
        prepWrittenFirstPassCorrect: previous?.prepWrittenFirstPassCorrect
          ?? (tuneDifficulty ? writtenFirstPassCorrect : undefined),
        prepListeningCorrect: wordIds.length,
        prepListeningTotal: wordIds.length,
        prepListeningFirstPassCorrect: previous?.prepListeningFirstPassCorrect
          ?? (tuneDifficulty ? listeningFirstPassCorrect : undefined),
        completed: previous?.completed ?? false,
        completedAt: previous?.completedAt,
        lastReadAt: previous?.lastReadAt,
        checksCorrect: previous?.checksCorrect ?? 0,
        checksTotal: previous?.checksTotal ?? 0,
        reads: previous?.reads ?? 0,
      },
    },
  }
}


export function recordDiagnosticPreparedChapter(
  state: GhesseState,
  chapterId: string,
  wordIds: string[],
  productivePassedIds: readonly string[],
  listeningPassedIds: readonly string[],
  now: number,
): GhesseState {
  // Unlike a normal prep screen, this path can skip teaching entirely. Keep
  // the progression prerequisite inside the engine so a stale screen/direct
  // caller cannot pre-certify a future chapter.
  if (!canPrepareChapter(state, chapterId)) return state
  const productivePassed = new Set(productivePassedIds)
  const listeningPassed = new Set(listeningPassedIds)
  const complete =
    wordIds.length > 0
    && wordIds.every(id => productivePassed.has(id))
    && wordIds.every(id => listeningPassed.has(id))
  if (!complete) return state

  const previous = state.chapters[chapterId]
  const words = { ...state.words }
  for (const id of wordIds) {
    const existing = words[id] ?? blankWordProgress(now)
    words[id] = {
      ...existing,
      introduced: true,
      firstSeenAt: existing.firstSeenAt ?? now,
    }
  }

  return {
    ...state,
    words,
    chapters: {
      ...state.chapters,
      [chapterId]: {
        ...(previous ?? {}),
        preparedAt: now,
        prepAttempts: (previous?.prepAttempts ?? 0) + 1,
        prepDiagnosticPassed: true,
        prepDiagnosticTotal: wordIds.length,
        completed: previous?.completed ?? false,
        completedAt: previous?.completedAt,
        lastReadAt: previous?.lastReadAt,
        checksCorrect: previous?.checksCorrect ?? 0,
        checksTotal: previous?.checksTotal ?? 0,
        reads: previous?.reads ?? 0,
      },
    },
  }
}

/** The chapter's listening questions: first-pass score and the corrected total. */
export interface ListeningCheck {
  firstPassCorrect: number
  total: number
  verifiedCorrect: number
}

export function recordCompletedRead(
  state: GhesseState,
  chapterId: string,
  wordIds: string[],
  firstPassChecksCorrect: number,
  checksTotal: number,
  verifiedChecksCorrect: number,
  listening: ListeningCheck,
  now: number,
  chapterOrder: readonly string[],
  successorId?: string,
): GhesseState {
  if (CHAPTER_BY_ID.has(chapterId) && !canReadChapter(state, chapterId)) return state

  const previous = state.chapters[chapterId]

  const hasCurrentPrepGate = Boolean(
    previous?.preparedAt
    && wordIds.length > 0
    && (
      (
        previous.prepWrittenCorrect === wordIds.length
        && previous.prepWrittenTotal === wordIds.length
        && previous.prepListeningCorrect === wordIds.length
        && previous.prepListeningTotal === wordIds.length
      )
      || (
        previous.prepDiagnosticPassed === true
        && previous.prepDiagnosticTotal === wordIds.length
      )
    ),
  )
  const canRereadLegacyCompletion = previous?.completed === true
  const comprehensionVerified = checksTotal === READING_QUESTION_COUNT && verifiedChecksCorrect === READING_QUESTION_COUNT
  const listeningVerified = listening.total === LISTENING_QUESTION_COUNT && listening.verifiedCorrect === LISTENING_QUESTION_COUNT

  // Engine-level fail-closed completion gate. UI bugs or direct callers cannot
  // complete an unfinished chapter without the 100% prep gate and 100%
  // (corrected) reading and listening comprehension. Legacy chapters already
  // marked complete remain rereadable.
  if ((!hasCurrentPrepGate && !canRereadLegacyCompletion) || !comprehensionVerified || !listeningVerified) return state

  const words = { ...state.words }
  for (const id of wordIds) {
    const base = words[id] ?? blankWordProgress(now)
    words[id] = scheduleAfterChapter(base, now)
  }
  const next: GhesseState = {
    ...state,
    words,
    chapters: {
      ...state.chapters,
      [chapterId]: {
        ...(previous ?? {}),
        preparedAt: previous?.preparedAt ?? now,
        prepAttempts: Math.max(1, previous?.prepAttempts ?? 0),
        completed: true,
        completedAt: previous?.completedAt ?? now,
        lastReadAt: now,
        checksCorrect: firstPassChecksCorrect,
        checksTotal,
        listeningCorrect: listening.firstPassCorrect,
        listeningTotal: listening.total,
        reads: Math.max(previous?.reads ?? 0, previous?.completed ? 1 : 0) + 1,
      },
    },
  }

  const chapterIndex = chapterOrder.indexOf(chapterId)
  const frontierIndex = chapterOrder.indexOf(state.currentChapter)
  if (successorId && chapterIndex >= frontierIndex && chapterOrder.includes(successorId)) {
    next.currentChapter = successorId
  }
  return next
}

// A course update may move words between chapters of the same book without
// relocking chapters the learner already finished. A word that now belongs to
// such a chapter was never taught by its prep, so it is scheduled for review
// the way finishing that chapter would have scheduled it.
export function introduceWordsOfCompletedChapters(
  state: GhesseState,
  chapters: readonly { id: string; new: readonly string[] }[],
  now: number,
): GhesseState {
  let words: Record<string, WordProgress> | undefined
  for (const chapter of chapters) {
    if (state.chapters[chapter.id]?.completed !== true) continue
    for (const id of chapter.new) {
      const existing = state.words[id]
      if (existing?.introduced) continue
      words ??= { ...state.words }
      const base = existing ?? blankWordProgress(now)
      words[id] = scheduleAfterChapter({ ...base, firstSeenAt: base.firstSeenAt ?? now }, now)
    }
  }
  return words ? { ...state, words } : state
}
