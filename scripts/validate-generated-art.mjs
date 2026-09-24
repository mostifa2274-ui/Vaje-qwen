import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = new URL('..', import.meta.url).pathname
const assets = {
  'b2c1.webp': '12e4cd0a3816bae06565fdfc0919cd01f6dce83df424ac878d70cb51fdea6b1a',
}

let failed = false
for (const [name, expectedHash] of Object.entries(assets)) {
  const file = path.join(root, 'public/art/chapters', name)
  if (!fs.existsSync(file)) {
    console.error(`Missing generated chapter art: ${name}`)
    failed = true
    continue
  }

  const bytes = fs.readFileSync(file)
  const header = bytes.subarray(0, 12)
  const isWebp = header.subarray(0, 4).toString('ascii') === 'RIFF'
    && header.subarray(8, 12).toString('ascii') === 'WEBP'
  if (!isWebp) {
    console.error(`Generated chapter art is not a valid WebP container: ${name}`)
    failed = true
  }

  const actualHash = crypto.createHash('sha256').update(bytes).digest('hex')
  if (actualHash !== expectedHash) {
    console.error(`Generated chapter art hash mismatch: ${name}`)
    failed = true
  }

  if (bytes.length > 80_000) {
    console.error(`Generated chapter art exceeds the 80 KB mobile budget: ${name} (${bytes.length} bytes)`)
    failed = true
  }
}

if (failed) process.exit(1)
console.log(`Generated chapter art validation passed: ${Object.keys(assets).length} reviewed WebP asset.`)
