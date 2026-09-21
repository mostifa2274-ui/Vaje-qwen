import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const dataDir = join(root, 'src/data')
const chapterDir = join(dataDir, 'chapters')
const publicDir = join(root, 'public')
const requireBundledAudio = process.env.GHESSE_REQUIRE_BUNDLED_AUDIO === '1'
const vocab = JSON.parse(readFileSync(join(dataDir, 'vocabulary.json'), 'utf8'))
const chapters = readdirSync(chapterDir)
  .filter(name => name.endsWith('.json'))
  .map(name => JSON.parse(readFileSync(join(chapterDir, name), 'utf8')))
  .sort((a, b) => a.book - b.book || a.n - b.n)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(vocab.length === 899, `expected 899 vocabulary entries, found ${vocab.length}`)
assert(new Set(vocab.map(word => word.id)).size === vocab.length, 'vocabulary ids must be unique')
assert(chapters.length === 40, `expected 40 chapters, found ${chapters.length}`)
assert(new Set(chapters.map(chapter => chapter.id)).size === chapters.length, 'chapter ids must be unique')

const ids = new Set(vocab.map(word => word.id))
const introduced = []
let sentenceCount = 0
let checkpointCount = 0
for (const chapter of chapters) {
  sentenceCount += chapter.sentences.length
  checkpointCount += chapter.check.length
  for (const id of chapter.new) {
    assert(ids.has(id), `${chapter.id}: unknown new word ${id}`)
    introduced.push(id)
  }
  for (const check of chapter.check) {
    assert(check.options.includes(check.a), `${chapter.id}: checkpoint answer is not an option`)
    for (const id of check.options) assert(ids.has(id), `${chapter.id}: unknown checkpoint word ${id}`)
  }
  if (requireBundledAudio) {
    chapter.sentences.forEach((_, index) => {
      const file = join(publicDir, 'audio/sentences', `${chapter.id}_${String(index).padStart(3, '0')}.mp3`)
      assert(existsSync(file), `missing sentence audio ${file}`)
    })
  }
}
assert(introduced.length === 899, `expected 899 introduced assignments, found ${introduced.length}`)
assert(new Set(introduced).size === 899, 'each vocabulary id must be introduced exactly once')

if (requireBundledAudio) {
  for (const word of vocab) {
    assert(existsSync(join(publicDir, 'audio/words', `${word.id}.mp3`)), `missing word audio: ${word.id}`)
    assert(existsSync(join(publicDir, 'audio/examples', `${word.id}.mp3`)), `missing example audio: ${word.id}`)
  }
}

assert(existsSync(join(publicDir, 'icons', 'icon.svg')), 'missing vector PWA icon: icon.svg')
for (let book = 1; book <= 8; book++) {
  assert(existsSync(join(publicDir, 'art', `book${book}.svg`)), `missing lesson artwork: art/book${book}.svg`)
}

console.log(`Validated ${vocab.length} words, ${chapters.length} chapters, ${sentenceCount} sentences, ${checkpointCount} checkpoints${requireBundledAudio ? ', and all bundled audio assets' : ', using speech-first production audio mode'}.`)
