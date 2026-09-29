import type { GhesseState, SkillDimension } from './types'

const DAY = 86_400_000
const DIMENSIONS: SkillDimension[] = ['meaning', 'context', 'production', 'form']

function accuracy(correct: number, wrong: number): number | null {
  const total = correct + wrong
  return total > 0 ? correct / total : null
}

function rounded(value: number, places = 3): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function skillSnapshot(state: GhesseState, id: string) {
  const progress = state.words[id]
  return Object.fromEntries(DIMENSIONS.map(dimension => {
    const stat = progress?.skillStats?.[dimension] ?? { correct: 0, wrong: 0 }
    return [dimension, { correct: stat.correct, wrong: stat.wrong, accuracy: accuracy(stat.correct, stat.wrong) }]
  }))
}

/**
 * Explicitly user-exported research snapshot without raw answers, recordings,
 * absolute dates or device/account identifiers.
 */
export function buildResearchExport(state: GhesseState, now = Date.now()) {
  const words = Object.entries(state.words)
    .filter(([, progress]) => progress.introduced)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, progress]) => ({
      id,
      reviewStage: progress.reviewStage,
      reviewCorrect: progress.reviewCorrect,
      reviewWrong: progress.reviewWrong,
      recallAccuracy: accuracy(progress.reviewCorrect, progress.reviewWrong),
      productiveCorrect: progress.productiveCorrect,
      successDays: progress.successDays.length,
      productiveSuccessDays: progress.productiveSuccessDays.length,
      intervalDays: rounded(progress.intervalDays),
      stabilityDays: rounded(progress.stabilityDays),
      difficulty: rounded(progress.difficulty),
      lapses: progress.lapses,
      averageRetrievalMs: progress.retrievalMsCount > 0 ? Math.round(progress.retrievalMsTotal / progress.retrievalMsCount) : null,
      skills: skillSnapshot(state, id),
    }))

  const chapters = Object.entries(state.chapters)
    .filter(([, progress]) => progress.completed || progress.preparedAt)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, progress]) => ({
      id,
      prepared: Boolean(progress.preparedAt),
      completed: progress.completed,
      prepAttempts: progress.prepAttempts,
      writtenAccuracy: accuracy(progress.prepWrittenCorrect ?? 0, Math.max(0, (progress.prepWrittenTotal ?? 0) - (progress.prepWrittenCorrect ?? 0))),
      listeningWordAccuracy: accuracy(progress.prepListeningCorrect ?? 0, Math.max(0, (progress.prepListeningTotal ?? 0) - (progress.prepListeningCorrect ?? 0))),
      firstPassReadingAccuracy: accuracy(progress.checksCorrect, Math.max(0, progress.checksTotal - progress.checksCorrect)),
      firstPassListeningAccuracy: accuracy(progress.listeningCorrect ?? 0, Math.max(0, (progress.listeningTotal ?? 0) - (progress.listeningCorrect ?? 0))),
      reads: progress.reads,
    }))

  const exams = Object.entries(state.exams)
    .filter(([, exam]) => exam.attempts > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, exam]) => ({
      id, attempts: exam.attempts, passed: exam.passed,
      lastScore: rounded(exam.lastScore), bestScore: rounded(exam.bestScore),
      lastProductiveScore: rounded(exam.lastProductiveScore), bestProductiveScore: rounded(exam.bestProductiveScore),
      missedWordCount: exam.missedWordIds.length, testedWordCount: exam.testedWordIds.length,
    }))

  return {
    schemaVersion: 1,
    product: 'Ghesse',
    exportPurpose: 'voluntary-learning-outcomes-research',
    privacy: 'No raw answers, recordings, absolute dates, device IDs or account identifiers.',
    courseAgeDays: Math.max(0, Math.floor((now - state.created) / DAY)),
    settings: { dailyReviewGoal: state.dailyReviewGoal },
    totals: {
      introducedWords: words.length,
      completedChapters: chapters.filter(chapter => chapter.completed).length,
      attemptedExams: exams.length,
    },
    words, chapters, exams,
  }
}
