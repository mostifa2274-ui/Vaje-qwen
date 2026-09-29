import { VOCAB } from '../data/chapters'
import { buildLemmaMap, inflectionBaseCandidates, tokenizeSentence } from './lemmatize'

const COURSE_LEMMA_MAP = buildLemmaMap(VOCAB)
const WORD_BY_ID = new Map(VOCAB.map(word => [word.id, word]))

function normalizedSurface(value: string): string {
  return value.toLowerCase().replace(/[’]/g, "'").replace(/[‑–—]/g, '-').trim()
}

function hasPartOfSpeech(pos: string, expected: 'v.' | 'n.' | 'adj.'): boolean {
  const escaped = expected.replace('.', '\\.')
  return new RegExp(`(?:^|[,\\s])${escaped}(?:$|[,\\s])`, 'i').test(pos)
}

function sentenceUsesInflectedPhrase(sentence: string, surface: string, pos: string): boolean {
  if (!hasPartOfSpeech(pos, 'v.')) return false
  const target = surface.split(/\s+/)
  if (target.length < 2) return false
  const words = sentence
    .match(/[A-Za-z]+(?:[-'’][A-Za-z]+)*/g)
    ?.map(normalizedSurface) ?? []

  for (let start = 0; start <= words.length - target.length; start++) {
    const restMatches = target.slice(1).every((part, offset) => words[start + offset + 1] === part)
    if (!restMatches) continue
    const first = words[start]
    if (first === target[0] || inflectionBaseCandidates(first).verb.includes(target[0])) return true
  }
  return false
}

/**
 * Detect whether free learner production actually uses the target lexical
 * entry, including transparent inflections and controlled homograph senses.
 *
 * This is only a local coaching hint. It is not grammar scoring and never
 * becomes mastery evidence.
 */
export function sentenceUsesTargetSense(sentence: string, wordId: string): boolean {
  if (!sentence.trim()) return false
  const target = WORD_BY_ID.get(wordId)
  if (!target) return false

  const tokens = tokenizeSentence(sentence, COURSE_LEMMA_MAP)
  if (tokens.some(token => token.isWord && token.id === wordId)) return true

  // For known homographs, only the contextual resolver is allowed to decide
  // the sense. A spelling-only fallback would wrongly credit "like" the verb
  // for "like" the preposition (or vice versa).
  if (COURSE_LEMMA_MAP.homonymById.has(wordId)) return false

  const surface = normalizedSurface(target.word)
  if (!surface || surface.includes(',')) return false
  if (surface.includes(' ')) return sentenceUsesInflectedPhrase(sentence, surface, target.pos)

  return tokens.some(token => {
    if (!token.isWord) return false
    const bases = inflectionBaseCandidates(token.raw)
    return (
      (hasPartOfSpeech(target.pos, 'v.') && bases.verb.includes(surface))
      || (hasPartOfSpeech(target.pos, 'n.') && bases.noun.includes(surface))
      || (hasPartOfSpeech(target.pos, 'adj.') && bases.adjective.includes(surface))
    )
  })
}
