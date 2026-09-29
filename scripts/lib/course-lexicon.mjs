export const norm = value =>
  value.toLowerCase().replace(/[’]/g, "'").replace(/[‑–—]/g, '-')

const irregular = {
  is: 'be', are: 'be', am: 'be', was: 'be', were: 'be', been: 'be', being: 'be',
  has: 'have', had: 'have', does: 'do', did: 'do', done: 'do', doing: 'do',
  goes: 'go', went: 'go', gone: 'go', going: 'go', says: 'say', said: 'say',
  children: 'child', men: 'man', women: 'woman', people: 'person',
  feet: 'foot', teeth: 'tooth', mice: 'mouse', geese: 'goose',
  knives: 'knife', wives: 'wife', took: 'take', taken: 'take', ran: 'run',
  ate: 'eat', eaten: 'eat', drank: 'drink', drunk: 'drink', saw: 'see',
  seen: 'see', came: 'come', gave: 'give', given: 'give', got: 'get',
  gotten: 'get', made: 'make', found: 'find', told: 'tell', thought: 'think',
  bought: 'buy', brought: 'bring', sat: 'sit', slept: 'sleep', wrote: 'write',
  written: 'write', read: 'read', swam: 'swim', sang: 'sing', drew: 'draw',
  drawn: 'draw', knew: 'know', known: 'know', broke: 'break', broken: 'break',
  wore: 'wear', worn: 'wear', forgot: 'forget', heard: 'hear', felt: 'feel',
  stood: 'stand', spoke: 'speak', spoken: 'speak', began: 'begin',
  better: 'good', worse: 'bad'
}

const contractionForms = {
  "i'm": ['i', 'be'],
  "you're": ['you', 'be'],
  "we're": ['we', 'be'],
  "they're": ['they', 'be'],
  "he's": ['he', 'be'],
  "she's": ['she', 'be'],
  "it's": ['it', 'be'],
  "that's": ['that', 'be'],
  "what's": ['what', 'be'],
  "where's": ['where', 'be'],
  "who's": ['who', 'be'],
  "here's": ['here', 'be'],
  "there's": ['there', 'be'],
  "i've": ['i', 'have'],
  "you've": ['you', 'have'],
  "we've": ['we', 'have'],
  "they've": ['they', 'have'],
  "i'll": ['i', 'will'],
  "you'll": ['you', 'will'],
  "he'll": ['he', 'will'],
  "she'll": ['she', 'will'],
  "we'll": ['we', 'will'],
  "they'll": ['they', 'will'],
  "i'd": ['i', 'would'],
  "you'd": ['you', 'would'],
  "he'd": ['he', 'would'],
  "she'd": ['she', 'would'],
  "we'd": ['we', 'would'],
  "they'd": ['they', 'would'],
  "isn't": ['be', 'not'],
  "aren't": ['be', 'not'],
  "wasn't": ['be', 'not'],
  "weren't": ['be', 'not'],
  "don't": ['do', 'not'],
  "doesn't": ['do', 'not'],
  "didn't": ['do', 'not'],
  "haven't": ['have', 'not'],
  "hasn't": ['have', 'not'],
  "hadn't": ['have', 'not'],
  "can't": ['can', 'not'],
  // "cannot" is its own controlled A1 vocabulary entry; keep the literal
  // form available to lemmaOf() so first-use sequencing can assign it.
  "couldn't": ['could', 'not'],
  "won't": ['will', 'not'],
  "wouldn't": ['would', 'not'],
  "shouldn't": ['should', 'not'],
  "let's": ['let', 'us']
}

function buildSpans(text) {
  const spans = []
  const re = /[A-Za-z]+(?:[-‑'’][A-Za-z]+)*/g
  let last = 0
  let match
  while ((match = re.exec(text))) {
    if (match.index > last) spans.push({ raw: text.slice(last, match.index), isWord: false })
    spans.push({ raw: match[0], isWord: true })
    last = match.index + match[0].length
  }
  if (last < text.length) spans.push({ raw: text.slice(last), isWord: false })
  return spans
}

function previousWords(spans, index, count = 2) {
  const out = []
  for (let i = index - 1; i >= 0 && out.length < count; i--) {
    if (spans[i].isWord) out.push(norm(spans[i].raw))
  }
  return out
}

export function createCourseLexicon(vocab, { properNouns = [] } = {}) {
  const proper = new Set(properNouns.map(norm))
  const surfaceIds = new Map()
  const lemma = new Map()
  const phrases = new Map()

  for (const word of vocab) {
    for (const form of norm(word.word).split(/,\s*/)) {
      const value = form.trim()
      if (!value) continue
      surfaceIds.set(value, [...(surfaceIds.get(value) || []), word.id])
      if (value.includes(' ')) {
        if (!phrases.has(value)) phrases.set(value, word.id)
      } else if (!lemma.has(value)) {
        lemma.set(value, word.id)
      }
    }
    lemma.set(word.id, word.id)
  }

  function firstExisting(candidates) {
    for (const candidate of [...new Set(candidates)]) {
      if (lemma.has(candidate)) return lemma.get(candidate)
    }
  }

  function lemmaOf(token) {
    const value = norm(token)
    if (lemma.has(value)) return lemma.get(value)
    if (irregular[value] && lemma.has(irregular[value])) return lemma.get(irregular[value])

    const candidates = []
    if (value.endsWith("'s") && value.length > 2) candidates.push(value.slice(0, -2))
    if (value.endsWith('ies') && value.length > 3) candidates.push(value.slice(0, -3) + 'y')
    // Keep validation aligned with the runtime lemmatizer. Prefer regular
    // third-person/plural -s before -ves -> -f/-fe so "lives" resolves to
    // the verb "live"; irregular wives/knives are handled above.
    if (value.endsWith('es') && value.length > 3) {
      candidates.push(value.slice(0, -1), value.slice(0, -2))
    } else if (value.endsWith('s') && value.length > 3) {
      candidates.push(value.slice(0, -1))
    }
    if (value.endsWith('ves') && value.length > 3) {
      candidates.push(value.slice(0, -3) + 'f', value.slice(0, -3) + 'fe')
    }
    if (value.endsWith('ied') && value.length > 3) candidates.push(value.slice(0, -3) + 'y')
    if (value.endsWith('ing') && value.length > 4) {
      const stem = value.slice(0, -3)
      candidates.push(stem, stem.replace(/(.)\1$/, '$1'), stem + 'e')
    }
    if (value.endsWith('ed') && value.length > 3) {
      const stem = value.slice(0, -2)
      candidates.push(stem, stem.replace(/(.)\1$/, '$1'), stem + 'e')
    }
    if (value.endsWith('er') && value.length > 4) candidates.push(value.slice(0, -2))
    if (value.endsWith('est') && value.length > 5) candidates.push(value.slice(0, -3))
    if (value.endsWith('ly') && value.length > 4) candidates.push(value.slice(0, -2))
    return firstExisting(candidates)
  }

  function contextual(raw, id, ids, spans, index) {
    if (ids.includes('like') && ids.includes('like-2')) {
      const form = norm(raw)
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
      if (['one', 'a', 'an'].includes(prev)) return 'second-2'
      return 'second'
    }
    return id
  }

  function idsFromContraction(value) {
    const forms = contractionForms[value]
    if (!forms) return null
    const ids = forms.map(form => lemma.get(form)).filter(Boolean)
    return ids.length === forms.length ? ids : null
  }

  function analyzeSentence(text) {
    const spans = buildSpans(text)
    const orderedIds = []
    const unknown = []

    for (let i = 0; i < spans.length; i++) {
      const span = spans[i]
      if (!span.isWord) continue
      const lower = norm(span.raw)

      if (proper.has(lower)) continue
      if (lower.endsWith("'s") && proper.has(lower.slice(0, -2))) continue

      const contractionIds = idsFromContraction(lower)
      if (contractionIds) {
        orderedIds.push(...contractionIds)
        continue
      }

      let matchedPhrase = false
      for (let len = 4; len >= 2 && !matchedPhrase; len--) {
        let candidate = lower
        let cursor = i
        let words = 1
        while (words < len) {
          const separator = spans[cursor + 1]
          const next = spans[cursor + 2]
          if (!separator || !next || separator.isWord || !next.isWord || separator.raw !== ' ') break
          candidate += ' ' + norm(next.raw)
          cursor += 2
          words++
        }
        if (words !== len) continue
        const phraseId = phrases.get(candidate)
        if (!phraseId) continue
        const ids = surfaceIds.get(candidate) || [phraseId]
        orderedIds.push(contextual(candidate, phraseId, ids, spans, i))
        i = cursor
        matchedPhrase = true
      }
      if (matchedPhrase) continue

      const id = lemmaOf(lower)
      if (!id) {
        unknown.push({ token: span.raw, normalized: lower })
        continue
      }
      const canonical = norm(vocab.find(word => word.id === id)?.word || lower)
      const ids = surfaceIds.get(canonical) || surfaceIds.get(lower) || [id]
      orderedIds.push(contextual(span.raw, id, ids, spans, i))
    }

    return { orderedIds, ids: new Set(orderedIds), unknown }
  }

  return { analyzeSentence, lemmaOf }
}
