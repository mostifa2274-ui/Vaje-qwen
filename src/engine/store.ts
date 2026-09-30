import type { ExamProgress, GhesseState, ChapterProgress, WordProgress, RetrievalMode, SkillDimension, SkillStat } from './types'
import { emptyLeitner, normalizeLeitner } from './leitner'
import { mergeActivity, mergeLeitnerDays, normalizeActivity } from './activity'
import { dayKey, latestPlausibleDayKey, plausibleEvidenceTimestamp } from './days'

export const STORAGE_KEY = 'ghesse:state:v6'
export const PROGRESS_REPLACEMENT_KEY = 'ghesse:progress-replacement:v1'
const CURRENT_STATE_VERSION = 6
const BACKUP_KEY = 'ghesse:state:v6:backup'
const LEGACY_KEYS = ['ghesse:state:v5', 'ghesse:state:v4', 'ghesse:state:v3', 'ghesse:state:v2', 'ghesse:state:v1'] as const
// Prep, reading, review and exam drafts all live under this sessionStorage prefix.
const SESSION_DRAFT_PREFIX = 'ghesse:'
// The long end-of-book tests keep their draft in localStorage instead.
export const BOOK_TEST_DRAFT_PREFIX = 'ghesse:book-test:'
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024

export function emptyState(now: number, firstChapterId: string): GhesseState {
  return {
    version: CURRENT_STATE_VERSION,
    dayEvidenceVersion: 1,
    currentChapter: firstChapterId,
    chapters: {},
    words: {},
    exams: {},
    soundOn: true,
    showFaDefault: false,
    narratorVoiceURI: '',
    narratorRate: 0.92,
    dailyReviewGoal: 15,
    exploreAll: false,
    leitner: emptyLeitner(),
    activity: {},
    created: now,
  }
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function timestamp(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined
}

function scheduledTimestamp(v: unknown, now: number): number | undefined {
  const value = timestamp(v)
  if (value === undefined) return undefined
  // Smart Review never schedules beyond 365 days. A corrupted/imported
  // far-future due date should become reviewable now rather than disappear.
  return value <= now + 370 * 24 * 60 * 60 * 1000 ? value : now
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

function normalizeChapter(raw: unknown, now: number): ChapterProgress | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Partial<ChapterProgress>
  const completed = r.completed === true
  const completedAt = plausibleEvidenceTimestamp(r.completedAt, now)
  const lastReadAt = plausibleEvidenceTimestamp(r.lastReadAt, now) ?? completedAt
  const prepWrittenTotal = r.prepWrittenTotal === undefined ? undefined : Math.max(0, Math.floor(num(r.prepWrittenTotal)))
  const prepListeningTotal = r.prepListeningTotal === undefined ? undefined : Math.max(0, Math.floor(num(r.prepListeningTotal)))
  const prepWrittenFirstPassCorrect = r.prepWrittenFirstPassCorrect === undefined
    ? undefined
    : Math.min(prepWrittenTotal ?? Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(num(r.prepWrittenFirstPassCorrect))))
  const prepListeningFirstPassCorrect = r.prepListeningFirstPassCorrect === undefined
    ? undefined
    : Math.min(prepListeningTotal ?? Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(num(r.prepListeningFirstPassCorrect))))
  return {
    preparedAt: plausibleEvidenceTimestamp(r.preparedAt, now) ?? (completed ? completedAt ?? lastReadAt ?? 1 : undefined),
    prepAttempts: Math.max(0, Math.floor(num(r.prepAttempts, completed ? 1 : 0))),
    prepPretestCorrect: r.prepPretestCorrect === undefined ? undefined : Math.max(0, Math.floor(num(r.prepPretestCorrect))),
    prepPretestTotal: r.prepPretestTotal === undefined ? undefined : Math.max(0, Math.floor(num(r.prepPretestTotal))),
    prepFirstPassCorrect: r.prepFirstPassCorrect === undefined ? undefined : Math.max(0, Math.floor(num(r.prepFirstPassCorrect))),
    prepTotal: r.prepTotal === undefined ? undefined : Math.max(0, Math.floor(num(r.prepTotal))),
    prepProductiveCorrect: r.prepProductiveCorrect === undefined ? undefined : Math.max(0, Math.floor(num(r.prepProductiveCorrect))),
    prepProductiveTotal: r.prepProductiveTotal === undefined ? undefined : Math.max(0, Math.floor(num(r.prepProductiveTotal))),
    prepWrittenCorrect: r.prepWrittenCorrect === undefined ? undefined : Math.max(0, Math.floor(num(r.prepWrittenCorrect))),
    prepWrittenTotal,
    prepWrittenFirstPassCorrect,
    prepListeningCorrect: r.prepListeningCorrect === undefined ? undefined : Math.max(0, Math.floor(num(r.prepListeningCorrect))),
    prepListeningTotal,
    prepListeningFirstPassCorrect,
    prepDiagnosticPassed: r.prepDiagnosticPassed === true,
    prepDiagnosticTotal: r.prepDiagnosticTotal === undefined ? undefined : Math.max(0, Math.floor(num(r.prepDiagnosticTotal))),
    completed,
    completedAt,
    lastReadAt,
    checksCorrect: Math.max(0, Math.floor(num(r.checksCorrect))),
    checksTotal: Math.max(0, Math.floor(num(r.checksTotal))),
    listeningCorrect: r.listeningCorrect === undefined ? undefined : Math.max(0, Math.floor(num(r.listeningCorrect))),
    listeningTotal: r.listeningTotal === undefined ? undefined : Math.max(0, Math.floor(num(r.listeningTotal))),
    reads: completed ? Math.max(1, Math.floor(num(r.reads, 1))) : Math.max(0, Math.floor(num(r.reads))),
  }
}

function normalizeDays(v: unknown, now: number): string[] {
  if (!Array.isArray(v)) return []
  const newest = latestPlausibleDayKey(now)
  return [...new Set(v.filter((x): x is string => (
    typeof x === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(x)
    && x <= newest
  )))].sort()
}

function utcDayKey(time: number): string {
  return new Date(time).toISOString().slice(0, 10)
}

/**
 * v6 originally stored success-day buckets in UTC, then switched to learner
 * local days without a persisted semantics marker. We cannot reconstruct every
 * historical event timestamp, but the last successful retrieval timestamp is
 * authoritative. Canonicalizing that bucket prevents the upgrade boundary from
 * creating a false extra day, and the timestamp-based review engine prevents
 * same-local-day stage advancement thereafter.
 */
function reconcileLatestLegacyDay(days: string[], at: number | undefined): string[] {
  if (at === undefined) return days
  const local = dayKey(at)
  const utc = utcDayKey(at)
  const next = new Set(days)
  if (utc !== local) next.delete(utc)
  next.add(local)
  return [...next].sort()
}

function isProductiveMode(mode: RetrievalMode | undefined): boolean {
  return mode === 'productive' || mode === 'contextProductive' || mode === 'spelling'
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

function normalizeWord(raw: unknown, legacyDayEvidence: boolean, now: number): WordProgress | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Partial<WordProgress>
  const intervalDays = Math.max(0, Math.min(3650, num(r.intervalDays)))
  const reviewStage = Math.max(0, Math.min(8, Math.floor(num(r.reviewStage))))
  const reviewCorrect = Math.max(0, Math.floor(num(r.reviewCorrect)))
  const productiveCorrect = Math.max(0, Math.floor(num(r.productiveCorrect)))
  const skillStats = normalizeSkillStats(r.skillStats)
  const lastIndependentSuccessAt = plausibleEvidenceTimestamp(r.lastIndependentSuccessAt, now)
  const lastMode = normalizeMode(r.lastMode)
  const lastReviewWasCorrect = typeof r.lastReviewWasCorrect === 'boolean' ? r.lastReviewWasCorrect : undefined
  const inferredLastProductiveSuccessAt = plausibleEvidenceTimestamp(r.lastProductiveSuccessAt, now)
    ?? (lastReviewWasCorrect === true && isProductiveMode(lastMode) ? lastIndependentSuccessAt : undefined)
  let successDays = normalizeDays(r.successDays, now)
  let productiveSuccessDays = normalizeDays(r.productiveSuccessDays, now)
  if (legacyDayEvidence) {
    successDays = reconcileLatestLegacyDay(successDays, lastIndependentSuccessAt)
    productiveSuccessDays = reconcileLatestLegacyDay(productiveSuccessDays, inferredLastProductiveSuccessAt)
  }
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
    firstSeenAt: plausibleEvidenceTimestamp(r.firstSeenAt, now),
    lastCheckAt: plausibleEvidenceTimestamp(r.lastCheckAt, now),
    reviewStage,
    reviewCorrect,
    reviewWrong: Math.max(0, Math.floor(num(r.reviewWrong))),
    reviewStreak: Math.max(0, Math.floor(num(r.reviewStreak))),
    dueAt: scheduledTimestamp(r.dueAt, now),
    lastReviewedAt: plausibleEvidenceTimestamp(r.lastReviewedAt, now),
    lastIndependentSuccessAt,
    lastProductiveSuccessAt: inferredLastProductiveSuccessAt,
    intervalDays,
    productiveCorrect,
    successDays,
    productiveSuccessDays,
    lastReviewWasCorrect,
    lastMode,
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

function normalizeExam(raw: unknown, now: number, validWordIds?: ReadonlySet<string>): ExamProgress | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Partial<ExamProgress>
  const attempts = Math.max(0, Math.floor(num(r.attempts)))
  const hasAttempt = attempts > 0
  const passed = hasAttempt && r.passed === true
  return {
    attempts,
    passed,
    passedAt: passed ? plausibleEvidenceTimestamp(r.passedAt, now) : undefined,
    lastAttemptAt: hasAttempt ? plausibleEvidenceTimestamp(r.lastAttemptAt, now) : undefined,
    lastScore: hasAttempt ? Math.min(1, Math.max(0, num(r.lastScore))) : 0,
    bestScore: hasAttempt ? Math.min(1, Math.max(0, num(r.bestScore))) : 0,
    lastProductiveScore: hasAttempt ? Math.min(1, Math.max(0, num(r.lastProductiveScore))) : 0,
    bestProductiveScore: hasAttempt ? Math.min(1, Math.max(0, num(r.bestProductiveScore))) : 0,
    missedWordIds: hasAttempt ? normalizeWordIdArray(r.missedWordIds, validWordIds) : [],
    testedWordIds: hasAttempt ? normalizeWordIdArray(r.testedWordIds, validWordIds) : [],
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
  const p = raw as Partial<GhesseState> & { version?: number; dayEvidenceVersion?: number }
  if (typeof p.version === 'number' && (!Number.isInteger(p.version) || p.version < 1 || p.version > CURRENT_STATE_VERSION)) return undefined
  const legacyDayEvidence = p.dayEvidenceVersion !== 1
  const chapters: Record<string, ChapterProgress> = {}
  for (const [id, c] of Object.entries(p.chapters ?? {})) {
    if (validChapterIds && !validChapterIds.has(id)) continue
    const normalized = normalizeChapter(c, now)
    if (normalized) chapters[id] = normalized
  }
  const words: Record<string, WordProgress> = {}
  for (const [id, w] of Object.entries(p.words ?? {})) {
    if (validWordIds && !validWordIds.has(id)) continue
    const normalized = normalizeWord(w, legacyDayEvidence, now)
    if (normalized) words[id] = normalized
  }
  const exams: Record<string, ExamProgress> = {}
  for (const [id, exam] of Object.entries(p.exams ?? {})) {
    const normalized = normalizeExam(exam, now, validWordIds)
    if (normalized) exams[id] = normalized
  }
  const requested = typeof p.currentChapter === 'string' ? p.currentChapter : firstChapterId
  const currentChapter = validChapterIds && !validChapterIds.has(requested) ? firstChapterId : requested
  return {
    version: 6,
    dayEvidenceVersion: 1,
    currentChapter,
    chapters,
    words,
    exams,
    soundOn: p.soundOn !== false,
    showFaDefault: p.showFaDefault === true,
    narratorVoiceURI: text(p.narratorVoiceURI),
    narratorRate: narratorRate(p.narratorRate),
    dailyReviewGoal: reviewGoal(p.dailyReviewGoal),
    exploreAll: p.exploreAll === true,
    leitner: normalizeLeitner(p.leitner, now, validWordIds),
    activity: normalizeActivity(p.activity, now),
    created: plausibleEvidenceTimestamp(p.created, now) ?? now,
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
    const parsed = JSON.parse(raw)
    if (!isRecognizableProgressState(parsed)) return undefined
    return normalizeState(parsed, now, firstChapterId, validChapterIds, validWordIds)
  } catch {
    return undefined
  }
}

export function loadPersistedState(
  now: number,
  firstChapterId: string,
  validChapterIds?: Iterable<string>,
  validWordIds?: Iterable<string>,
): GhesseState | undefined {
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
  return undefined
}

export function loadState(
  now: number,
  firstChapterId: string,
  validChapterIds?: Iterable<string>,
  validWordIds?: Iterable<string>,
): GhesseState {
  return loadPersistedState(now, firstChapterId, validChapterIds, validWordIds)
    ?? emptyState(now, firstChapterId)
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isRecognizableProgressState(raw: unknown): boolean {
  if (!isPlainRecord(raw)) return false
  const version = raw.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > CURRENT_STATE_VERSION) return false

  // Exported progress files always identify the current chapter and contain
  // the chapter/word maps. Older supported backups may predate exams, so that
  // map is optional, but when present it still has to be an object.
  return typeof raw.currentChapter === 'string'
    && isPlainRecord(raw.chapters)
    && isPlainRecord(raw.words)
    && (raw.exams === undefined || isPlainRecord(raw.exams))
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
  if (!isRecognizableProgressState(raw)) throw new Error('این فایل پشتیبان معتبر قصه نیست.')
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

function isValidStoredState(raw: string): boolean {
  try {
    return isRecognizableProgressState(JSON.parse(raw))
  } catch {
    return false
  }
}

let durableStorageRequested = false

/**
 * Progress lives only on this device, so ask the browser once per session to
 * keep this site's storage when space runs low. Browsers decide silently
 * (Chromium, Safari) or ask the learner once (Firefox); a refusal changes
 * nothing, and backups in Settings remain the safeguard.
 */
export function requestDurableStorage(storage: StorageManager | undefined = globalThis.navigator?.storage): void {
  if (durableStorageRequested || !storage?.persist || !storage.persisted) return
  durableStorageRequested = true
  void storage.persisted()
    .then(already => (already ? undefined : storage.persist()))
    .catch(() => undefined)
}

export function saveState(state: GhesseState): boolean {
  try {
    const previous = localStorage.getItem(STORAGE_KEY)
    const next = JSON.stringify(state)

    // Rotate only a structurally recognizable previous primary into backup.
    // Parseable-but-malformed objects such as {} are corruption too: if startup
    // recovered from the backup, repairing primary must not overwrite the
    // last-known good backup with those malformed bytes.
    if (previous && previous !== next && isValidStoredState(previous)) {
      localStorage.setItem(BACKUP_KEY, previous)
    }

    localStorage.setItem(STORAGE_KEY, next)
    return localStorage.getItem(STORAGE_KEY) === next
  } catch {
    return false
  }
}

/**
 * Persist an explicit reset/import as a replacement, not as an ordinary edit.
 * Recovery must never resurrect the state the learner intentionally replaced:
 * the rolling backup is aligned to the replacement when possible and every
 * supported legacy snapshot is discarded after the new primary is verified.
 */
export function replacePersistedState(state: GhesseState): boolean {
  let next: string
  try {
    next = JSON.stringify(state)
    localStorage.setItem(STORAGE_KEY, next)
    if (localStorage.getItem(STORAGE_KEY) !== next) return false
  } catch {
    return false
  }

  // Once the primary has been verified, the replacement really happened.
  // Cleanup is auxiliary: a legacy/remove failure must not make the caller
  // suppress the cross-tab replacement signal and let stale task state merge
  // back into the new snapshot.
  for (const key of LEGACY_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      // If removal itself is unavailable but writes still work, neutralize the
      // old fallback by replacing it with the new authoritative snapshot.
      try {
        localStorage.setItem(key, next)
      } catch {
        // The verified v6 primary remains authoritative; backup alignment below
        // still prevents a normal fallback from reviving pre-replacement state.
      }
    }
  }

  // Remove the pre-replacement fallback before attempting to mirror the new
  // state. If storage is too full for the duplicate copy, keeping no rolling
  // backup is safer than reviving progress the learner explicitly replaced.
  try {
    localStorage.removeItem(BACKUP_KEY)
  } catch {
    // Continue: setItem may still be available even when a storage shim or
    // browser policy rejects this auxiliary removal operation.
  }
  try {
    localStorage.setItem(BACKUP_KEY, next)
    if (localStorage.getItem(BACKUP_KEY) !== next) {
      try {
        localStorage.removeItem(BACKUP_KEY)
      } catch {
        // Do not turn a verified primary write into a false failure.
      }
    }
  } catch {
    try {
      localStorage.removeItem(BACKUP_KEY)
    } catch {
      // The verified primary remains authoritative.
    }
  }
  return true
}

function sameJsonValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
    return left.every((value, index) => sameJsonValue(value, right[index]))
  }
  if (
    left && right
    && typeof left === 'object'
    && typeof right === 'object'
  ) {
    const leftRecord = left as Record<string, unknown>
    const rightRecord = right as Record<string, unknown>
    const leftKeys = Object.keys(leftRecord).sort()
    const rightKeys = Object.keys(rightRecord).sort()
    if (leftKeys.length !== rightKeys.length) return false
    return leftKeys.every((key, index) => (
      key === rightKeys[index]
      && sameJsonValue(leftRecord[key], rightRecord[key])
    ))
  }
  return false
}

function mergeConcurrentValue<T>(base: T, local: T, remote: T): T | undefined {
  if (sameJsonValue(local, remote)) return local
  if (sameJsonValue(local, base)) return remote
  if (sameJsonValue(remote, base)) return local
  return undefined
}

function mergeConcurrentRecord<T>(
  base: Record<string, T>,
  local: Record<string, T>,
  remote: Record<string, T>,
): Record<string, T> | undefined {
  const merged: Record<string, T> = {}
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])
  for (const key of keys) {
    const value = mergeConcurrentValue(base[key], local[key], remote[key])
    if (value === undefined) {
      const baseHas = Object.prototype.hasOwnProperty.call(base, key)
      const localHas = Object.prototype.hasOwnProperty.call(local, key)
      const remoteHas = Object.prototype.hasOwnProperty.call(remote, key)
      // A genuine three-way deletion can resolve to "missing"; only treat
      // undefined as a conflict when one side still has a record to preserve.
      if (baseHas || localHas || remoteHas) {
        const localSameAsBase = sameJsonValue(local[key], base[key]) && localHas === baseHas
        const remoteSameAsBase = sameJsonValue(remote[key], base[key]) && remoteHas === baseHas
        if (localSameAsBase && !remoteHas) continue
        if (remoteSameAsBase && !localHas) continue
        if (!localHas && !remoteHas) continue
        return undefined
      }
      continue
    }
    merged[key] = value
  }
  return merged
}

/**
 * Three-way merge for a full state snapshot produced by a screen that may be
 * stale relative to localStorage. Learning records are atomic: independent
 * records can merge, but divergent edits to the same chapter/word/exam are
 * rejected rather than fabricating mastery evidence.
 */
export function mergeConcurrentState(
  base: GhesseState,
  local: GhesseState,
  remote: GhesseState,
): GhesseState | undefined {
  const chapters = mergeConcurrentRecord(base.chapters, local.chapters, remote.chapters)
  const words = mergeConcurrentRecord(base.words, local.words, remote.words)
  const exams = mergeConcurrentRecord(base.exams, local.exams, remote.exams)
  // Flashcards merge card by card and day by day, like the learning records.
  const leitnerCards = mergeConcurrentRecord(base.leitner.cards, local.leitner.cards, remote.leitner.cards)
  const leitnerDays = mergeLeitnerDays(base.leitner.days, local.leitner.days, remote.leitner.days)
  const leitnerSettings = mergeConcurrentValue(base.leitner.settings, local.leitner.settings, remote.leitner.settings)
  if (!chapters || !words || !exams || !leitnerCards || !leitnerDays || !leitnerSettings) return undefined

  const currentChapter = mergeConcurrentValue(base.currentChapter, local.currentChapter, remote.currentChapter)
  const soundOn = mergeConcurrentValue(base.soundOn, local.soundOn, remote.soundOn)
  const showFaDefault = mergeConcurrentValue(base.showFaDefault, local.showFaDefault, remote.showFaDefault)
  const narratorVoiceURI = mergeConcurrentValue(base.narratorVoiceURI, local.narratorVoiceURI, remote.narratorVoiceURI)
  const narratorRate = mergeConcurrentValue(base.narratorRate, local.narratorRate, remote.narratorRate)
  const dailyReviewGoal = mergeConcurrentValue(base.dailyReviewGoal, local.dailyReviewGoal, remote.dailyReviewGoal)
  const exploreAll = mergeConcurrentValue(base.exploreAll, local.exploreAll, remote.exploreAll)
  const created = mergeConcurrentValue(base.created, local.created, remote.created)

  if (
    currentChapter === undefined
    || soundOn === undefined
    || showFaDefault === undefined
    || narratorVoiceURI === undefined
    || narratorRate === undefined
    || dailyReviewGoal === undefined
    || exploreAll === undefined
    || created === undefined
  ) return undefined

  return {
    version: CURRENT_STATE_VERSION,
    dayEvidenceVersion: 1,
    currentChapter,
    chapters,
    words,
    exams,
    soundOn,
    showFaDefault,
    narratorVoiceURI,
    narratorRate,
    dailyReviewGoal,
    exploreAll,
    leitner: { cards: leitnerCards, settings: leitnerSettings, days: leitnerDays },
    activity: mergeActivity(base.activity, local.activity, remote.activity),
    created,
  }
}

export interface ProgressSummary {
  completedChapters: number
  introducedWords: number
  passedExams: number
}

export function summarizeProgress(state: GhesseState): ProgressSummary {
  return {
    completedChapters: Object.values(state.chapters).filter(chapter => chapter.completed).length,
    introducedWords: Object.values(state.words).filter(word => word.introduced).length,
    passedExams: Object.values(state.exams).filter(exam => exam.attempts > 0 && exam.passed).length,
  }
}

function removeKeys(storage: Storage, prefix: string): void {
  const keys: string[] = []
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (key?.startsWith(prefix)) keys.push(key)
  }
  for (const key of keys) storage.removeItem(key)
}

/**
 * In-progress drafts belong to the progress they were started from. After a
 * reset or an imported replacement they would resume stale work, so every
 * Ghesse draft in this tab is dropped, and the end-of-book test drafts that
 * are kept across tabs too.
 */
export function clearSessionDrafts(): void {
  try {
    removeKeys(sessionStorage, SESSION_DRAFT_PREFIX)
  } catch {
    // Drafts are optional resilience; an unavailable store has none to clear.
  }
  try {
    removeKeys(localStorage, BOOK_TEST_DRAFT_PREFIX)
  } catch {
    // As above.
  }
}

export function signalProgressReplacement(): string | undefined {
  try {
    const token = `${Date.now()}:${Math.random().toString(36).slice(2)}`
    localStorage.setItem(PROGRESS_REPLACEMENT_KEY, token)
    return localStorage.getItem(PROGRESS_REPLACEMENT_KEY) === token ? token : undefined
  } catch {
    return undefined
  }
}

export function resetState(firstChapterId: string): GhesseState {
  const fresh = emptyState(Date.now(), firstChapterId)
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(BACKUP_KEY)
    for (const key of LEGACY_KEYS) localStorage.removeItem(key)
    // Persist the reset before returning. Other open tabs then see an explicit
    // fresh snapshot instead of a momentary missing key they could overwrite
    // with an older full-state save.
    saveState(fresh)
  } catch {
    // Keep reset semantics in memory.
  }
  clearSessionDrafts()
  return fresh
}
