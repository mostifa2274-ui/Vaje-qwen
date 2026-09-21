import { describe, expect, it } from 'vitest'
import { CHAPTERS, WORD_BY_ID } from '../data/chapters'
import { buildReadingQuestions } from './comprehension'

describe('chapter reading comprehension', () => {
  it('builds exactly ten valid questions for every chapter', () => {
    for (const chapter of CHAPTERS) {
      const questions = buildReadingQuestions(chapter, WORD_BY_ID)
      expect(questions, chapter.id).toHaveLength(10)
      expect(new Set(questions.map(question => question.id)).size, chapter.id).toBe(10)

      for (const question of questions) {
        expect(question.prompt.trim().length, `${chapter.id}:${question.id}`).toBeGreaterThan(0)
        expect(question.options, `${chapter.id}:${question.id}`).toHaveLength(4)
        expect(new Set(question.options.map(option => option.id)).size, `${chapter.id}:${question.id}`).toBe(4)
        expect(new Set(question.options.map(option => option.label.trim().toLowerCase())).size, `${chapter.id}:${question.id}`).toBe(4)
        expect(question.options.some(option => option.id === question.answerId), `${chapter.id}:${question.id}`).toBe(true)
      }
    }
  })

  it('is deterministic and keeps the two authored story-detail questions', () => {
    for (const chapter of CHAPTERS) {
      const first = buildReadingQuestions(chapter, WORD_BY_ID)
      const second = buildReadingQuestions(chapter, WORD_BY_ID)
      expect(second).toEqual(first)
      expect(first[0].evidenceWordId).toBe(chapter.check[0].a)
      expect(first[1].evidenceWordId).toBe(chapter.check[1].a)
    }
  })
})
