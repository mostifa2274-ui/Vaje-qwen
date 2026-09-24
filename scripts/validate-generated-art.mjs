import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = new URL('..', import.meta.url).pathname
const assets = {
  'b2c1.webp': {
    type: 'webp',
    sha256: '12e4cd0a3816bae06565fdfc0919cd01f6dce83df424ac878d70cb51fdea6b1a',
  },
  'b2c2.avif': {
    type: 'avif',
    sha256: '3bc4682c77077fe5acf5f7694c05d9728a64ca50bcae3f9f832393ceaae5a5b7',
  },
  'b2c5.avif': {
    type: 'avif',
    sha256: '3b5ea98b040be12851cbfd3bb9f92ee2e7daf2da77408c3dc568aa0909e72854',
  },
}

function matchesContainer(bytes, type) {
  if (type === 'webp') {
    return bytes.subarray(0, 4).toString('ascii') === 'RIFF'
      && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  }

  if (type === 'avif') {
    return bytes.subarray(4, 8).toString('ascii') === 'ftyp'
      && ['avif', 'avis'].includes(bytes.subarray(8, 12).toString('ascii'))
  }

  return false
}

let failed = false
for (const [name, expected] of Object.entries(assets)) {
  const file = path.join(root, 'public/art/chapters', name)
  if (!fs.existsSync(file)) {
    console.error(`Missing generated chapter art: ${name}`)
    failed = true
    continue
  }

  const bytes = fs.readFileSync(file)
  if (!matchesContainer(bytes, expected.type)) {
    console.error(`Generated chapter art has the wrong container: ${name} (expected ${expected.type})`)
    failed = true
  }

  const actualHash = crypto.createHash('sha256').update(bytes).digest('hex')
  if (actualHash !== expected.sha256) {
    console.error(`Generated chapter art hash mismatch: ${name}`)
    failed = true
  }

  if (bytes.length > 80_000) {
    console.error(`Generated chapter art exceeds the 80 KB mobile budget: ${name} (${bytes.length} bytes)`)
    failed = true
  }
}

if (failed) process.exit(1)
console.log(`Generated chapter art validation passed: ${Object.keys(assets).length} reviewed assets.`)
