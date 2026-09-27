import { describe, expect, it } from 'vitest'
import { CHAPTERS } from '../data/chapters'
import {
  FINAL_EXAM_ID,
  MIDPOINT_EXAM_ID,
  bookExamId,
  canOpenChapter,
  canOpenExam,
  canOpenStory,
  canPrepareChapter,
  canReadChapter,
  canTakeExam,
} from './gates'
import { recordCompletedRead } from './progress'
import { READING_QUESTION_COUNT } from './comprehension'
import { emptyState, importStateJson, mergeConcurrentState } from './store'

const FIRST = CHAPTERS[0].id
const LAST = CHAPTERS[CHAPTERS.length - 1]
const EXAMS = [bookExamId(1), bookExamId(8), MIDPOINT_EXAM_ID, FINAL_EXAM_ID]

describe('explore mode', () => {
  it('opens nothing beyond the normal path while it is off', () => {
    const state = emptyState(1, FIRST)
    for (const chapter of CHAPTERS) {
      expect(canOpenChapter(state, chapter.id), chapter.id).toBe(canPrepareChapter(state, chapter.id))
      expect(canOpenStory(state, chapter.id), chapter.id).toBe(canReadChapter(state, chapter.id))
    }
    for (const id of EXAMS) expect(canOpenExam(state, id), id).toBe(canTakeExam(state, id))
    expect(canOpenChapter(state, LAST.id)).toBe(false)
  })

  it('opens every chapter, story and test while it is on', () => {
    const state = { ...emptyState(1, FIRST), exploreAll: true }
    for (const chapter of CHAPTERS) {
      expect(canOpenChapter(state, chapter.id), chapter.id).toBe(true)
      expect(canOpenStory(state, chapter.id), chapter.id).toBe(true)
    }
    for (const id of EXAMS) expect(canOpenExam(state, id), id).toBe(true)
    expect(canOpenChapter(state, 'no-such-chapter')).toBe(false)
    expect(canOpenExam(state, 'book-9')).toBe(false)
  })

  it('leaves the gates that decide what is recorded unchanged', () => {
    const off = emptyState(1, FIRST)
    const on = { ...off, exploreAll: true }
    for (const chapter of CHAPTERS) {
      expect(canPrepareChapter(on, chapter.id), chapter.id).toBe(canPrepareChapter(off, chapter.id))
      expect(canReadChapter(on, chapter.id), chapter.id).toBe(canReadChapter(off, chapter.id))
    }
    for (const id of EXAMS) expect(canTakeExam(on, id), id).toBe(canTakeExam(off, id))
    // Even a direct call cannot complete a chapter whose word tests were never passed.
    const state = { ...on }
    const read = recordCompletedRead(state, LAST.id, LAST.new, 10, READING_QUESTION_COUNT, READING_QUESTION_COUNT, 5, CHAPTERS.map(ch => ch.id))
    expect(read).toBe(state)
  })

  it('is saved, restored and merged like the other settings', () => {
    expect(emptyState(1, FIRST).exploreAll).toBe(false)
    const exported = JSON.stringify({ ...emptyState(1, FIRST), exploreAll: true })
    expect(importStateJson(exported, 2, FIRST).exploreAll).toBe(true)
    const legacy = JSON.stringify({ version: 6, currentChapter: FIRST, chapters: {}, words: {} })
    expect(importStateJson(legacy, 2, FIRST).exploreAll).toBe(false)

    const base = emptyState(1, FIRST)
    const local = { ...base, exploreAll: true }
    expect(mergeConcurrentState(base, local, base)?.exploreAll).toBe(true)
    expect(mergeConcurrentState(base, base, local)?.exploreAll).toBe(true)
  })
})
