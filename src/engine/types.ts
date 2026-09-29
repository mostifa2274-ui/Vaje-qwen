// Ghesse progress model — version 6 adds skill-diagnostic mastery.
// Story exposure introduces vocabulary; durable mastery requires spaced,
// unassisted retrieval with productive recall across different days.

export type RetrievalMode = 'recognition' | 'reverse' | 'cloze' | 'productive' | 'contextProductive' | 'spelling'
export type SkillDimension = 'meaning' | 'context' | 'production' | 'form'

export interface SkillStat {
  correct: number
  wrong: number
}

export interface ChapterProgress {
  preparedAt?: number
  prepAttempts: number
  prepPretestCorrect?: number
  prepPretestTotal?: number
  prepFirstPassCorrect?: number
  prepTotal?: number
  // Legacy prep metrics retained for backwards-compatible imports.
  prepProductiveCorrect?: number
  prepProductiveTotal?: number

  // Current chapter-unlock gate. An unfinished chapter is readable only after
  // every new word has passed both tests (100% written + 100% listening).
  prepWrittenCorrect?: number
  prepWrittenTotal?: number
  /** Correct on the learner's first encounter with each written prep item. */
  prepWrittenFirstPassCorrect?: number
  prepListeningCorrect?: number
  prepListeningTotal?: number
  /** Correct on the learner's first encounter with each listening prep item. */
  prepListeningFirstPassCorrect?: number
  // Optional prove-known path. It unlocks only after every chapter word is
  // produced from Persian and recognized from audio correctly on first try.
  // This is preparation evidence only; it never grants spaced mastery.
  prepDiagnosticPassed?: boolean
  prepDiagnosticTotal?: number
  completed: boolean
  completedAt?: number
  lastReadAt?: number
  checksCorrect: number
  checksTotal: number
  // First-pass score on the chapter's listening text; the chapter completes
  // only once every listening answer has been corrected to right.
  listeningCorrect?: number
  listeningTotal?: number
  reads: number
}

export interface WordProgress {
  introduced: boolean
  taps: number // assisted gloss opens — never mastery evidence
  checkCorrect: number // story-comprehension diagnostics only
  checkWrong: number
  firstSeenAt?: number
  lastCheckAt?: number

  // Spaced-retrieval evidence
  reviewStage: number
  reviewCorrect: number
  reviewWrong: number
  reviewStreak: number
  dueAt?: number
  lastReviewedAt?: number
  lastIndependentSuccessAt?: number
  lastProductiveSuccessAt?: number
  intervalDays: number
  productiveCorrect: number
  successDays: string[] // canonical learner-local YYYY-MM-DD day buckets after dayEvidenceVersion=1
  productiveSuccessDays: string[] // canonical learner-local productive-recall day buckets
  lastReviewWasCorrect?: boolean
  lastMode?: RetrievalMode

  // Adaptive-memory signals. These do not create mastery by themselves; they
  // tune scheduling and identify words that need more help.
  difficulty: number // 1 (easy) .. 10 (hard)
  stabilityDays: number // interval at which expected recall is ~90%
  lapses: number
  retrievalMsTotal: number
  retrievalMsCount: number
  skillStats: Record<SkillDimension, SkillStat>
  lastErrorMode?: RetrievalMode
}

export interface ExamProgress {
  attempts: number
  passed: boolean
  passedAt?: number
  lastAttemptAt?: number
  lastScore: number
  bestScore: number
  lastProductiveScore: number
  bestProductiveScore: number
  missedWordIds: string[]
  testedWordIds: string[]
}

// Leitner flashcards (pages/FlashcardsScreen, engine/leitner): a separate
// self-study deck over all words. Cards climb six boxes reviewed every 1, 2,
// 4, 8, 16 and 32 days; a miss sends a card back to box 1. It is practice
// only and never counts as mastery evidence for the course gates.
export type LeitnerDirection = 'enFa' | 'faEn' | 'listen' | 'mixed'
export type LeitnerScope = 'all' | 'learned' | 'book-1' | 'book-2' | 'book-3' | 'book-4' | 'book-5' | 'book-6' | 'book-7' | 'book-8'

export interface LeitnerCard {
  box: number // 1..6
  dueAt: number
  addedAt: number
  lastReviewedAt?: number
  reviews: number
  correct: number
  lapses: number
}

export interface LeitnerSettings {
  direction: LeitnerDirection
  scope: LeitnerScope
  newPerDay: number
  typed: boolean
}

/** One local calendar day of flashcard work. */
export interface LeitnerDay {
  reviewed: number
  correct: number
  added: number
}

export interface LeitnerState {
  cards: Record<string, LeitnerCard>
  settings: LeitnerSettings
  days: Record<string, LeitnerDay>
}

export interface GhesseState {
  version: 6
  /** Day-evidence semantics marker. Missing = legacy UTC/mixed day keys. */
  dayEvidenceVersion: 1
  currentChapter: string // retained for migration/history; gate engine is authoritative
  chapters: Record<string, ChapterProgress>
  words: Record<string, WordProgress>
  exams: Record<string, ExamProgress>
  soundOn: boolean
  showFaDefault: boolean
  narratorVoiceURI: string
  narratorRate: number
  dailyReviewGoal: number
  // Explore mode opens every chapter and test to look around. Only access
  // changes: the strict gates still decide what is recorded as progress.
  exploreAll: boolean
  leitner: LeitnerState
  /** Graded answers per local day (YYYY-MM-DD), for the daily goal and streak. */
  activity: Record<string, number>
  created: number
}

export interface WordEntry {
  id: string
  word: string
  fa: string
  ipa: string
  topic: string
  ex: string
  tr: string
  pos: string
  cefr: string
}

export interface Sentence {
  en: string
  fa: string
}

export interface Checkpoint {
  q: string
  options: string[]
  a: string
}

export interface Chapter {
  id: string
  book: number
  n: number
  titleFa: string
  titleEn: string
  new: string[]
  sentences: Sentence[]
  check: Checkpoint[]
}

export interface BookMeta {
  book: number
  titleFa: string
  titleEn: string
  cover: string
  taglineFa: string
}
