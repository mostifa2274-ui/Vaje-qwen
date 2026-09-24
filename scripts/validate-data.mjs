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
const webManifest = JSON.parse(readFileSync(join(publicDir, 'manifest.webmanifest'), 'utf8'))
const manifestIcons = Array.isArray(webManifest.icons) ? webManifest.icons : []
for (const icon of manifestIcons) {
  assert(existsSync(join(publicDir, icon.src)), `manifest icon is missing: ${icon.src}`)
}
for (const size of ['192x192', '512x512']) {
  assert(
    manifestIcons.some(icon => icon.type === 'image/png' && icon.sizes === size && (icon.purpose ?? 'any').split(' ').includes('any')),
    `manifest needs a ${size} PNG icon for install prompts`,
  )
}
assert(
  manifestIcons.some(icon => icon.purpose === 'maskable'),
  'manifest needs a dedicated full-bleed maskable icon',
)
assert(existsSync(join(publicDir, 'icons', 'apple-touch-icon.png')), 'missing iOS home-screen icon: apple-touch-icon.png')
const serviceWorkerSource = readFileSync(join(publicDir, 'sw.js'), 'utf8')
const swCachePlaceholder = '__GHESSE_BUILD_CACHE__'
assert(
  serviceWorkerSource.split(swCachePlaceholder).length === 2,
  'public/sw.js must contain exactly one build-cache placeholder for release stamping',
)
const swAssetsPlaceholder = '__GHESSE_BUILD_ASSETS__'
assert(
  serviceWorkerSource.split(swAssetsPlaceholder).length === 2,
  'public/sw.js must contain exactly one build-assets placeholder for release stamping',
)
for (let book = 1; book <= 8; book++) {
  assert(existsSync(join(publicDir, 'art', `book${book}.svg`)), `missing lesson artwork: art/book${book}.svg`)
}

console.log(`Validated ${vocab.length} words, ${chapters.length} chapters, ${sentenceCount} sentences, ${checkpointCount} checkpoints${requireBundledAudio ? ', and all bundled audio assets' : ', using speech-first production audio mode'}.`)
