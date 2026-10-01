import { describe, expect, it } from 'vitest'
import { CHAPTERS } from '../data/chapters'
import { FINAL_EXAM_ID } from './gates'
import { emptyState } from './store'
import { hashFor, parseHash, resolveView, viewLabel } from './routes'

const FIRST = CHAPTERS[0].id
const LATER = CHAPTERS.find(chapter => chapter.book > 1)?.id ?? 'b2c1'

describe('hash routing', () => {
  it('falls back to the map for empty, unknown, or broken hashes', () => {
    expect(parseHash('')).toEqual({ name: 'map' })
    expect(parseHash('#/nope')).toEqual({ name: 'map' })
    expect(parseHash('#/prep/%E0%A4%A')).toEqual({ name: 'map' })
    expect(parseHash('#/exam/not-an-exam')).toEqual({ name: 'map' })
    expect(parseHash('#/prep/missing-chapter')).toEqual({ name: 'map' })
  })

  it('round-trips known screens', () => {
    const views = [
      { name: 'map' as const },
      { name: 'review' as const },
      { name: 'glossary' as const },
      { name: 'flashcards' as const },
      { name: 'offline-audio' as const },
      { name: 'settings' as const },
      { name: 'prep' as const, chapterId: FIRST },
      { name: 'read' as const, chapterId: FIRST },
      { name: 'diagnostic' as const, chapterId: FIRST },
      { name: 'exam' as const, examId: 'book-1' },
    ]
    for (const view of views) {
      expect(parseHash(hashFor(view))).toEqual(view)
    }
  })
})

describe('fail-closed resolveView', () => {
  it('keeps a new learner on chapter 1 prep and blocks later books and exams', () => {
    const state = emptyState(1, FIRST)
    expect(resolveView({ name: 'prep', chapterId: FIRST }, state)).toEqual({ name: 'prep', chapterId: FIRST })
    expect(resolveView({ name: 'read', chapterId: FIRST }, state)).toEqual({ name: 'prep', chapterId: FIRST })
    expect(resolveView({ name: 'prep', chapterId: LATER }, state)).toEqual({ name: 'map' })
    expect(resolveView({ name: 'read', chapterId: LATER }, state)).toEqual({ name: 'map' })
    expect(resolveView({ name: 'exam', examId: 'book-1' }, state)).toEqual({ name: 'map' })
    expect(resolveView({ name: 'exam', examId: FINAL_EXAM_ID }, state)).toEqual({ name: 'map' })
    expect(resolveView({ name: 'review' }, state)).toEqual({ name: 'review' })
  })

  it('names the map as the learning path, not mastery', () => {
    expect(viewLabel({ name: 'map' })).toBe('مسیر یادگیری')
  })
})
