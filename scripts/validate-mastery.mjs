import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vocab = JSON.parse(fs.readFileSync(path.join(root, 'src/data/vocabulary.json'), 'utf8'))
const learningPolicy = JSON.parse(fs.readFileSync(path.join(root, 'src/data/learningPolicy.json'), 'utf8'))
const chapterDir = path.join(root, 'src/data/chapters')
const chapters = fs.readdirSync(chapterDir)
  .filter(name => name.endsWith('.json'))
  .map(name => JSON.parse(fs.readFileSync(path.join(chapterDir, name), 'utf8')))
  .sort((a, b) => a.book - b.book || a.n - b.n)

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

// End-of-book tests use a bounded cumulative sample: 24 words after book 1,
// then four more per book to a 52-word cap. Every studied book contributes,
// with double weight for the newest book. Function words stay in context and
// ambiguous sounds are excluded from isolated listening.
const CONTEXT_ONLY_TOPICS = new Set(['grammar', 'pronouns', 'prepositions', 'linking', 'question_words'])
const surfaceCounts = new Map()
for (const word of vocab) surfaceCounts.set(word.word.toLowerCase(), (surfaceCounts.get(word.word.toLowerCase()) ?? 0) + 1)
const byId = new Map(vocab.map(word => [word.id, word]))
const bookPools = new Map()
for (let book = 1; book <= 8; book++) {
  const bookChapters = chapters.filter(ch => ch.book === book)
  bookPools.set(book, [...new Set(bookChapters.flatMap(ch => ch.new))].map(id => byId.get(id)))
}
function bookTestWordCount(book) {
  const { minVocabularyQuestions, vocabularyQuestionStep, maxVocabularyQuestions } = learningPolicy.bookTest
  return Math.min(maxVocabularyQuestions, minVocabularyQuestions + (book - 1) * vocabularyQuestionStep)
}
function bookTestWordsBySource(book) {
  const target = bookTestWordCount(book)
  const { newestBookWeight, olderBookWeight } = learningPolicy.bookTest
  const weightUnits = (book - 1) * olderBookWeight + newestBookWeight
  const unit = Math.floor(target / weightUnits)
  const counts = new Map()
  for (let source = 1; source <= book; source++) counts.set(source, source === book ? unit * newestBookWeight : unit * olderBookWeight)
  let remaining = target - unit * weightUnits
  let source = book
  while (remaining > 0) {
    counts.set(source, counts.get(source) + 1)
    remaining--
    source--
    if (source < 1) source = book
  }
  return counts
}
const assessmentSizes = []
for (let book = 1; book <= 8; book++) {
  const allocation = bookTestWordsBySource(book)
  assert([...allocation.values()].reduce((sum, count) => sum + count, 0) === bookTestWordCount(book), `Book ${book}: invalid bounded assessment allocation`)
  for (const [source, asked] of allocation) {
    const pool = bookPools.get(source)
    const typed = pool.filter(word => !CONTEXT_ONLY_TOPICS.has(word.topic))
    const heard = typed.filter(word => !word.word.includes(',') && surfaceCounts.get(word.word.toLowerCase()) === 1)
    const perSection = Math.ceil(asked / 2)
    assert(typed.length >= perSection, `Book ${source}: fewer than ${perSection} content words for book-${book} translation`)
    assert(heard.length >= perSection, `Book ${source}: fewer than ${perSection} unambiguous words for book-${book} listening`)
  }
  const perSkill = 2 * Math.ceil(book / 2)
  const texts = JSON.parse(fs.readFileSync(path.join(root, `src/data/bookTests/b${book}.json`), 'utf8'))
  assert(texts.book === book && texts.reading?.length === perSkill && texts.listening?.length === perSkill, `Book ${book}: needs ${perSkill} reading and ${perSkill} listening texts`)
  assessmentSizes.push(bookTestWordCount(book))
}
const midpointPool = [...new Set(chapters.filter(ch => ch.book <= 4).flatMap(ch => ch.new))]
assert(midpointPool.length >= learningPolicy.midpointExam.wordQuestions, 'Midpoint pool is too small')
assert(vocab.length >= learningPolicy.finalExam.wordQuestions, 'Final pool is too small')

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

console.log(`Mastery validation passed: 899 words with contextual-production examples, 40 chapter prep gates, bounded end-of-book vocabulary samples ${assessmentSizes.join('/')} with 4 to 16 texts each, ${learningPolicy.midpointExam.wordQuestions}-question midpoint pool, ${learningPolicy.finalExam.wordQuestions}-question final pool.`)
