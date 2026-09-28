import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = path => readFileSync(join(root, path))
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const review = JSON.parse(read('src/data/chapterArtReview.json'))
const metadata = read('src/art/generatedChapterArt.ts').toString()
const chapters = readdirSync(join(root, 'src/data/chapters')).filter(name => name.endsWith('.json'))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(review.schema === 1 && review.reviewer === 'assistant-visual-review', 'Artwork review must identify its schema and actual reviewer')
assert(Object.keys(review.chapters).length === chapters.length, 'Every chapter needs a current artwork review')
for (const file of chapters) {
  const id = file.replace(/\.json$/, '')
  const item = review.chapters[id]
  assert(item && typeof item.focalScene === 'string' && item.focalScene.trim(), `${id}: missing focal-scene review`)
  assert(item.chapterSha256 === sha256(read(`src/data/chapters/${file}`)), `${id}: story changed; review its artwork against the new text`)
  assert(new RegExp(`^art/chapters/${id}\\.(webp|avif)$`).test(item.asset), `${id}: review asset path must match its chapter`)
  assert(item.artSha256 === sha256(read(`public/${item.asset}`)), `${id}: artwork changed; visual review required`)
  const block = metadata.match(new RegExp(`  ${id}: \\{([\\s\\S]*?)\\n  \\}`))?.[1]
  assert(block, `${id}: artwork metadata is missing`)
  assert(item.metadataSha256 === sha256(block), `${id}: description changed; check it against the reviewed scene`)
}
console.log(`Artwork semantic review is current for ${chapters.length} chapter texts, images and descriptions.`)
