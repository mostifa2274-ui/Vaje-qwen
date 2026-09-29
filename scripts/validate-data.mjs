import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createCourseLexicon } from './lib/course-lexicon.mjs'

const root = new URL('..', import.meta.url).pathname
const dataDir = join(root, 'src/data')
const chapterDir = join(dataDir, 'chapters')
const publicDir = join(root, 'public')
const allowMissingAudio = process.env.GHESSE_ALLOW_MISSING_AUDIO === '1'
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

// Lexical records are a public learning contract, not arbitrary JSON. Reject
// common authoring/import mistakes before they can reach lessons, audio hashes,
// review scheduling or a research export.
const REQUIRED_VOCAB_FIELDS = ['id', 'word', 'fa', 'ipa', 'topic', 'ex', 'tr', 'pos', 'cefr']
const PERSIAN_TEXT = /[\u0621-\u063a\u0641-\u064a\u066e-\u066f\u0671-\u06d3\u06fa-\u06fc\u06ff]/
const LATIN_TEXT = /[A-Za-z]/
const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SAFE_TOPIC = /^[a-z0-9][a-z0-9 _-]*$/

for (const [index, word] of vocab.entries()) {
  const label = typeof word?.id === 'string' && word.id ? word.id : `entry #${index + 1}`
  for (const field of REQUIRED_VOCAB_FIELDS) {
    assert(typeof word?.[field] === 'string' && word[field].trim(), `${label}: ${field} must be a non-empty string`)
    assert(word[field] === word[field].trim(), `${label}: ${field} must not have leading/trailing whitespace`)
    assert(!/[\r\n]/.test(word[field]), `${label}: ${field} must stay on one line`)
    assert(!/ {2,}/.test(word[field]), `${label}: ${field} must not contain repeated ASCII spaces`)
  }
  assert(SAFE_ID.test(word.id), `${label}: id must be lowercase kebab-case`)
  assert(PERSIAN_TEXT.test(word.fa), `${label}: Persian gloss must contain Persian text`)
  assert(PERSIAN_TEXT.test(word.tr), `${label}: Persian example translation must contain Persian text`)
  assert(LATIN_TEXT.test(word.word), `${label}: English headword must contain Latin text`)
  assert(LATIN_TEXT.test(word.ex), `${label}: English example must contain Latin text`)
  const exampleWords = word.ex.match(/[A-Za-z]+(?:[-'’][A-Za-z]+)*/g) ?? []
  assert(exampleWords.length >= 3 && exampleWords.length <= 14, `${label}: English example must stay flashcard-sized (3–14 words)`)
  assert(/[.!?]$/.test(word.ex), `${label}: English example must end with sentence punctuation`)
  const firstLatin = word.ex.match(/[A-Za-z]/)?.[0]
  assert(firstLatin && firstLatin === firstLatin.toUpperCase(), `${label}: English example must begin as a sentence`)
  assert(word.cefr === 'A1', `${label}: active deck entries must be CEFR A1`)
  assert(!word.ipa.includes('/'), `${label}: IPA is stored without wrapping slashes`)
  const primaryStressCount = (word.ipa.match(/ˈ/g) ?? []).length
  assert(primaryStressCount <= 1, `${label}: IPA must use ˌ for non-primary stress; multiple ˈ marks are not allowed`)
  assert(SAFE_TOPIC.test(word.topic), `${label}: topic contains unsupported characters`)
}

// Reusing the exact same example for different headwords is normally a
// copy/paste defect and weakens contextual retrieval. Persian glosses may
// legitimately repeat for synonyms, so they are intentionally not unique.
assert(new Set(vocab.map(word => word.ex)).size === vocab.length, 'every vocabulary entry must have its own English example')

// Each teaching example must actually demonstrate its own target lexical item
// (or an inflected/irregular form that resolves to it). This is stricter than
// merely checking for Latin text: a fluent but unrelated example would teach
// the learner the wrong evidence. The shared course lexicon also keeps
// homograph senses such as like/like-2 and second/second-2 contextual.
const { analyzeSentence: analyzeVocabularyExample } = createCourseLexicon(vocab)
for (const word of vocab) {
  const analysis = analyzeVocabularyExample(word.ex)
  assert(
    analysis.ids.has(word.id),
    `${word.id}: English example must contain the target word/sense or a recognized inflected form — "${word.ex}"`,
  )
}

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
}
assert(introduced.length === 899, `expected 899 introduced assignments, found ${introduced.length}`)
assert(new Set(introduced).size === 899, 'each vocabulary id must be introduced exactly once')

// Recorded narration (scripts/audio/generate_audio.py). Clip names hash the
// exact text, mirroring clipId() in src/engine/audioClips.ts.
function fnv1a(bytes, seed) {
  let hash = seed >>> 0
  for (const byte of bytes) {
    hash ^= byte
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}
const normalizeClipText = text => text.replace(/’/g, "'").split(/\s+/).filter(Boolean).join(' ')
const clipId = (kind, text) => {
  const bytes = new TextEncoder().encode(`${kind}|${normalizeClipText(text)}`)
  return fnv1a(bytes, 0x811c9dc5) + fnv1a(bytes, (0x01000193 ^ 0x9e3779b9) >>> 0)
}
const prompts = new Map()
const addPrompt = (kind, text) => prompts.set(clipId(kind, text), `${kind} "${normalizeClipText(text)}"`)
for (const word of vocab) {
  addPrompt('w', word.word)
  addPrompt('s', word.ex)
}
for (const chapter of chapters) for (const sentence of chapter.sentences) addPrompt('s', sentence.en)
for (const folder of ['bookTests', 'examTests']) {
  const testDir = join(dataDir, folder)
  for (const name of readdirSync(testDir).filter(file => file.endsWith('.json')).sort()) {
    const content = JSON.parse(readFileSync(join(testDir, name), 'utf8'))
    for (const text of [...content.reading, ...content.listening]) {
      for (const sentence of text.sentences) addPrompt('s', sentence.en)
    }
  }
}
const chapterListeningDir = join(dataDir, 'chapterListening')
for (const name of readdirSync(chapterListeningDir).filter(file => file.endsWith('.json')).sort()) {
  for (const sentence of JSON.parse(readFileSync(join(chapterListeningDir, name), 'utf8')).sentences) addPrompt('s', sentence.en)
}
for (const sample of JSON.parse(readFileSync(join(root, 'scripts/audio/extra-prompts.json'), 'utf8'))) addPrompt('s', sample)

const audioDir = join(publicDir, 'audio')
const audioIndex = JSON.parse(readFileSync(join(audioDir, 'index.json'), 'utf8'))
assert(typeof audioIndex.voice === 'string' && Array.isArray(audioIndex.clips), 'public/audio/index.json must list a voice and its clips')
const listedClips = new Set(audioIndex.clips)
assert(listedClips.size === audioIndex.clips.length, 'public/audio/index.json lists a clip twice')
const clipFiles = new Set(readdirSync(audioDir).filter(name => name.endsWith('.mp3')).map(name => name.slice(0, -4)))
for (const id of listedClips) {
  assert(clipFiles.has(id), `public/audio/index.json lists a missing clip: ${id}.mp3`)
  assert(prompts.has(id), `public/audio/${id}.mp3 no longer matches any course text; re-run scripts/audio/generate_audio.py`)
}
for (const id of clipFiles) assert(listedClips.has(id), `public/audio/${id}.mp3 is not listed in index.json`)
const unrecorded = [...prompts].filter(([id]) => !listedClips.has(id)).map(([, prompt]) => prompt)
if (unrecorded.length > 0) {
  const message = `${unrecorded.length} prompts have no recording (they fall back to the device voice), e.g. ${unrecorded.slice(0, 3).join('; ')}. Re-run scripts/audio/generate_audio.py.`
  if (!allowMissingAudio) throw new Error(message)
  console.warn(`Warning: ${message}`)
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
const chapterArtDir = join(publicDir, 'art', 'chapters')
assert(existsSync(chapterArtDir), 'missing reviewed chapter-art directory: public/art/chapters')
const chapterArtFiles = readdirSync(chapterArtDir)
  .filter(name => /\.(?:avif|webp)$/i.test(name))
const chapterArtIds = chapterArtFiles.map(name => name.replace(/\.(?:avif|webp)$/i, ''))
assert(chapterArtFiles.length === 40, `expected 40 reviewed chapter images, found ${chapterArtFiles.length}`)
assert(new Set(chapterArtIds).size === 40, 'reviewed chapter artwork must have exactly one raster per chapter')
for (const chapter of chapters) {
  assert(chapterArtIds.includes(chapter.id), `missing reviewed chapter artwork: ${chapter.id}`)
}
for (let book = 1; book <= 8; book++) {
  const firstChapter = chapters.find(chapter => chapter.book === book)
  assert(firstChapter && chapterArtIds.includes(firstChapter.id), `missing reviewed book-cover artwork for book ${book}`)
}

console.log(`Validated ${vocab.length} words, ${chapters.length} chapters, ${sentenceCount} sentences, ${checkpointCount} checkpoints, and ${prompts.size - unrecorded.length}/${prompts.size} recorded prompts (${audioIndex.voice}).`)
