import fs from 'node:fs'
import path from 'node:path'
import { createCourseLexicon } from './lib/course-lexicon.mjs'

const root = new URL('..', import.meta.url).pathname
const vocab = JSON.parse(fs.readFileSync(path.join(root, 'src/data/vocabulary.json'), 'utf8'))
const storyCanon = JSON.parse(fs.readFileSync(path.join(root, 'src/data/storyCanon.json'), 'utf8'))
const chaptersDir = path.join(root, 'src/data/chapters')
const chapters = fs.readdirSync(chaptersDir)
  .filter(file => /^b\d+c\d+\.json$/.test(file))
  .map(file => JSON.parse(fs.readFileSync(path.join(chaptersDir, file), 'utf8')))
  .sort((a, b) => a.book - b.book || a.n - b.n)

const { analyzeSentence } = createCourseLexicon(vocab, {
  properNouns: storyCanon.properNouns || []
})

const introChapter = new Map()
for (const chapter of chapters) {
  for (const id of chapter.new) introChapter.set(id, chapter.id)
}

const introduced = new Set()
const unknown = []
const premature = []
const missingInOwnChapter = []
const invalidCheckpointIds = []

for (const chapter of chapters) {
  const available = new Set([...introduced, ...chapter.new])
  const usedHere = new Set()

  for (const sentence of chapter.sentences) {
    const analysis = analyzeSentence(sentence.en)

    for (const item of analysis.unknown) {
      unknown.push({
        chapter: chapter.id,
        token: item.token,
        sentence: sentence.en
      })
    }

    for (const id of analysis.ids) {
      usedHere.add(id)
      if (!available.has(id)) {
        premature.push({
          chapter: chapter.id,
          id,
          assigned: introChapter.get(id) || 'unassigned',
          sentence: sentence.en
        })
      }
    }
  }

  // Chapter comprehension starts immediately after reading, so its authored
  // prompts and answer choices must not introduce lexical material beyond the
  // words available by this chapter.
  for (const [index, checkpoint] of chapter.check.entries()) {
    const analysis = analyzeSentence(checkpoint.q)
    for (const item of analysis.unknown) {
      unknown.push({
        chapter: chapter.id,
        token: item.token,
        sentence: `checkpoint ${index + 1}: ${checkpoint.q}`,
      })
    }
    for (const id of analysis.ids) {
      if (!available.has(id)) {
        premature.push({
          chapter: chapter.id,
          id,
          assigned: introChapter.get(id) || 'unassigned',
          sentence: `checkpoint ${index + 1}: ${checkpoint.q}`,
        })
      }
    }

    const optionIds = Array.isArray(checkpoint.options) ? checkpoint.options : []
    if (optionIds.length !== 4 || new Set(optionIds).size !== optionIds.length) {
      invalidCheckpointIds.push({
        chapter: chapter.id,
        index: index + 1,
        detail: 'checkpoint must have four unique vocabulary options',
      })
    }
    for (const id of optionIds) {
      if (!allIds.has(id)) {
        invalidCheckpointIds.push({
          chapter: chapter.id,
          index: index + 1,
          detail: `unknown option id ${id}`,
        })
      } else if (!available.has(id)) {
        premature.push({
          chapter: chapter.id,
          id,
          assigned: introChapter.get(id) || 'unassigned',
          sentence: `checkpoint ${index + 1} option`,
        })
      }
    }
    if (!optionIds.includes(checkpoint.a)) {
      invalidCheckpointIds.push({
        chapter: chapter.id,
        index: index + 1,
        detail: `answer ${checkpoint.a} is not one of the options`,
      })
    }
  }

  for (const id of chapter.new) {
    if (!usedHere.has(id)) missingInOwnChapter.push({ chapter: chapter.id, id })
  }

  for (const id of chapter.new) introduced.add(id)
}

const uniqueBy = (items, key) => {
  const seen = new Set()
  return items.filter(item => {
    const value = key(item)
    if (seen.has(value)) return false
    seen.add(value)
    return true
  })
}

const uniqueUnknown = uniqueBy(unknown, item => `${item.chapter}|${item.token.toLowerCase()}`)
const uniquePremature = uniqueBy(premature, item => `${item.chapter}|${item.id}`)

if (uniqueUnknown.length || uniquePremature.length || missingInOwnChapter.length || invalidCheckpointIds.length) {
  const sections = []

  if (uniqueUnknown.length) {
    sections.push(
      `Unreviewed/out-of-deck words (${uniqueUnknown.length}):\n` +
      uniqueUnknown.map(item => `  ${item.chapter}: "${item.token}" — ${item.sentence}`).join('\n')
    )
  }

  if (uniquePremature.length) {
    sections.push(
      `Words used before their review chapter (${uniquePremature.length}):\n` +
      uniquePremature.map(item =>
        `  ${item.chapter}: ${item.id} (currently reviewed in ${item.assigned}) — ${item.sentence}`
      ).join('\n')
    )
  }

  if (missingInOwnChapter.length) {
    sections.push(
      `Assigned new words not used in their own chapter (${missingInOwnChapter.length}):\n` +
      missingInOwnChapter.map(item => `  ${item.chapter}: ${item.id}`).join('\n')
    )
  }

  if (invalidCheckpointIds.length) {
    sections.push(
      `Invalid authored chapter checkpoints (${invalidCheckpointIds.length}):\n` +
      invalidCheckpointIds.map(item => `  ${item.chapter} / checkpoint ${item.index}: ${item.detail}`).join('\n')
    )
  }

  console.error(
    'Chapter prerequisite-vocabulary validation failed. Every lexical word in a story must be in the 899-word deck and reviewed no later than that chapter.\n\n' +
    sections.join('\n\n')
  )
  process.exit(1)
}

console.log(
  `Chapter prerequisite-vocabulary validation passed: all ${vocab.length} target words are introduced where they appear, every story word is reviewed before reading, and authored chapter checkpoints use only available vocabulary.`
)
