import { describe, expect, it } from 'vitest'
import { CHAPTERS, WORD_BY_ID, lemmaMap } from '../data/chapters'
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
      expect(ids.filter(id => id.includes(':meaning-')).length, chapter.id).toBe(1)
      expect(ids.filter(id => id.includes(':story-event:')).length, chapter.id).toBe(3)
      expect(ids.filter(id => id.includes(':sequence:')).length, chapter.id).toBe(4)
    }
  })

  it('never leaks future chapters or uses another true current-story event as a false distractor', () => {
    for (const [chapterIndex, chapter] of CHAPTERS.entries()) {
      const questions = buildReadingQuestions(chapter, WORD_BY_ID, CHAPTERS)
        .filter(question => question.id.includes(':story-event:'))

      for (const question of questions) {
        expect(question.options.some(option => option.id.startsWith('fallback-')), question.id).toBe(false)

        const currentAnswer = question.options.find(option => option.id.startsWith(`story-${chapter.id}-`))
        if (currentAnswer) {
          const external = question.options.filter(option => option.id.startsWith('story-') && option.id !== currentAnswer.id)
          expect(external, question.id).toHaveLength(3)

          const currentStory = new Set(chapter.sentences.map(sentence => sentence.en.trim().toLowerCase()))
          for (const option of external) {
            const other = CHAPTERS.findIndex(candidate => option.id.startsWith(`story-${candidate.id}-`))
            expect(other, `${question.id}:${option.id}`).toBeGreaterThanOrEqual(0)
            expect(other, `${question.id}:${option.id}`).toBeLessThan(chapterIndex)
            expect(currentStory.has(option.label.trim().toLowerCase()), `${question.id}:${option.id}`).toBe(false)
          }
          continue
        }

        // When fewer than three valid prior-story distractors exist, the
        // replacement asks for the exact adjacent event. Every option may
        // legitimately occur in the current story, but only one is immediately
        // before/after the displayed context.
        expect(question.id, chapter.id).toContain(':adjacent-fallback')
        expect(question.context, question.id).toBeTruthy()
        expect(question.contextDir, question.id).toBe('ltr')
        expect(question.options.every(option => option.id.startsWith('sentence-')), question.id).toBe(true)

        const contextIndex = chapter.sentences.findIndex(sentence => sentence.en === question.context)
        const answer = question.options.find(option => option.id === question.answerId)
        const answerIndex = answer ? chapter.sentences.findIndex(sentence => sentence.en === answer.label) : -1
        expect(contextIndex, question.id).toBeGreaterThanOrEqual(0)
        expect(answerIndex, question.id).toBeGreaterThanOrEqual(0)
        expect(Math.abs(contextIndex - answerIndex), question.id).toBe(1)
      }
    }
  })

  it('asks in English, with a Persian gloss only while a fixed question has untaught words', () => {
    const hinted = new Map<string, number>()
    for (const chapter of CHAPTERS) {
      const questions = buildReadingQuestions(chapter, WORD_BY_ID, CHAPTERS, lemmaMap)
      for (const question of questions) {
        expect(question.prompt, `${chapter.id}:${question.id}`).not.toMatch(/[؀-ۿ]/)
        for (const option of question.options) expect(option.label, `${chapter.id}:${question.id}`).not.toMatch(/[؀-ۿ]/)
        if (question.id.includes(':authored:')) expect(question.promptHintFa).toBeUndefined()
        if (question.promptHintFa) hinted.set(chapter.id, (hinted.get(chapter.id) ?? 0) + 1)
      }
    }
    // Beginners get the gloss; once "which" is taught (book 3, chapter 2), every stem is.
    expect(hinted.get('b1c1')).toBe(8)
    expect(hinted.get('b3c1')).toBe(6)
    const from = CHAPTERS.findIndex(chapter => chapter.id === 'b3c2')
    for (const chapter of CHAPTERS.slice(from)) expect(hinted.get(chapter.id), chapter.id).toBeUndefined()
  })
})
