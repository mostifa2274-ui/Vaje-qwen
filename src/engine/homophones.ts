import type { WordEntry } from './types'

// Deck words that cannot be told apart by ear. homophones.test.ts checks this
// list against the vocabulary's IPA, so a new homophone cannot slip in.
export const HOMOPHONE_GROUPS: readonly (readonly string[])[] = [
  ['to', 'too', 'two'], ['right', 'write'], ['hear', 'here'], ['son', 'sun'], ['I', 'eye'],
  ['know', 'no'], ['meet', 'meat'], ['by', 'buy', 'bye'], ['there', 'their'], ['our', 'hour'],
  ['wear', 'where'], ['for', 'four'], ['hi', 'high'],
]

const soundGroup = new Map<string, number>()
HOMOPHONE_GROUPS.forEach((group, index) => group.forEach(surface => soundGroup.set(surface.toLowerCase(), index)))

/** The headword as a learner sees it, ignoring case and spacing. */
export function headwordKey(word: Pick<WordEntry, 'word'>): string {
  return word.word.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * True when hearing one word alone could be taken for the other: the same
 * headword ("like" prep. / "like" v.) or a listed homophone (right/write).
 */
export function soundsAlike(a: Pick<WordEntry, 'word'>, b: Pick<WordEntry, 'word'>): boolean {
  const left = headwordKey(a)
  const right = headwordKey(b)
  if (left === right) return true
  const group = soundGroup.get(left)
  return group !== undefined && group === soundGroup.get(right)
}

/** Every deck entry written with exactly this headword, the word itself included. */
export function sameHeadwordEntries<T extends WordEntry>(word: T, vocab: readonly T[]): T[] {
  const key = headwordKey(word)
  const matches = vocab.filter(entry => headwordKey(entry) === key)
  return matches.some(entry => entry.id === word.id) ? matches : [word, ...matches]
}

/** Other deck words that sound like this one but are spelled differently. */
export function differentlySpelledHomophones<T extends WordEntry>(word: T, vocab: readonly T[]): T[] {
  const key = headwordKey(word)
  return vocab.filter(entry => entry.id !== word.id && headwordKey(entry) !== key && soundsAlike(word, entry))
}
