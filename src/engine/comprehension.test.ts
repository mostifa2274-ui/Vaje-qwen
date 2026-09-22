import { describe, expect, it } from 'vitest'
import { CHAPTERS, WORD_BY_ID } from '../data/chapters'
import { buildReadingQuestions, READING_QUESTION_COUNT } from './comprehension'

describe('chapter reading comprehension', () => {
  it('builds exactly ten valid questions for every chapter', () => {
    for (const chapter of CHAPTERS) {
      const questions = buildReadingQuestions(chapter, WORD_BY_ID, CHAPTERS)
      expect(questions, chapter.id).toHaveLength(READING_QUESTION_COUNT)
      expect(new Set(questions.map(question => question.id)).size, chapter.id).toBe(READING_QUESTION_COUNT)

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
      const first = buildReadingQuestions(chapter, WORD_BY_ID, CHAPTERS)
      const second = buildReadingQuestions(chapter, WORD_BY_ID, CHAPTERS)
      expect(second).toEqual(first)
      expect(first[0].evidenceWordId).toBe(chapter.check[0].a)
      expect(first[1].evidenceWordId).toBe(chapter.check[1].a)
    }
  })

  it('uses a balanced story-comprehension mix instead of mostly translation matching', () => {
    for (const chapter of CHAPTERS) {
      const questions = buildReadingQuestions(chapter, WORD_BY_ID, CHAPTERS)
      const ids = questions.map(question => question.id)
      expect(ids.filter(id => id.includes(':authored:')).length, chapter.id).toBe(2)
      expect(ids.filter(id => id.includes(':meaning-')).length, chapter.id).toBe(2)
      expect(ids.filter(id => id.includes(':story-event:')).length, chapter.id).toBe(2)
      expect(ids.filter(id => id.includes(':sequence:')).length, chapter.id).toBe(4)
    }
  })

  it('uses other chapters as plausible distractors for story-event questions', () => {
    for (const chapter of CHAPTERS) {
      const questions = buildReadingQuestions(chapter, WORD_BY_ID, CHAPTERS)
        .filter(question => question.id.includes(':story-event:'))
      for (const question of questions) {
        expect(question.options.some(option => option.id.startsWith(`story-${chapter.id}-`)), question.id).toBe(true)
        expect(question.options.filter(option => option.id.startsWith('story-') && !option.id.startsWith(`story-${chapter.id}-`)).length, question.id).toBe(3)
      }
    }
  })
})
