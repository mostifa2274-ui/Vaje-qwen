import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createCourseLexicon } from './lib/course-lexicon.mjs'

const root = new URL('..', import.meta.url).pathname
const dataDir = join(root, 'src/data')
const vocab = JSON.parse(readFileSync(join(dataDir, 'vocabulary.json'), 'utf8'))
const storyCanon = JSON.parse(readFileSync(join(dataDir, 'storyCanon.json'), 'utf8'))
const chapters = readdirSync(join(dataDir, 'chapters'))
  .filter(name => /^b\d+c\d+\.json$/.test(name))
  .map(name => JSON.parse(readFileSync(join(dataDir, 'chapters', name), 'utf8')))
  .sort((a, b) => a.book - b.book || a.n - b.n)

const allIds = new Set(vocab.map(word => word.id))
const properNouns = storyCanon.properNouns ?? []
const chapterAllowed = new Map()
const bookAllowed = new Map()

const introduced = new Set()
for (const chapter of chapters) {
  for (const id of chapter.new) introduced.add(id)
  chapterAllowed.set(chapter.id, new Set(introduced))
  bookAllowed.set(chapter.book, new Set(introduced))
}

function textFields(text) {
  return [
    ['title', text.titleEn],
    ...text.sentences.map((sentence, index) => [`sentence ${index + 1}`, sentence.en]),
    ...text.questions.flatMap((question, questionIndex) => [
      [`question ${questionIndex + 1}`, question.q],
      ...question.options.map((option, optionIndex) => [`question ${questionIndex + 1} option ${optionIndex + 1}`, option]),
    ]),
  ]
}

const unknown = []
const premature = []

function validateText(scope, text, allowed) {
  const lexicon = createCourseLexicon(vocab, {
    properNouns: [...properNouns, ...(text.names ?? [])],
  })

  for (const [field, value] of textFields(text)) {
    const analysis = lexicon.analyzeSentence(value)
    for (const item of analysis.unknown) {
      unknown.push({ scope, text: text.id, field, token: item.token, value })
    }
    for (const id of analysis.ids) {
      if (!allowed.has(id)) premature.push({ scope, text: text.id, field, id, value })
    }
  }
}

for (const name of readdirSync(join(dataDir, 'chapterListening')).filter(file => file.endsWith('.json')).sort()) {
  const content = JSON.parse(readFileSync(join(dataDir, 'chapterListening', name), 'utf8'))
  const chapterId = name.replace(/\.json$/, '')
  const allowed = chapterAllowed.get(chapterId)
  if (!allowed) throw new Error(`chapter listening file has no matching course chapter: ${name}`)
  validateText(`chapter-listening:${chapterId}`, content, allowed)
}

for (const name of readdirSync(join(dataDir, 'bookTests')).filter(file => /^b\d+\.json$/.test(file)).sort()) {
  const content = JSON.parse(readFileSync(join(dataDir, 'bookTests', name), 'utf8'))
  const allowed = bookAllowed.get(content.book)
  if (!allowed) throw new Error(`book test has invalid book number: ${name}`)
  for (const text of [...content.reading, ...content.listening]) {
    validateText(`book-test:${content.book}`, text, allowed)
  }
}

const midpoint = JSON.parse(readFileSync(join(dataDir, 'examTests', 'midpoint.json'), 'utf8'))
const midpointAllowed = bookAllowed.get(4)
for (const text of [...midpoint.reading, ...midpoint.listening]) {
  validateText('midpoint', text, midpointAllowed)
}

const finalExam = JSON.parse(readFileSync(join(dataDir, 'examTests', 'final.json'), 'utf8'))
for (const text of [...finalExam.reading, ...finalExam.listening]) {
  validateText('final', text, allIds)
}

function uniqueBy(items, key) {
  const seen = new Set()
  return items.filter(item => {
    const value = key(item)
    if (seen.has(value)) return false
    seen.add(value)
    return true
  })
}

const uniqueUnknown = uniqueBy(unknown, item => `${item.scope}|${item.text}|${item.token.toLowerCase()}`)
const uniquePremature = uniqueBy(premature, item => `${item.scope}|${item.text}|${item.id}`)

if (uniqueUnknown.length || uniquePremature.length) {
  const sections = []
  if (uniqueUnknown.length) {
    sections.push(
      `Out-of-deck assessment words (${uniqueUnknown.length}):\n` +
      uniqueUnknown.map(item => `  ${item.scope} / ${item.text} / ${item.field}: "${item.token}" — ${item.value}`).join('\n')
    )
  }
  if (uniquePremature.length) {
    sections.push(
      `Assessment words used before teaching (${uniquePremature.length}):\n` +
      uniquePremature.map(item => `  ${item.scope} / ${item.text} / ${item.field}: ${item.id} — ${item.value}`).join('\n')
    )
  }
  console.error(
    'Assessment prerequisite-vocabulary validation failed. Learners must not be tested on lexical material they have not yet been taught.\n\n' +
    sections.join('\n\n')
  )
  process.exit(1)
}

console.log(
  'Assessment prerequisite-vocabulary validation passed: chapter listening, end-of-book tests, midpoint and final assessment text use only vocabulary taught by that point.'
)
