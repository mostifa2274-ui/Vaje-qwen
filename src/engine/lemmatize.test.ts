import { describe, expect, it } from 'vitest'
import { buildLemmaMap, tokenizeSentence } from './lemmatize'
import type { WordEntry } from './types'

const vocab = [
  { id: 'i', word: 'I' },
  { id: 'she', word: 'she' },
  { id: 'mother', word: 'mother' },
  { id: 'song', word: 'song' },
  { id: 'look', word: 'look' },
  { id: 'be', word: 'be' },
  { id: 'like', word: 'like', pos: 'prep.' },
  { id: 'like-2', word: 'like', pos: 'v.' },
  { id: 'one', word: 'one' },
  { id: 'second', word: 'second', pos: 'number' },
  { id: 'second-2', word: 'second', pos: 'n.' },
].map(word => ({
  fa: 'نمونه',
  ipa: 'x',
  topic: 'test',
  ex: 'Test example.',
  tr: 'نمونه.',
  cefr: 'A1',
  pos: 'n.',
  ...word,
})) as WordEntry[]

const map = buildLemmaMap(vocab)

function ids(sentence: string): string[] {
  return tokenizeSentence(sentence, map)
    .filter(token => token.isWord && token.id)
    .map(token => token.id!)
}

describe('contextual homograph resolution', () => {
  it('separates prepositional like after linking expressions from the verb like', () => {
    expect(ids('She looks like her mother.')).toContain('like')
    expect(ids('I like this song.')).toContain('like-2')
    expect(ids('She is like her mother.')).toContain('like')
  })

  it('keeps the two second senses deterministic', () => {
    expect(ids('one second')).toContain('second-2')
    expect(ids('second')).toContain('second')
  })
})
