import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = path => readFileSync(join(root, path))
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const review = JSON.parse(read('src/data/chapterArtReview.json'))
const artManifest = JSON.parse(read('src/data/chapterArtBatch.json'))
const metadata = read('src/art/generatedChapterArt.ts').toString()
const chapters = readdirSync(join(root, 'src/data/chapters')).filter(name => name.endsWith('.json'))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function storyFingerprint(chapter) {
  const payload = JSON.stringify({
    id: chapter.id,
    book: chapter.book,
    n: chapter.n,
    titleFa: chapter.titleFa,
    titleEn: chapter.titleEn,
    new: chapter.new,
    sentences: chapter.sentences,
  })
  return createHash('sha1').update(payload, 'utf8').digest('hex')
}

assert(review.schema === 1 && review.reviewer === 'assistant-visual-review', 'Artwork review must identify its schema and actual reviewer')
assert(review.chapterHashSemantics === 'legacy-full-chapter-sha256-at-review-time', 'Artwork review must preserve the meaning of its original full-file hashes')
assert(review.storyFingerprintSource === 'src/data/chapterArtBatch.json#reviewedStoryFingerprints', 'Artwork review must identify the semantic story-fingerprint source')
assert(Object.keys(review.chapters).length === chapters.length, 'Every chapter needs a current artwork review')

const storyFingerprints = artManifest.reviewedStoryFingerprints ?? {}
for (const file of chapters) {
  const id = file.replace(/\.json$/, '')
  const item = review.chapters[id]
  const chapter = JSON.parse(read(`src/data/chapters/${file}`))

  assert(item && typeof item.focalScene === 'string' && item.focalScene.trim(), `${id}: missing focal-scene review`)
  assert(typeof item.chapterSha256 === 'string' && /^[a-f0-9]{64}$/.test(item.chapterSha256), `${id}: original full-chapter review hash is malformed`)
  assert(
    storyFingerprints[id] === storyFingerprint(chapter),
    `${id}: art-relevant story payload changed; review its artwork against the new scene before updating the semantic fingerprint`,
  )
  assert(new RegExp(`^art/chapters/${id}\\.(webp|avif)$`).test(item.asset), `${id}: review asset path must match its chapter`)
  assert(item.artSha256 === sha256(read(`public/${item.asset}`)), `${id}: artwork changed; visual review required`)
  const block = metadata.match(new RegExp(`  ${id}: \\{([\\s\\S]*?)\\n  \\}`))?.[1]
  assert(block, `${id}: artwork metadata is missing`)
  assert(item.metadataSha256 === sha256(block), `${id}: description changed; check it against the reviewed scene`)
}

console.log(`Artwork semantic review is current for ${chapters.length} art-relevant story payloads, images and descriptions.`)
