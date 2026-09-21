import type { GhesseState } from './types'
import { blankWordProgress, scheduleAfterChapter } from './review'

export function recordPreparedChapter(
  state: GhesseState,
  chapterId: string,
  wordIds: string[],
  pretestCorrect: number,
  pretestTotal: number,
  pretestMissedIds: readonly string[],
  firstPassCorrect: number,
  productiveCorrect: number,
  productiveTotal: number,
  recognitionMissedIds: readonly string[],
  productiveMissedIds: readonly string[],
  now: number,
): GhesseState {
  const previous = state.chapters[chapterId]
  const words = { ...state.words }
  const pretestMissed = new Set(pretestMissedIds)
  const recognitionMissed = new Set(recognitionMissedIds)
  const productiveMissed = new Set(productiveMissedIds)
  const tuneDifficulty = !previous?.preparedAt
  for (const id of wordIds) {
    const existing = words[id] ?? blankWordProgress(now)
    // Prep is diagnostic, not long-term retrieval evidence. It only tunes the
    // initial difficulty so later spacing reacts to actual learner friction.
    const difficultyDelta = tuneDifficulty
      ? (pretestMissed.has(id) ? 0.35 : -0.08) + (recognitionMissed.has(id) ? 0.55 : -0.07) + (productiveMissed.has(id) ? 0.9 : 0)
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
        preparedAt: now,
        prepAttempts: (previous?.prepAttempts ?? 0) + 1,
        prepPretestCorrect: pretestCorrect,
        prepPretestTotal: pretestTotal,
        prepFirstPassCorrect: firstPassCorrect,
        prepTotal: wordIds.length,
        prepProductiveCorrect: productiveCorrect,
        prepProductiveTotal: productiveTotal,
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
  checksCorrect: number,
  checksTotal: number,
  now: number,
  chapterOrder: readonly string[],
  successorId?: string,
): GhesseState {
  const previous = state.chapters[chapterId]
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
        preparedAt: previous?.preparedAt ?? now,
        prepAttempts: Math.max(1, previous?.prepAttempts ?? 0),
        prepPretestCorrect: previous?.prepPretestCorrect,
        prepPretestTotal: previous?.prepPretestTotal,
        prepFirstPassCorrect: previous?.prepFirstPassCorrect,
        prepTotal: previous?.prepTotal,
        prepProductiveCorrect: previous?.prepProductiveCorrect,
        prepProductiveTotal: previous?.prepProductiveTotal,
        completed: true,
        completedAt: previous?.completedAt ?? now,
        lastReadAt: now,
        checksCorrect,
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
