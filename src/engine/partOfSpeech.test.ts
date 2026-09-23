import { describe, expect, it } from 'vitest'
import vocabulary from '../data/vocabulary.json'
import { persianPartOfSpeech } from './partOfSpeech'

describe('Persian part-of-speech labels', () => {
  it('translates the core grammatical categories used by the deck', () => {
    expect(persianPartOfSpeech('n.')).toBe('اسم')
    expect(persianPartOfSpeech('v., n.')).toBe('فعل، اسم')
    expect(persianPartOfSpeech('adj./pron.')).toBe('صفت / ضمیر')
    expect(persianPartOfSpeech('modal v.')).toBe('فعل وجهی')
    expect(persianPartOfSpeech('definite article')).toBe('حرف تعریف معین')
    expect(persianPartOfSpeech('prep., infinitive marker')).toBe('حرف اضافه، نشانهٔ مصدر')
  })

  it('produces a Persian-readable label for every vocabulary entry', () => {
    for (const word of vocabulary) {
      const label = persianPartOfSpeech(word.pos)
      expect(label.length).toBeGreaterThan(0)
      expect(label).not.toMatch(/[A-Za-z]/)
    }
  })
})
