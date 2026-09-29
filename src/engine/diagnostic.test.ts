import { describe, expect, it } from 'vitest'
import { CHAPTERS } from '../data/chapters'
import { chapterPrepared, canPrepareChapter, canReadChapter } from './gates'
import { wordMastery } from './mastery'
import { recordCompletedRead, recordDiagnosticPreparedChapter } from './progress'
import { answerCount } from './activity'
import { emptyState } from './store'
import { LISTENING_QUESTION_COUNT, READING_QUESTION_COUNT } from './comprehension'

describe('optional prove-known diagnostic', () => {
  const chapter = CHAPTERS[0]
  const ids = chapter.new

  it('fails closed unless every word passes both productive and listening evidence', () => {
    const fresh = emptyState(1, chapter.id)
    const missingOne = ids.slice(0, -1)

    expect(recordDiagnosticPreparedChapter(fresh, chapter.id, ids, missingOne, ids, 10)).toBe(fresh)
    expect(recordDiagnosticPreparedChapter(fresh, chapter.id, ids, ids, missingOne, 10)).toBe(fresh)
    expect(chapterPrepared(fresh, chapter.id)).toBe(false)
  })

  it('unlocks reading after complete first-try evidence but grants no mastery', () => {
    const fresh = emptyState(1, chapter.id)
    const next = recordDiagnosticPreparedChapter(fresh, chapter.id, ids, ids, ids, 10)

    expect(next).not.toBe(fresh)
    expect(next.chapters[chapter.id]).toMatchObject({
      preparedAt: 10,
      prepDiagnosticPassed: true,
      prepDiagnosticTotal: ids.length,
      completed: false,
    })
    expect(chapterPrepared(next, chapter.id)).toBe(true)
    expect(canReadChapter(next, chapter.id)).toBe(true)
    expect(answerCount(next) - answerCount(fresh)).toBe(ids.length * 2)

    for (const id of ids) {
      expect(next.words[id]?.introduced).toBe(true)
      expect(next.words[id]?.reviewCorrect).toBe(0)
      expect(next.words[id]?.successDays).toEqual([])
      expect(wordMastery(id, next)).toBe('seen')
    }
  })

  it('still requires verified story comprehension before chapter completion', () => {
    const fresh = emptyState(1, chapter.id)
    const prepared = recordDiagnosticPreparedChapter(fresh, chapter.id, ids, ids, ids, 10)

    const incomplete = recordCompletedRead(
      prepared,
      chapter.id,
      ids,
      READING_QUESTION_COUNT - 1,
      READING_QUESTION_COUNT,
      READING_QUESTION_COUNT - 1,
      { firstPassCorrect: LISTENING_QUESTION_COUNT, total: LISTENING_QUESTION_COUNT, verifiedCorrect: LISTENING_QUESTION_COUNT },
      20,
      CHAPTERS.map(item => item.id),
      CHAPTERS[1]?.id,
    )
    expect(incomplete).toBe(prepared)

    const complete = recordCompletedRead(
      prepared,
      chapter.id,
      ids,
      READING_QUESTION_COUNT,
      READING_QUESTION_COUNT,
      READING_QUESTION_COUNT,
      { firstPassCorrect: LISTENING_QUESTION_COUNT, total: LISTENING_QUESTION_COUNT, verifiedCorrect: LISTENING_QUESTION_COUNT },
      20,
      CHAPTERS.map(item => item.id),
      CHAPTERS[1]?.id,
    )
    expect(complete.chapters[chapter.id]?.completed).toBe(true)
  })

  it('does not let a later chapter diagnostic skip its predecessor', () => {
    const second = CHAPTERS[1]
    const fresh = emptyState(1, chapter.id)
    expect(canPrepareChapter(fresh, second.id)).toBe(false)

    const forged = recordDiagnosticPreparedChapter(fresh, second.id, second.new, second.new, second.new, 10)
    expect(forged).toBe(fresh)
    expect(forged.chapters[second.id]).toBeUndefined()
    expect(canReadChapter(forged, second.id)).toBe(false)
  })
})
