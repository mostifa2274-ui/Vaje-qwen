import type { GhesseState } from './types'
import { importStateJson, MAX_IMPORT_BYTES } from './store'
import { BUILD_COMMIT, VOCABULARY_SHA256 } from './release'

export const PROGRESS_BACKUP_FORMAT = 'ghesse-progress-backup'
export const PROGRESS_BACKUP_SCHEMA = 1

interface ProgressBackupPayload {
  format: typeof PROGRESS_BACKUP_FORMAT
  schemaVersion: typeof PROGRESS_BACKUP_SCHEMA
  exportedAt: number
  stateVersion: number
  buildCommit: string
  vocabularySha256: string
  state: GhesseState
}

interface ProgressBackupEnvelope extends ProgressBackupPayload {
  integrity: {
    algorithm: 'SHA-256'
    sha256: string
  }
}

export interface ProgressImportResult {
  state: GhesseState
  source: 'verified-envelope' | 'legacy'
  exportedAt?: number
  buildCommit?: string
  vocabularySha256?: string
  deckMatches: boolean | null
  notice: string
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

async function sha256Hex(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('این مرورگر امکان ساخت پشتیبانِ دارای بررسی سلامت را ندارد.')
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function canonicalPayload(value: {
  exportedAt: number
  stateVersion: number
  buildCommit: string
  vocabularySha256: string
  state: GhesseState
}): ProgressBackupPayload {
  return {
    format: PROGRESS_BACKUP_FORMAT,
    schemaVersion: PROGRESS_BACKUP_SCHEMA,
    exportedAt: value.exportedAt,
    stateVersion: value.stateVersion,
    buildCommit: value.buildCommit,
    vocabularySha256: value.vocabularySha256,
    state: value.state,
  }
}

export async function createProgressBackupJson(
  state: GhesseState,
  exportedAt = Date.now(),
): Promise<string> {
  const payload = canonicalPayload({
    exportedAt,
    stateVersion: state.version,
    buildCommit: BUILD_COMMIT,
    vocabularySha256: VOCABULARY_SHA256,
    state,
  })
  const sha256 = await sha256Hex(JSON.stringify(payload))
  const envelope: ProgressBackupEnvelope = {
    ...payload,
    integrity: { algorithm: 'SHA-256', sha256 },
  }
  return JSON.stringify(envelope, null, 2)
}

function parseEnvelope(raw: unknown): ProgressBackupEnvelope | undefined {
  if (!isPlainRecord(raw) || raw.format !== PROGRESS_BACKUP_FORMAT) return undefined
  if (
    raw.schemaVersion !== PROGRESS_BACKUP_SCHEMA
    || typeof raw.exportedAt !== 'number'
    || !Number.isFinite(raw.exportedAt)
    || raw.exportedAt <= 0
    || typeof raw.stateVersion !== 'number'
    || !Number.isInteger(raw.stateVersion)
    || typeof raw.buildCommit !== 'string'
    || typeof raw.vocabularySha256 !== 'string'
    || !isPlainRecord(raw.state)
    || !isPlainRecord(raw.integrity)
    || raw.integrity.algorithm !== 'SHA-256'
    || typeof raw.integrity.sha256 !== 'string'
    || !/^[a-f0-9]{64}$/.test(raw.integrity.sha256)
  ) {
    throw new Error('ساختار پشتیبان قصه ناقص یا آسیب‌دیده است.')
  }
  return raw as unknown as ProgressBackupEnvelope
}

export async function importProgressBackupJson(
  json: string,
  now: number,
  firstChapterId: string,
  validChapterIds?: Iterable<string>,
  validWordIds?: Iterable<string>,
): Promise<ProgressImportResult> {
  if (byteLength(json) > MAX_IMPORT_BYTES) throw new Error('فایل پیشرفت بیش از حد بزرگ است.')

  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error('فایل پیشرفت JSON معتبر نیست.')
  }

  const envelope = parseEnvelope(raw)
  if (!envelope) {
    return {
      state: importStateJson(json, now, firstChapterId, validChapterIds, validWordIds),
      source: 'legacy',
      deckMatches: null,
      notice: 'این پشتیبان از قالب قدیمی قصه است؛ پیشرفت معتبر آن پس از بررسی و نرمال‌سازی بازیابی می‌شود.',
    }
  }

  const payload = canonicalPayload(envelope)
  const actual = await sha256Hex(JSON.stringify(payload))
  if (actual !== envelope.integrity.sha256) {
    throw new Error('سلامت پشتیبان تأیید نشد؛ فایل ممکن است ناقص یا دستکاری‌شده باشد.')
  }
  if (envelope.stateVersion !== envelope.state.version) {
    throw new Error('نسخهٔ وضعیت داخل پشتیبان با اطلاعات فایل سازگار نیست.')
  }

  const state = importStateJson(
    JSON.stringify(envelope.state),
    now,
    firstChapterId,
    validChapterIds,
    validWordIds,
  )

  const currentDeckKnown = /^[a-f0-9]{64}$/.test(VOCABULARY_SHA256)
  const backupDeckKnown = /^[a-f0-9]{64}$/.test(envelope.vocabularySha256)
  const deckMatches = currentDeckKnown && backupDeckKnown
    ? envelope.vocabularySha256 === VOCABULARY_SHA256
    : null

  return {
    state,
    source: 'verified-envelope',
    exportedAt: envelope.exportedAt,
    buildCommit: envelope.buildCommit,
    vocabularySha256: envelope.vocabularySha256,
    deckMatches,
    notice: deckMatches === false
      ? 'این پشتیبان برای نسخهٔ دیگری از مجموعهٔ واژگان ساخته شده است؛ فقط شناسه‌های معتبرِ نسخهٔ فعلی بازیابی می‌شوند.'
      : 'سلامت پشتیبان با SHA-256 تأیید شد.',
  }
}
