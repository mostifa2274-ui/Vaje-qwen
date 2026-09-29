import { describe, expect, it } from 'vitest'
import { CHAPTERS } from '../data/chapters'
import { blankWordProgress, recordRetrieval } from './review'
import { buildResearchReport } from './researchExport'
import { emptyState } from './store'

describe('de-identified research export', () => {
  it('retains learning evidence while excluding identity, exact dates, settings and recordings', () => {
    const state = emptyState(new Date(2026, 8, 29, 9).getTime(), CHAPTERS[0].id)
    const wordId = CHAPTERS[0].new[0]
    let word = blankWordProgress(new Date(2026, 8, 29, 9).getTime())
    word = recordRetrieval(word, true, 'productive', new Date(2026, 8, 30, 10).getTime(), 'review', 4_200)
    state.words[wordId] = word
    state.narratorVoiceURI = 'private-device-voice'
    state.activity['2026-09-30'] = 12
    state.chapters[CHAPTERS[0].id] = {
      preparedAt: new Date(2026, 8, 29, 10).getTime(),
      prepAttempts: 1,
      prepWrittenCorrect: 10,
      prepWrittenTotal: 10,
      prepListeningCorrect: 10,
      prepListeningTotal: 10,
      completed: true,
      completedAt: new Date(2026, 8, 30, 11).getTime(),
      checksCorrect: 8,
      checksTotal: 10,
      listeningCorrect: 4,
      listeningTotal: 5,
      reads: 1,
    }

    const report = buildResearchReport(state)
    expect(report.identity.protocolId).toBe('ghesse-learning-outcomes-v1')
    expect(report.identity.buildCommit).toBeTruthy()
    expect(report.identity.vocabularySha256).toMatch(/^(?:[a-f0-9]{64}|unknown)$/)
    expect(report.summary.introducedWords).toBe(1)
    expect(report.summary.gradedAnswers).toBe(12)
    expect(report.words[0]).toMatchObject({
      id: wordId,
      reviewCorrect: 1,
      productiveCorrect: 1,
      successDayCount: 1,
      averageResponseMs: 4200,
    })
    expect(report.chapters[0]).toMatchObject({
      readingFirstPass: 0.8,
      chapterListeningFirstPass: 0.8,
    })

    const serialized = JSON.stringify(report)
    for (const forbidden of [
      'private-device-voice',
      'firstSeenAt',
      'lastReviewedAt',
      'lastIndependentSuccessAt',
      'preparedAt',
      'completedAt',
      'narratorVoiceURI',
      'recording',
      '2026-09-30',
    ]) {
      expect(serialized).not.toContain(forbidden)
    }
    expect(report.privacy).toEqual({
      containsIdentity: false,
      containsRawAnswers: false,
      containsExactTimestamps: false,
      containsRecordings: false,
    })
  })
})
