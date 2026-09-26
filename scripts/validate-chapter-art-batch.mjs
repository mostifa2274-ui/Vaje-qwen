import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = new URL('..', import.meta.url).pathname
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/data/chapterArtBatch.json'), 'utf8'))
const chapterDir = path.join(root, 'src/data/chapters')
const artDir = path.join(root, 'public/art/chapters')

const chapterFiles = fs.readdirSync(chapterDir)
  .filter((name) => /^b\d+c\d+\.json$/.test(name))
  .sort()

const chapters = chapterFiles.map((name) => JSON.parse(fs.readFileSync(path.join(chapterDir, name), 'utf8')))
const ids = chapters.map((chapter) => chapter.id)
const idSet = new Set(ids)

let failed = false
const fail = (message) => {
  console.error(message)
  failed = true
}

if (ids.length !== manifest.target.totalChapters) {
  fail(`Chapter art manifest expects ${manifest.target.totalChapters} chapters but found ${ids.length}.`)
}

if (idSet.size !== ids.length) fail('Duplicate chapter ids found in chapter data.')

const approved = manifest.approved ?? []
for (const id of approved) {
  if (!idSet.has(id)) fail(`Approved chapter art id does not exist: ${id}`)
}

for (const id of Object.keys(manifest.ninoPolicyOverrides ?? {})) {
  if (!idSet.has(id)) fail(`Nino policy override references unknown chapter: ${id}`)
}

const rasterFiles = fs.existsSync(artDir)
  ? fs.readdirSync(artDir).filter((name) => /\.(?:webp|avif)$/i.test(name)).sort()
  : []

const assetIds = rasterFiles.map((name) => name.replace(/\.(?:webp|avif)$/i, ''))
const assetIdSet = new Set(assetIds)

for (const id of approved) {
  if (!assetIdSet.has(id)) fail(`Approved chapter art is missing its raster asset: ${id}`)
}

for (const id of assetIds) {
  if (!approved.includes(id)) {
    fail(`Unreviewed chapter raster is present in production assets: ${id}. Add it to approved only after visual QA.`)
  }
  if (!idSet.has(id)) fail(`Chapter raster has no matching chapter data: ${id}`)
}

const seenHashes = new Map()
for (const name of rasterFiles) {
  const bytes = fs.readFileSync(path.join(artDir, name))
  const hash = crypto.createHash('sha256').update(bytes).digest('hex')
  const prior = seenHashes.get(hash)
  if (prior) fail(`Exact duplicate chapter art detected: ${prior} and ${name}`)
  seenHashes.set(hash, name)
}

const pending = ids.filter((id) => !approved.includes(id))
if (approved.length + pending.length !== ids.length) {
  fail('Chapter art approved/pending accounting is inconsistent.')
}

if (failed) process.exit(1)
console.log(`Chapter art batch validation passed: ${approved.length} approved, ${pending.length} pending, ${ids.length} total.`)
