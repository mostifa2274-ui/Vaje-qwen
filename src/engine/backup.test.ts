import { describe, expect, it } from 'vitest'
import { createProgressBackupJson, importProgressBackupJson, PROGRESS_BACKUP_FORMAT } from './backup'
import { emptyState } from './store'

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

describe('portable progress backups', () => {
  const chapters = ['b1c1', 'b1c2']
  const words = ['book', 'home']

  it('exports a self-describing checksum-bound envelope and imports it', async () => {
    const state = emptyState(100, 'b1c1')
    state.dailyReviewGoal = 20
    state.words.book = {
      introduced: true,
      taps: 0,
      checkCorrect: 0,
      checkWrong: 0,
      reviewStage: 0,
      reviewCorrect: 0,
      reviewWrong: 0,
      reviewStreak: 0,
      intervalDays: 0,
      productiveCorrect: 0,
      successDays: [],
      productiveSuccessDays: [],
      difficulty: 5,
      stabilityDays: 0,
      lapses: 0,
      retrievalMsTotal: 0,
      retrievalMsCount: 0,
      skillStats: {
        meaning: { correct: 0, wrong: 0 },
        context: { correct: 0, wrong: 0 },
        production: { correct: 0, wrong: 0 },
        form: { correct: 0, wrong: 0 },
      },
    }

    const json = await createProgressBackupJson(state, 123_456)
    const raw = JSON.parse(json)
    expect(raw.format).toBe(PROGRESS_BACKUP_FORMAT)
    expect(raw.schemaVersion).toBe(1)
    expect(raw.exportedAt).toBe(123_456)
    expect(raw.stateVersion).toBe(6)
    expect(raw.integrity.algorithm).toBe('SHA-256')
    expect(raw.integrity.sha256).toMatch(/^[a-f0-9]{64}$/)

    const imported = await importProgressBackupJson(json, 200_000, 'b1c1', chapters, words)
    expect(imported.source).toBe('verified-envelope')
    expect(imported.state.dailyReviewGoal).toBe(20)
    expect(imported.state.words.book?.introduced).toBe(true)
    expect(imported.notice).toContain('SHA-256')
  })

  it('rejects a backup whose progress was modified after export', async () => {
    const json = await createProgressBackupJson(emptyState(100, 'b1c1'), 123_456)
    const raw = JSON.parse(json)
    raw.state.dailyReviewGoal = 25

    await expect(importProgressBackupJson(
      JSON.stringify(raw),
      200_000,
      'b1c1',
      chapters,
      words,
    )).rejects.toThrow('سلامت پشتیبان تأیید نشد')
  })

  it('binds vocabulary metadata to the checksum and warns on a genuine different deck', async () => {
    const json = await createProgressBackupJson(emptyState(100, 'b1c1'), 123_456)
    const raw = JSON.parse(json)
    raw.vocabularySha256 = '0'.repeat(64)
    const payload = {
      format: raw.format,
      schemaVersion: raw.schemaVersion,
      exportedAt: raw.exportedAt,
      stateVersion: raw.stateVersion,
      buildCommit: raw.buildCommit,
      vocabularySha256: raw.vocabularySha256,
      state: raw.state,
    }
    raw.integrity.sha256 = await sha256Hex(JSON.stringify(payload))

    const imported = await importProgressBackupJson(
      JSON.stringify(raw),
      200_000,
      'b1c1',
      chapters,
      words,
    )
    expect(imported.source).toBe('verified-envelope')
    expect(imported.deckMatches).toBe(false)
    expect(imported.notice).toContain('نسخهٔ دیگری')
  })

  it('keeps supported raw-state backups backwards compatible', async () => {
    const legacy = emptyState(100, 'b1c1')
    const imported = await importProgressBackupJson(
      JSON.stringify(legacy),
      200_000,
      'b1c1',
      chapters,
      words,
    )

    expect(imported.source).toBe('legacy')
    expect(imported.deckMatches).toBeNull()
    expect(imported.notice).toContain('قالب قدیمی')
  })
})
