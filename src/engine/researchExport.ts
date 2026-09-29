import { CHAPTERS, VOCAB } from '../data/chapters'
import { wordMastery, type MasteryLevel } from './mastery'
import type { GhesseState, SkillDimension, SkillStat } from './types'
import { BUILD_COMMIT, VOCABULARY_SHA256 } from './release'

export const RESEARCH_PROTOCOL_ID = 'ghesse-learning-outcomes-v1'

export interface ResearchWordRow {
  id: string
  mastery: MasteryLevel
  reviewCorrect: number
  reviewWrong: number
  productiveCorrect: number
  successDayCount: number
  productiveDayCount: number
  successSpanDays: number
  intervalDays: number
  difficulty: number
  stabilityDays: number
  lapses: number
  averageResponseMs: number | null
  skillStats: Record<SkillDimension, SkillStat>
}

export interface ResearchReport {
  schemaVersion: 1
  privacy: {
    containsIdentity: false
    containsRawAnswers: false
    containsExactTimestamps: false
    containsRecordings: false
  }
  identity: {
    buildCommit: string
    vocabularySha256: string
    protocolId: string
  }
  course: {
    vocabularySize: number
    chapterCount: number
  }
  summary: {
    completedChapters: number
    introducedWords: number
    gradedAnswers: number
    activeDayCount: number
    independentReviews: number
    independentReviewAccuracy: number | null
    productiveCorrect: number
    lapses: number
    examsPassed: number
    mastery: Record<MasteryLevel, number>
  }
  words: ResearchWordRow[]
  chapters: Array<{
    id: string
    completed: boolean
    prepAttempts: number
    preparationPath: 'taught' | 'prove-known' | 'legacy'
    writtenCoverage: number | null
    writtenFirstPass: number | null
    listeningCoverage: number | null
    listeningFirstPass: number | null
    diagnosticPerfect: boolean
    readingFirstPass: number | null
    chapterListeningFirstPass: number | null
    reads: number
  }>
  exams: Array<{
    id: string
    attempts: number
    passed: boolean
    lastScore: number
    bestScore: number
    lastProductiveScore: number
    bestProductiveScore: number
    missedWordCount: number
    testedWordCount: number
  }>
}

const DAY_MS = 86_400_000
const MASTERY_LEVELS: MasteryLevel[] = ['new', 'seen', 'learning', 'strong', 'mastered']

function ratio(correct: number | undefined, total: number | undefined): number | null {
  if (!total || total <= 0 || correct === undefined) return null
  return Math.max(0, Math.min(1, correct / total))
}

function daySpan(days: readonly string[]): number {
  if (days.length < 2) return 0
  const sorted = [...days].sort()
  const first = Date.parse(`${sorted[0]}T12:00:00Z`)
  const last = Date.parse(`${sorted[sorted.length - 1]}T12:00:00Z`)
  if (!Number.isFinite(first) || !Number.isFinite(last)) return 0
  return Math.max(0, Math.round((last - first) / DAY_MS))
}

function copySkillStats(stats: Record<SkillDimension, SkillStat>): Record<SkillDimension, SkillStat> {
  return {
    meaning: { ...stats.meaning },
    context: { ...stats.context },
    production: { ...stats.production },
    form: { ...stats.form },
  }
}

/**
 * Build a research-friendly, de-identified snapshot.
 *
 * It deliberately excludes exact timestamps, calendar-day strings, settings,
 * typed answers, narration choices, free-text content and pronunciation audio.
 * Sharing the resulting file is always a separate user action.
 */
export function buildResearchReport(state: GhesseState): ResearchReport {
  const introducedIds = VOCAB.map(word => word.id).filter(id => state.words[id]?.introduced)
  const mastery = Object.fromEntries(MASTERY_LEVELS.map(level => [level, 0])) as Record<MasteryLevel, number>

  const words: ResearchWordRow[] = introducedIds.map(id => {
    const progress = state.words[id]!
    const level = wordMastery(id, state)
    mastery[level]++
    return {
      id,
      mastery: level,
      reviewCorrect: progress.reviewCorrect,
      reviewWrong: progress.reviewWrong,
      productiveCorrect: progress.productiveCorrect,
      successDayCount: progress.successDays.length,
      productiveDayCount: progress.productiveSuccessDays.length,
      successSpanDays: daySpan(progress.successDays),
      intervalDays: progress.intervalDays,
      difficulty: Number(progress.difficulty.toFixed(3)),
      stabilityDays: Number(progress.stabilityDays.toFixed(3)),
      lapses: progress.lapses,
      averageResponseMs: progress.retrievalMsCount > 0
        ? Math.round(progress.retrievalMsTotal / progress.retrievalMsCount)
        : null,
      skillStats: copySkillStats(progress.skillStats),
    }
  })

  const independentCorrect = words.reduce((sum, word) => sum + word.reviewCorrect, 0)
  const independentWrong = words.reduce((sum, word) => sum + word.reviewWrong, 0)
  const independentReviews = independentCorrect + independentWrong

  const chapters = CHAPTERS.flatMap(chapter => {
    const progress = state.chapters[chapter.id]
    if (!progress) return []
    const preparationPath: 'taught' | 'prove-known' | 'legacy' = progress.prepDiagnosticPassed
      ? 'prove-known'
      : (progress.prepWrittenTotal ?? 0) > 0 || (progress.prepListeningTotal ?? 0) > 0
        ? 'taught'
        : 'legacy'
    return [{
      id: chapter.id,
      completed: progress.completed,
      prepAttempts: progress.prepAttempts,
      preparationPath,
      writtenCoverage: ratio(progress.prepWrittenCorrect, progress.prepWrittenTotal),
      writtenFirstPass: ratio(progress.prepWrittenFirstPassCorrect, progress.prepWrittenTotal),
      listeningCoverage: ratio(progress.prepListeningCorrect, progress.prepListeningTotal),
      listeningFirstPass: ratio(progress.prepListeningFirstPassCorrect, progress.prepListeningTotal),
      diagnosticPerfect: progress.prepDiagnosticPassed === true,
      readingFirstPass: ratio(progress.checksCorrect, progress.checksTotal),
      chapterListeningFirstPass: ratio(progress.listeningCorrect, progress.listeningTotal),
      reads: progress.reads,
    }]
  })

  const exams = Object.entries(state.exams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, progress]) => ({
      id,
      attempts: progress.attempts,
      passed: progress.passed,
      lastScore: progress.lastScore,
      bestScore: progress.bestScore,
      lastProductiveScore: progress.lastProductiveScore,
      bestProductiveScore: progress.bestProductiveScore,
      missedWordCount: progress.missedWordIds.length,
      testedWordCount: progress.testedWordIds.length,
    }))

  return {
    schemaVersion: 1,
    privacy: {
      containsIdentity: false,
      containsRawAnswers: false,
      containsExactTimestamps: false,
      containsRecordings: false,
    },
    identity: {
      buildCommit: BUILD_COMMIT,
      vocabularySha256: VOCABULARY_SHA256,
      protocolId: RESEARCH_PROTOCOL_ID,
    },
    course: {
      vocabularySize: VOCAB.length,
      chapterCount: CHAPTERS.length,
    },
    summary: {
      completedChapters: chapters.filter(chapter => chapter.completed).length,
      introducedWords: introducedIds.length,
      gradedAnswers: Object.values(state.activity).reduce((sum, count) => sum + count, 0),
      activeDayCount: Object.values(state.activity).filter(count => count > 0).length,
      independentReviews,
      independentReviewAccuracy: independentReviews > 0 ? independentCorrect / independentReviews : null,
      productiveCorrect: words.reduce((sum, word) => sum + word.productiveCorrect, 0),
      lapses: words.reduce((sum, word) => sum + word.lapses, 0),
      examsPassed: exams.filter(exam => exam.passed).length,
      mastery,
    },
    words,
    chapters,
    exams,
  }
}
