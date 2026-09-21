import type { ExamProgress, GhesseState, ChapterProgress, WordProgress, RetrievalMode, SkillDimension, SkillStat } from './types'

export const STORAGE_KEY = 'ghesse:state:v6'
const BACKUP_KEY = 'ghesse:state:v6:backup'
const LEGACY_KEYS = ['ghesse:state:v5', 'ghesse:state:v4', 'ghesse:state:v3', 'ghesse:state:v2', 'ghesse:state:v1'] as const
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024

export function emptyState(now: number, firstChapterId: string): GhesseState {
  return {
    version: 6,
    currentChapter: firstChapterId,
    chapters: {},
    words: {},
    exams: {},
    soundOn: true,
    showFaDefault: false,
    narratorVoiceURI: '',
    narratorRate: 0.92,
    dailyReviewGoal: 15,
    created: now,
  }
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function timestamp(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined
}

function text(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function narratorRate(v: unknown): number {
  const value = num(v, 0.92)
  return Math.min(1.1, Math.max(0.75, value))
}

function reviewGoal(v: unknown): number {
  const value = Math.round(num(v, 15))
  return [10, 15, 20, 25].includes(value) ? value : 15
}

function normalizeChapter(raw: unknown): ChapterProgress | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Partial<ChapterProgress>
  const completed = r.completed === true
  const completedAt = timestamp(r.completedAt)
  const lastReadAt = timestamp(r.lastReadAt) ?? completedAt
  return {
    preparedAt: timestamp(r.preparedAt) ?? (completed ? completedAt ?? lastReadAt ?? 1 : undefined),
    prepAttempts: Math.max(0, Math.floor(num(r.prepAttempts, completed ? 1 : 0))),
    prepPretestCorrect: r.prepPretestCorrect === undefined ? undefined : Math.max(0, Math.floor(num(r.prepPretestCorrect))),
    prepPretestTotal: r.prepPretestTotal === undefined ? undefined : Math.max(0, Math.floor(num(r.prepPretestTotal))),
    prepFirstPassCorrect: r.prepFirstPassCorrect === undefined ? undefined : Math.max(0, Math.floor(num(r.prepFirstPassCorrect))),
    prepTotal: r.prepTotal === undefined ? undefined : Math.max(0, Math.floor(num(r.prepTotal))),
    prepProductiveCorrect: r.prepProductiveCorrect === undefined ? undefined : Math.max(0, Math.floor(num(r.prepProductiveCorrect))),
    prepProductiveTotal: r.prepProductiveTotal === undefined ? undefined : Math.max(0, Math.floor(num(r.prepProductiveTotal))),
    prepWrittenCorrect: r.prepWrittenCorrect === undefined ? undefined : Math.max(0, Math.floor(num(r.prepWrittenCorrect))),
    prepWrittenTotal: r.prepWrittenTotal === undefined ? undefined : Math.max(0, Math.floor(num(r.prepWrittenTotal))),
    prepListeningCorrect: r.prepListeningCorrect === undefined ? undefined : Math.max(0, Math.floor(num(r.prepListeningCorrect))),
    prepListeningTotal: r.prepListeningTotal === undefined ? undefined : Math.max(0, Math.floor(num(r.prepListeningTotal))),
    completed,
    completedAt,
    lastReadAt,
    checksCorrect: Math.max(0, Math.floor(num(r.checksCorrect))),
    checksTotal: Math.max(0, Math.floor(num(r.checksTotal))),
    reads: completed ? Math.max(1, Math.floor(num(r.reads, 1))) : Math.max(0, Math.floor(num(r.reads))),
  }
}

function normalizeDays(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return [...new Set(v.filter((x): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)))].sort()
}

function normalizeMode(v: unknown): RetrievalMode | undefined {
  return v === 'recognition' || v === 'reverse' || v === 'cloze' || v === 'productive' || v === 'contextProductive' || v === 'spelling' ? v : undefined
}

function normalizeSkillStat(v: unknown): SkillStat {
  if (!v || typeof v !== 'object') return { correct: 0, wrong: 0 }
  const r = v as Partial<SkillStat>
  return {
    correct: Math.max(0, Math.floor(num(r.correct))),
    wrong: Math.max(0, Math.floor(num(r.wrong))),
  }
}

function normalizeSkillStats(v: unknown): Record<SkillDimension, SkillStat> {
  const r = v && typeof v === 'object' ? v as Partial<Record<SkillDimension, SkillStat>> : {}
  return {
    meaning: normalizeSkillStat(r.meaning),
    context: normalizeSkillStat(r.context),
    production: normalizeSkillStat(r.production),
    form: normalizeSkillStat(r.form),
  }
}

function normalizeWord(raw: unknown): WordProgress | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Partial<WordProgress>
  const intervalDays = Math.max(0, Math.min(3650, num(r.intervalDays)))
  const reviewStage = Math.max(0, Math.min(8, Math.floor(num(r.reviewStage))))
  const reviewCorrect = Math.max(0, Math.floor(num(r.reviewCorrect)))
  const productiveCorrect = Math.max(0, Math.floor(num(r.productiveCorrect)))
  const skillStats = normalizeSkillStats(r.skillStats)
  if (!r.skillStats) {
    // v5 and earlier did not persist per-skill aggregates. Preserve only what
    // can be conservatively inferred from the old staged review path; never
    // fabricate spelling evidence.
    skillStats.meaning.correct = reviewStage >= 2 ? Math.min(2, Math.max(1, reviewCorrect)) : reviewCorrect > 0 ? 1 : 0
    skillStats.context.correct = reviewStage >= 3 ? 1 : 0
    skillStats.production.correct = productiveCorrect
  }
  return {
    introduced: r.introduced === true,
    taps: Math.max(0, Math.floor(num(r.taps))),
    checkCorrect: Math.max(0, Math.floor(num(r.checkCorrect))),
    checkWrong: Math.max(0, Math.floor(num(r.checkWrong))),
    firstSeenAt: timestamp(r.firstSeenAt),
    lastCheckAt: timestamp(r.lastCheckAt),
    reviewStage,
    reviewCorrect,
    reviewWrong: Math.max(0, Math.floor(num(r.reviewWrong))),
    reviewStreak: Math.max(0, Math.floor(num(r.reviewStreak))),
    dueAt: timestamp(r.dueAt),
    lastReviewedAt: timestamp(r.lastReviewedAt),
    lastIndependentSuccessAt: timestamp(r.lastIndependentSuccessAt),
    intervalDays,
    productiveCorrect,
    successDays: normalizeDays(r.successDays),
    productiveSuccessDays: normalizeDays(r.productiveSuccessDays),
    lastReviewWasCorrect: typeof r.lastReviewWasCorrect === 'boolean' ? r.lastReviewWasCorrect : undefined,
    lastMode: normalizeMode(r.lastMode),
    difficulty: Math.min(10, Math.max(1, num(r.difficulty, 5))),
    stabilityDays: Math.max(0, Math.min(3650, num(r.stabilityDays, intervalDays))),
    lapses: Math.max(0, Math.floor(num(r.lapses))),
    retrievalMsTotal: Math.max(0, num(r.retrievalMsTotal)),
    retrievalMsCount: Math.max(0, Math.floor(num(r.retrievalMsCount))),
    skillStats,
    lastErrorMode: normalizeMode(r.lastErrorMode),
  }
}

function normalizeWordIdArray(v: unknown, validWordIds?: ReadonlySet<string>): string[] {
  if (!Array.isArray(v)) return []
  return [...new Set(v.filter((id): id is string => typeof id === 'string' && (!validWordIds || validWordIds.has(id))))]
}

function normalizeExam(raw: unknown, validWordIds?: ReadonlySet<string>): ExamProgress | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Partial<ExamProgress>
  return {
    attempts: Math.max(0, Math.floor(num(r.attempts))),
    passed: r.passed === true,
    passedAt: timestamp(r.passedAt),
    lastAttemptAt: timestamp(r.lastAttemptAt),
    lastScore: Math.min(1, Math.max(0, num(r.lastScore))),
    bestScore: Math.min(1, Math.max(0, num(r.bestScore))),
    lastProductiveScore: Math.min(1, Math.max(0, num(r.lastProductiveScore))),
    bestProductiveScore: Math.min(1, Math.max(0, num(r.bestProductiveScore))),
    missedWordIds: normalizeWordIdArray(r.missedWordIds, validWordIds),
    testedWordIds: normalizeWordIdArray(r.testedWordIds, validWordIds),
  }
}

function normalizeState(
  raw: unknown,
  now: number,
  firstChapterId: string,
  validChapterIds?: ReadonlySet<string>,
  validWordIds?: ReadonlySet<string>,
): GhesseState | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const p = raw as Partial<GhesseState> & { version?: number }
  const chapters: Record<string, ChapterProgress> = {}
  for (const [id, c] of Object.entries(p.chapters ?? {})) {
    if (validChapterIds && !validChapterIds.has(id)) continue
    const normalized = normalizeChapter(c)
    if (normalized) chapters[id] = normalized
  }
  const words: Record<string, WordProgress> = {}
  for (const [id, w] of Object.entries(p.words ?? {})) {
    if (validWordIds && !validWordIds.has(id)) continue
    const normalized = normalizeWord(w)
    if (normalized) words[id] = normalized
  }
  const exams: Record<string, ExamProgress> = {}
  for (const [id, exam] of Object.entries(p.exams ?? {})) {
    const normalized = normalizeExam(exam, validWordIds)
    if (normalized) exams[id] = normalized
  }
  const requested = typeof p.currentChapter === 'string' ? p.currentChapter : firstChapterId
  const currentChapter = validChapterIds && !validChapterIds.has(requested) ? firstChapterId : requested
  return {
    version: 6,
    currentChapter,
    chapters,
    words,
    exams,
    soundOn: p.soundOn !== false,
    showFaDefault: p.showFaDefault === true,
    narratorVoiceURI: text(p.narratorVoiceURI),
    narratorRate: narratorRate(p.narratorRate),
    dailyReviewGoal: reviewGoal(p.dailyReviewGoal),
    created: num(p.created, now),
  }
}

function parseStored(
  raw: string | null,
  now: number,
  firstChapterId: string,
  validChapterIds?: ReadonlySet<string>,
  validWordIds?: ReadonlySet<string>,
): GhesseState | undefined {
  if (!raw) return undefined
  try {
    return normalizeState(JSON.parse(raw), now, firstChapterId, validChapterIds, validWordIds)
  } catch {
    return undefined
  }
}

export function loadState(
  now: number,
  firstChapterId: string,
  validChapterIds?: Iterable<string>,
  validWordIds?: Iterable<string>,
): GhesseState {
  const validChapters = validChapterIds ? new Set(validChapterIds) : undefined
  const validWords = validWordIds ? new Set(validWordIds) : undefined
  try {
    const primary = parseStored(localStorage.getItem(STORAGE_KEY), now, firstChapterId, validChapters, validWords)
    if (primary) return primary
    const backup = parseStored(localStorage.getItem(BACKUP_KEY), now, firstChapterId, validChapters, validWords)
    if (backup) return backup
    for (const key of LEGACY_KEYS) {
      const legacy = parseStored(localStorage.getItem(key), now, firstChapterId, validChapters, validWords)
      if (legacy) return legacy
    }
  } catch {
    // Keep app usable in memory when persistent storage is unavailable.
  }
  return emptyState(now, firstChapterId)
}

export function importStateJson(
  json: string,
  now: number,
  firstChapterId: string,
  validChapterIds?: Iterable<string>,
  validWordIds?: Iterable<string>,
): GhesseState {
  if (new Blob([json]).size > MAX_IMPORT_BYTES) throw new Error('فایل پیشرفت بیش از حد بزرگ است.')
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error('فایل پیشرفت JSON معتبر نیست.')
  }
  const state = normalizeState(
    raw,
    now,
    firstChapterId,
    validChapterIds ? new Set(validChapterIds) : undefined,
    validWordIds ? new Set(validWordIds) : undefined,
  )
  if (!state) throw new Error('ساختار فایل پیشرفت معتبر نیست.')
  return state
}

export function saveState(state: GhesseState): boolean {
  try {
    const previous = localStorage.getItem(STORAGE_KEY)
    if (previous) localStorage.setItem(BACKUP_KEY, previous)
    const next = JSON.stringify(state)
    localStorage.setItem(STORAGE_KEY, next)
    return localStorage.getItem(STORAGE_KEY) === next
  } catch {
    return false
  }
}

export function resetState(firstChapterId: string): GhesseState {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(BACKUP_KEY)
    for (const key of LEGACY_KEYS) localStorage.removeItem(key)
  } catch {
    // Keep reset semantics in memory.
  }
  return emptyState(Date.now(), firstChapterId)
}
