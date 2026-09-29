// Lightweight, vocabulary-aware lemmatizer for the fixed A1 deck.
// Candidate stems are only accepted when they exist in the deck, which avoids
// destructive guesses such as uses -> us and hates -> hat.

import type { WordEntry } from './types'

const IRREGULAR: Record<string, string> = {
  is: 'be', are: 'be', am: 'be', was: 'be', were: 'be', been: 'be', being: 'be',
  has: 'have', had: 'have',
  does: 'do', did: 'do', done: 'do', doing: 'do',
  goes: 'go', went: 'go', gone: 'go', going: 'go',
  says: 'say', said: 'say',
  children: 'child', men: 'man', women: 'woman', people: 'person',
  feet: 'foot', teeth: 'tooth', mice: 'mouse', geese: 'goose',
  knives: 'knife', wives: 'wife',
  took: 'take', taken: 'take',
  ran: 'run', ate: 'eat', eaten: 'eat',
  drank: 'drink', drunk: 'drink',
  saw: 'see', seen: 'see',
  came: 'come',
  gave: 'give', given: 'give',
  got: 'get', gotten: 'get',
  made: 'make', found: 'find',
  told: 'tell',
  thought: 'think', bought: 'buy', brought: 'bring',
  sat: 'sit', slept: 'sleep',
  wrote: 'write', written: 'write',
  read: 'read',
  swam: 'swim', sang: 'sing',
  drew: 'draw', drawn: 'draw',
  knew: 'know', known: 'know',
  broke: 'break', broken: 'break',
  wore: 'wear', worn: 'wear',
  forgot: 'forget',
  heard: 'hear',
  felt: 'feel',
  stood: 'stand',
  spoke: 'speak', spoken: 'speak',
  began: 'begin',
  better: 'good',
  worse: 'bad',
}

export interface LemmaMap {
  lemma: Map<string, string> // surface form -> deterministic default id
  phrases: Map<string, string>
  homonymById: Map<string, string[]>
}

function normalizeSurface(value: string): string {
  return value.toLowerCase().replace(/[’]/g, "'").replace(/[‑–—]/g, '-')
}

export function buildLemmaMap(vocab: WordEntry[]): LemmaMap {
  const lemma = new Map<string, string>()
  const phrases = new Map<string, string>()
  const surfaceIds = new Map<string, string[]>()

  for (const word of vocab) {
    const surface = normalizeSurface(word.word)
    for (const form of surface.split(/,\s*/)) {
      const f = form.trim()
      const ids = surfaceIds.get(f) ?? []
      ids.push(word.id)
      surfaceIds.set(f, ids)
    }
  }

  const homonymById = new Map<string, string[]>()
  for (const word of vocab) {
    const surface = normalizeSurface(word.word)
    for (const form of surface.split(/,\s*/)) {
      const f = form.trim()
      const ids = surfaceIds.get(f) ?? [word.id]
      if (ids.length > 1) homonymById.set(word.id, ids)
      if (f.includes(' ')) {
        if (!phrases.has(f)) phrases.set(f, word.id)
      } else if (!lemma.has(f)) {
        // Keep the first sense as a stable default; contextual resolution below
        // selects the appropriate sense for known homonyms.
        lemma.set(f, word.id)
      }
    }
    lemma.set(word.id, word.id)
  }
  return { lemma, phrases, homonymById }
}

export function preprocess(text: string, phrases: Map<string, string>): string {
  let value = normalizeSurface(text)
  const sorted = [...phrases.keys()].sort((a, b) => b.length - a.length)
  for (const surface of sorted) {
    const id = phrases.get(surface)!
    value = value.replace(new RegExp(`\\b${escapeRe(surface)}\\b`, 'g'), id)
  }
  return value
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function firstExisting(candidates: string[], map: LemmaMap): string | undefined {
  for (const candidate of candidates) {
    const id = map.lemma.get(candidate)
    if (id) return id
  }
  return undefined
}

export interface InflectionBaseCandidates {
  noun: string[]
  verb: string[]
  adjective: string[]
}

/**
 * Return plausible *inflectional* base spellings without consulting the deck.
 * Keeping classes separate lets coaching code accept "writing" for the verb
 * "write" without accidentally accepting "evening" for the adverb "even".
 */
export function inflectionBaseCandidates(token: string): InflectionBaseCandidates {
  const t = normalizeSurface(token)
  const noun: string[] = []
  const verb: string[] = []
  const adjective: string[] = []
  const irregular = IRREGULAR[t]
  if (irregular) {
    noun.push(irregular)
    verb.push(irregular)
    adjective.push(irregular)
  }

  if (t.endsWith('ies') && t.length > 3) {
    const base = `${t.slice(0, -3)}y`
    noun.push(base)
    verb.push(base)
  }
  if (t.endsWith('es') && t.length > 3) {
    const minusS = t.slice(0, -1)
    const minusEs = t.slice(0, -2)
    noun.push(minusS, minusEs)
    verb.push(minusS, minusEs)
  } else if (t.endsWith('s') && t.length > 3) {
    const base = t.slice(0, -1)
    noun.push(base)
    verb.push(base)
  }
  if (t.endsWith('ves') && t.length > 3) {
    noun.push(`${t.slice(0, -3)}f`, `${t.slice(0, -3)}fe`)
  }

  if (t.endsWith('ied') && t.length > 3) verb.push(`${t.slice(0, -3)}y`)
  if (t.endsWith('ing') && t.length > 4) {
    const stem = t.slice(0, -3)
    verb.push(stem, stem.replace(/(.)\1$/, '$1'), `${stem}e`)
  }
  if (t.endsWith('ed') && t.length > 3) {
    const stem = t.slice(0, -2)
    verb.push(stem, stem.replace(/(.)\1$/, '$1'), `${stem}e`)
  }

  if (t.endsWith('er') && t.length > 4) adjective.push(t.slice(0, -2))
  if (t.endsWith('est') && t.length > 5) adjective.push(t.slice(0, -3))

  return {
    noun: [...new Set(noun)],
    verb: [...new Set(verb)],
    adjective: [...new Set(adjective)],
  }
}

export function lemmaOf(token: string, map: LemmaMap): string | undefined {
  const t = normalizeSurface(token)
  const direct = map.lemma.get(t)
  if (direct) return direct

  const irregular = IRREGULAR[t]
  if (irregular) {
    const id = map.lemma.get(irregular)
    if (id) return id
  }

  const candidates: string[] = []

  // consonant + y plurals / third person: flies -> fly, tries -> try
  if (t.endsWith('ies') && t.length > 3) candidates.push(`${t.slice(0, -3)}y`)

  // Prefer removing only s first so uses -> use, hates -> hate, lives -> live.
  if (t.endsWith('es') && t.length > 3) {
    candidates.push(t.slice(0, -1))
    candidates.push(t.slice(0, -2))
  } else if (t.endsWith('s') && t.length > 3) {
    candidates.push(t.slice(0, -1))
  }

  if (t.endsWith('ied') && t.length > 3) candidates.push(`${t.slice(0, -3)}y`)

  if (t.endsWith('ing') && t.length > 4) {
    const stem = t.slice(0, -3)
    candidates.push(stem)
    candidates.push(stem.replace(/(.)\1$/, '$1'))
    candidates.push(`${stem}e`)
  }

  if (t.endsWith('ed') && t.length > 3) {
    const stem = t.slice(0, -2)
    candidates.push(stem)
    candidates.push(stem.replace(/(.)\1$/, '$1'))
    candidates.push(`${stem}e`)
  }

  if (t.endsWith('er') && t.length > 4) candidates.push(t.slice(0, -2))
  if (t.endsWith('est') && t.length > 5) candidates.push(t.slice(0, -3))
  if (t.endsWith('ly') && t.length > 4) candidates.push(t.slice(0, -2))

  return firstExisting([...new Set(candidates)], map)
}

export interface TokenInfo {
  raw: string
  isWord: boolean
  id?: string
  ids?: string[]
}

interface Span {
  raw: string
  isWord: boolean
}

function previousWords(spans: Span[], index: number, count = 2): string[] {
  const result: string[] = []
  for (let i = index - 1; i >= 0 && result.length < count; i--) {
    if (spans[i].isWord) result.push(normalizeSurface(spans[i].raw))
  }
  return result
}

function contextualSense(raw: string, id: string, ids: string[], spans: Span[], index: number): string {
  if (ids.includes('like') && ids.includes('like-2')) {
    const form = normalizeSurface(raw)
    // Inflected "likes" is necessarily the verb in this deck.
    if (form !== 'like') return 'like-2'
    const prev = previousWords(spans, index, 2)
    const prepositionTrigger = new Set([
      'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'look', 'looks', 'looked', 'looking',
      'sound', 'sounds', 'sounded',
      'seem', 'seems', 'seemed',
      'feel', 'feels', 'felt',
      'smell', 'smells', 'smelled',
      'taste', 'tastes', 'tasted',
    ])
    if (prev.some(word => prepositionTrigger.has(word))) return 'like'
    return 'like-2'
  }

  if (ids.includes('second') && ids.includes('second-2')) {
    const [prev] = previousWords(spans, index, 1)
    if (prev === 'one' || prev === 'a' || prev === 'an') return 'second-2'
    return 'second'
  }

  return id
}

export function tokenizeSentence(en: string, map: LemmaMap): TokenInfo[] {
  const spans: Span[] = []
  // Hyphenated deck entries (notably T-shirt) stay as a single token.
  const re = /[A-Za-z]+(?:[-‑'’][A-Za-z]+)*/g
  let last = 0
  for (const match of en.matchAll(re)) {
    const index = match.index!
    if (index > last) spans.push({ raw: en.slice(last, index), isWord: false })
    spans.push({ raw: match[0], isWord: true })
    last = index + match[0].length
  }
  if (last < en.length) spans.push({ raw: en.slice(last), isWord: false })

  const out: TokenInfo[] = []
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i]
    if (!span.isWord) {
      out.push({ raw: span.raw, isWord: false })
      continue
    }

    const lower = normalizeSurface(span.raw)
    let matched = false
    for (let len = 3; len >= 2 && !matched; len--) {
      let candidate = lower
      let j = i
      let words = 1
      while (words < len) {
        const separator = spans[j + 1]
        const next = spans[j + 2]
        if (!separator || !next || separator.isWord || !next.isWord || separator.raw !== ' ') break
        candidate += ` ${normalizeSurface(next.raw)}`
        j += 2
        words++
      }
      if (words !== len) continue
      const phraseId = map.phrases.get(candidate)
      if (!phraseId) continue
      const raw = spans.slice(i, j + 1).map(item => item.raw).join('')
      const ids = map.homonymById.get(phraseId) ?? [phraseId]
      out.push({ raw, isWord: true, id: contextualSense(raw, phraseId, ids, spans, i), ids })
      i = j
      matched = true
    }
    if (matched) continue

    const baseId = lemmaOf(lower, map)
    if (!baseId) {
      out.push({ raw: span.raw, isWord: true })
      continue
    }
    const ids = map.homonymById.get(baseId) ?? [baseId]
    const resolved = contextualSense(span.raw, baseId, ids, spans, i)
    out.push({ raw: span.raw, isWord: true, id: resolved, ids })
  }
  return out
}
