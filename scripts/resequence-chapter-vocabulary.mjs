import fs from 'node:fs'
import path from 'node:path'
import { createCourseLexicon } from './lib/course-lexicon.mjs'

const root = new URL('..', import.meta.url).pathname
const vocab = JSON.parse(fs.readFileSync(path.join(root, 'src/data/vocabulary.json'), 'utf8'))
const storyCanon = JSON.parse(fs.readFileSync(path.join(root, 'src/data/storyCanon.json'), 'utf8'))
const chaptersDir = path.join(root, 'src/data/chapters')
const files = fs.readdirSync(chaptersDir).filter(file => /^b\d+c\d+\.json$/.test(file))
const chapters = files
  .map(file => ({
    file,
    chapter: JSON.parse(fs.readFileSync(path.join(chaptersDir, file), 'utf8'))
  }))
  .sort((a, b) => a.chapter.book - b.chapter.book || a.chapter.n - b.chapter.n)

const { analyzeSentence } = createCourseLexicon(vocab, {
  properNouns: storyCanon.properNouns || []
})

const firstChapter = new Map()
const firstOrder = new Map()
const unknown = []

for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex++) {
  const { chapter } = chapters[chapterIndex]
  let position = 0
  for (const sentence of chapter.sentences) {
    const analysis = analyzeSentence(sentence.en)
    for (const item of analysis.unknown) {
      unknown.push({
        chapter: chapter.id,
        token: item.token,
        sentence: sentence.en
      })
    }
    for (const id of analysis.orderedIds) {
      if (!firstChapter.has(id)) {
        firstChapter.set(id, chapterIndex)
        firstOrder.set(id, position++)
      }
    }
  }
}

const uniqueUnknown = []
const unknownKeys = new Set()
for (const item of unknown) {
  const key = `${item.chapter}|${item.token.toLowerCase()}`
  if (!unknownKeys.has(key)) {
    unknownKeys.add(key)
    uniqueUnknown.push(item)
  }
}

if (uniqueUnknown.length) {
  console.error(
    `Cannot resequence while ${uniqueUnknown.length} story words are outside the controlled 899-word deck:\n` +
    uniqueUnknown.map(item => `  ${item.chapter}: "${item.token}" — ${item.sentence}`).join('\n')
  )
  process.exit(2)
}

const neverUsed = vocab.filter(word => !firstChapter.has(word.id)).map(word => word.id)
if (neverUsed.length) {
  console.error(
    `Cannot resequence: ${neverUsed.length} vocabulary entries never appear in chapter text:\n  ${neverUsed.join(', ')}`
  )
  process.exit(3)
}

const originalChapter = new Map()
for (let i = 0; i < chapters.length; i++) {
  for (const id of chapters[i].chapter.new) originalChapter.set(id, i)
}

const moved = []
for (const word of vocab) {
  const from = originalChapter.get(word.id)
  const to = firstChapter.get(word.id)
  if (from !== to) {
    moved.push({
      id: word.id,
      from: from === undefined ? 'unassigned' : chapters[from].chapter.id,
      to: chapters[to].chapter.id
    })
  }
}

const assignments = chapters.map(() => [])
for (const word of vocab) {
  assignments[firstChapter.get(word.id)].push(word.id)
}

for (let i = 0; i < chapters.length; i++) {
  assignments[i].sort((a, b) => {
    const aOrder = firstOrder.get(a) ?? Number.MAX_SAFE_INTEGER
    const bOrder = firstOrder.get(b) ?? Number.MAX_SAFE_INTEGER
    if (aOrder !== bOrder) return aOrder - bOrder
    return vocab.findIndex(word => word.id === a) - vocab.findIndex(word => word.id === b)
  })
  chapters[i].chapter.new = assignments[i]
  fs.writeFileSync(
    path.join(chaptersDir, chapters[i].file),
    JSON.stringify(chapters[i].chapter, null, 2) + '\n'
  )
}

console.log(`Resequenced ${vocab.length} vocabulary items by first story use.`)
console.log(`Moved ${moved.length} words to an earlier/later review chapter.`)
for (const { chapter } of chapters) {
  console.log(`  ${chapter.id}: ${chapter.new.length} words`)
}
if (moved.length) {
  console.log('First 80 moves:')
  for (const item of moved.slice(0, 80)) console.log(`  ${item.id}: ${item.from} -> ${item.to}`)
}
