import type { GhesseState, WordProgress } from './types'
import { blankWordProgress, scheduleAfterChapter } from './review'
import { READING_QUESTION_COUNT } from './comprehension'

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
  const alreadyUsedCurrentGate = (previous?.prepWrittenTotal ?? 0) > 0 || (previous?.prepListeningTotal ?? 0) > 0
  const tuneDifficulty = !alreadyUsedCurrentGate

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
        prepListeningCorrect: wordIds.length,
        prepListeningTotal: wordIds.length,
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

export function recordCompletedRead(
  state: GhesseState,
  chapterId: string,
  wordIds: string[],
  firstPassChecksCorrect: number,
  checksTotal: number,
  verifiedChecksCorrect: number,
  now: number,
  chapterOrder: readonly string[],
  successorId?: string,
): GhesseState {
  const previous = state.chapters[chapterId]

  const hasCurrentPrepGate = Boolean(
    previous?.preparedAt
    && wordIds.length > 0
    && previous.prepWrittenCorrect === wordIds.length
    && previous.prepWrittenTotal === wordIds.length
    && previous.prepListeningCorrect === wordIds.length
    && previous.prepListeningTotal === wordIds.length,
  )
  const canRereadLegacyCompletion = previous?.completed === true
  const comprehensionVerified = checksTotal === READING_QUESTION_COUNT && verifiedChecksCorrect === READING_QUESTION_COUNT

  // Engine-level fail-closed completion gate. UI bugs or direct callers cannot
  // complete an unfinished chapter without the 100% prep gate and corrected
  // comprehension. Legacy chapters already marked complete remain rereadable.
  if ((!hasCurrentPrepGate && !canRereadLegacyCompletion) || !comprehensionVerified) return state

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
