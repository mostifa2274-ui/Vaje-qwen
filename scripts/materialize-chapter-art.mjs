import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = new URL('..', import.meta.url).pathname
const partFiles = [
  'src/art/encoded/b1c1.part1.b64',
  'src/art/encoded/b1c1.part2.b64',
]
const target = path.join(root, 'public/art/chapters/b1c1.avif')
const expectedSha256 = '9b889befef58d5d632f23cb10af3d9a8ad1a24a29f522bf07ae32daac38fc2b2'
const expectedBytes = 12_100

const base64 = partFiles
  .map((file) => fs.readFileSync(path.join(root, file), 'utf8').trim())
  .join('')

const bytes = Buffer.from(base64, 'base64')
const actualSha256 = crypto.createHash('sha256').update(bytes).digest('hex')

if (bytes.length !== expectedBytes) {
  throw new Error(`b1c1 artwork byte length mismatch: expected ${expectedBytes}, got ${bytes.length}`)
}
if (actualSha256 !== expectedSha256) {
  throw new Error(`b1c1 artwork SHA-256 mismatch: expected ${expectedSha256}, got ${actualSha256}`)
}

fs.mkdirSync(path.dirname(target), { recursive: true })
if (!fs.existsSync(target) || crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex') !== expectedSha256) {
  fs.writeFileSync(target, bytes)
}

console.log(`Materialized b1c1 chapter art: ${bytes.length} bytes, sha256 ${actualSha256}`)
