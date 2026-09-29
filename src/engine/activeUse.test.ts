import { describe, expect, it } from 'vitest'
import { sentenceUsesTargetSense } from './activeUse'

describe('active-use lexical sense detection', () => {
  it('recognizes transparent inflections of the taught word', () => {
    expect(sentenceUsesTargetSense('My dogs are friendly.', 'dog')).toBe(true)
    // "writing" is also its own noun entry in the deck; target-aware fallback
    // must still recognize the progressive verb "write".
    expect(sentenceUsesTargetSense('She is writing a note.', 'write')).toBe(true)
    expect(sentenceUsesTargetSense('The children are outside.', 'child')).toBe(true)
    expect(sentenceUsesTargetSense('She has to leave now.', 'have-to')).toBe(true)
    // Do not over-stem an unrelated lexicalized -ing word.
    expect(sentenceUsesTargetSense('We meet in the evening.', 'even')).toBe(false)
  })

  it('distinguishes controlled homographs by context', () => {
    expect(sentenceUsesTargetSense('I like this song.', 'like-2')).toBe(true)
    expect(sentenceUsesTargetSense('I like this song.', 'like')).toBe(false)
    expect(sentenceUsesTargetSense('She looks like her mother.', 'like')).toBe(true)
    expect(sentenceUsesTargetSense('She looks like her mother.', 'like-2')).toBe(false)

    expect(sentenceUsesTargetSense('Wait one second.', 'second-2')).toBe(true)
    expect(sentenceUsesTargetSense('The second book is blue.', 'second')).toBe(true)
  })

  it('does not treat a missing or merely similar word as present', () => {
    expect(sentenceUsesTargetSense('The cat is sleeping.', 'dog')).toBe(false)
    expect(sentenceUsesTargetSense('', 'dog')).toBe(false)
  })
})
