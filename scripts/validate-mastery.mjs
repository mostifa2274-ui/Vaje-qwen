import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vocab = JSON.parse(fs.readFileSync(path.join(root, 'src/data/vocabulary.json'), 'utf8'))
const chapterDir = path.join(root, 'src/data/chapters')
const chapters = fs.readdirSync(chapterDir)
  .filter(name => name.endsWith('.json'))
  .map(name => JSON.parse(fs.readFileSync(path.join(chapterDir, name), 'utf8')))
  .sort((a, b) => a.book - b.book || a.n - b.n)
const stale = JSON.parse(fs.readFileSync(path.join(root, 'src/data/staleSentenceAudio.json'), 'utf8'))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const ids = new Set(vocab.map(word => word.id))
assert(vocab.length === 899 && ids.size === 899, 'Expected 899 unique vocabulary ids')
assert(chapters.length === 40, 'Expected 40 chapters')

const assigned = []
for (const chapter of chapters) {
  assert(chapter.new.length > 0, `${chapter.id}: chapter has no new words`)
  for (const id of chapter.new) {
    assert(ids.has(id), `${chapter.id}: unknown new word ${id}`)
    assigned.push(id)
  }
}
assert(assigned.length === 899, `Expected 899 introduction assignments; got ${assigned.length}`)
assert(new Set(assigned).size === 899, 'A vocabulary id is introduced in more than one chapter')

const bySurface = new Map()
for (const word of vocab) {
  assert(word.word?.trim(), `${word.id}: missing English headword`)
  assert(word.fa?.trim(), `${word.id}: missing Persian meaning`)
  assert(word.ex?.trim(), `${word.id}: missing example sentence`)
  const surface = word.word.trim().toLowerCase()
  const list = bySurface.get(surface) ?? []
  list.push(word)
  bySurface.set(surface, list)
}
for (const [surface, entries] of bySurface) {
  if (entries.length < 2) continue
  assert(entries.every(entry => entry.ex?.trim()), `${surface}: homonym needs contextual examples`)
  assert(new Set(entries.map(entry => entry.id)).size === entries.length, `${surface}: duplicate homonym ids`)
}

function contextSurface(word) {
  const base = word.word.trim()
  const candidates = [base]
  if (!/[\s,]/.test(base)) {
    candidates.push(`${base}s`, `${base}es`, `${base}ed`, `${base}ing`)
    if (/y$/i.test(base)) candidates.push(`${base.slice(0, -1)}ies`)
    if (/e$/i.test(base)) candidates.push(`${base.slice(0, -1)}ing`)
  }
  for (const candidate of [...new Set(candidates)].sort((a, b) => b.length - a.length)) {
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(word.ex)) return candidate
  }
  return undefined
}

for (const word of vocab) {
  assert(contextSurface(word), `${word.id}: example cannot support contextual production`)
}

// End-of-book tests (src/engine/bookTest.ts) ask 12 typed and 12 listening
// words, never function words, and never a surface two deck entries share.
// Book 1 draws all 24 from itself; each book also has its own four texts.
const CONTEXT_ONLY_TOPICS = new Set(['grammar', 'pronouns', 'prepositions', 'linking', 'question_words'])
const surfaceCounts = new Map()
for (const word of vocab) surfaceCounts.set(word.word.toLowerCase(), (surfaceCounts.get(word.word.toLowerCase()) ?? 0) + 1)
const byId = new Map(vocab.map(word => [word.id, word]))
const bookSizes = []
for (let book = 1; book <= 8; book++) {
  const bookChapters = chapters.filter(ch => ch.book === book)
  const pool = [...new Set(bookChapters.flatMap(ch => ch.new))].map(id => byId.get(id))
  const typed = pool.filter(word => !CONTEXT_ONLY_TOPICS.has(word.topic))
  const heard = typed.filter(word => !word.word.includes(',') && surfaceCounts.get(word.word.toLowerCase()) === 1)
  assert(typed.length >= 24, `Book ${book}: fewer than 24 content words for its end-of-book test`)
  assert(heard.length >= 12, `Book ${book}: fewer than 12 unambiguous words for listening`)
  const texts = JSON.parse(fs.readFileSync(path.join(root, `src/data/bookTests/b${book}.json`), 'utf8'))
  assert(texts.book === book && texts.reading?.length === 2 && texts.listening?.length === 2, `Book ${book}: needs two reading and two listening texts`)
  bookSizes.push(pool.length)
}
const midpointPool = [...new Set(chapters.filter(ch => ch.book <= 4).flatMap(ch => ch.new))]
assert(midpointPool.length >= 56, 'Midpoint pool is too small')
assert(vocab.length >= 88, 'Final pool is too small')

const sentenceKeys = new Set()
for (const chapter of chapters) chapter.sentences.forEach((_, index) => sentenceKeys.add(`${chapter.id}:${index}`))
assert(Array.isArray(stale), 'staleSentenceAudio.json must be an array')
assert(stale.every(key => typeof key === 'string'), 'Every stale-audio key must be a string')
assert(new Set(stale).size === stale.length, 'Duplicate stale-audio keys')
for (const key of stale) assert(sentenceKeys.has(key), `Unknown stale-audio key ${key}`)

// Validate that every target can support four distinct choices for both English
// and Persian labels. The runtime generator also prefers same-topic distractors.
for (const target of vocab) {
  for (const field of ['word', 'fa']) {
    const targetLabel = target[field].trim().toLowerCase()
    const labels = new Set([targetLabel])
    for (const candidate of vocab) {
      if (candidate.id === target.id) continue
      const label = candidate[field].trim().toLowerCase()
      if (label) labels.add(label)
      if (labels.size >= 4) break
    }
    assert(labels.size >= 4, `${target.id}: cannot build four unique ${field} choices`)
  }
}

console.log(`Mastery validation passed: 899 words with contextual-production examples, 40 chapter prep gates, end-of-book pools ${bookSizes.join('/')} with four texts each, 56-question midpoint pool, 88-question final pool, ${stale.length} stale-audio blocks.`)
