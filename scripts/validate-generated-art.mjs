import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = new URL('..', import.meta.url).pathname
const chaptersDir = path.join(root, 'src/data/chapters')
const artDir = path.join(root, 'public/art/chapters')
const manifestPath = path.join(root, 'src/data/chapterArt.json')

const chapterIds = fs.readdirSync(chaptersDir)
  .filter(name => /^b\\d+c\\d+\\.json$/.test(name))
  .map(name => name.replace(/\\.json$/, ''))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
let failed = false

if (chapterIds.length !== 40) {
  console.error(`Expected 40 story chapters, found ${chapterIds.length}.`)
  failed = true
}

const manifestIds = Object.keys(manifest).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
const missingEntries = chapterIds.filter(id => !manifest[id])
const extraEntries = manifestIds.filter(id => !chapterIds.includes(id))

if (missingEntries.length) {
  console.error(`Missing cinematic chapter-art manifest entries: ${missingEntries.join(', ')}`)
  failed = true
}
if (extraEntries.length) {
  console.error(`Unknown chapter-art manifest entries: ${extraEntries.join(', ')}`)
  failed = true
}

for (const id of chapterIds) {
  const entry = manifest[id]
  if (!entry) continue

  const src = String(entry.src || '')
  if (!/^art\/chapters\/[a-z0-9-]+\.(?:webp|avif)$/.test(src)) {
    console.error(`Invalid cinematic art path for ${id}: ${src}`)
    failed = true
    continue
  }

  const file = path.join(root, 'public', src)
  if (!fs.existsSync(file)) {
    console.error(`Missing cinematic chapter art for ${id}: ${src}`)
    failed = true
    continue
  }

  const bytes = fs.readFileSync(file)
  const isWebp = bytes.subarray(0, 4).toString('ascii') === 'RIFF'
    && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  const isAvif = bytes.subarray(4, 8).toString('ascii') === 'ftyp'
    && ['avif', 'avis'].includes(bytes.subarray(8, 12).toString('ascii'))

  if (!isWebp && !isAvif) {
    console.error(`Wrong image container for ${id}: ${src}`)
    failed = true
  }

  if (bytes.length > 180_000) {
    console.error(`Cinematic art exceeds 180 KB mobile budget for ${id}: ${bytes.length} bytes`)
    failed = true
  }

  if (!entry.altFa || !entry.altEn) {
    console.error(`Missing bilingual alt text for ${id}`)
    failed = true
  }

  if (!Number.isInteger(entry.width) || !Number.isInteger(entry.height) || entry.width < 600 || entry.height < 300) {
    console.error(`Invalid dimensions for ${id}: ${entry.width}x${entry.height}`)
    failed = true
  }

  if (entry.sha256) {
    const actualHash = crypto.createHash('sha256').update(bytes).digest('hex')
    if (actualHash !== entry.sha256) {
      console.error(`Cinematic art hash mismatch for ${id}`)
      failed = true
    }
  }
}

if (failed) process.exit(1)
console.log(`Cinematic chapter art validation passed: ${chapterIds.length}/40 chapters have reviewed raster assets.`)
