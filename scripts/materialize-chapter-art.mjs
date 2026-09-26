import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = new URL('..', import.meta.url).pathname
const artDir = path.join(root, 'public/art/chapters')

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function writeVerified(name, bytes, expectedSha256) {
  const actual = sha256(bytes)
  if (actual !== expectedSha256) {
    throw new Error(`${name} artwork SHA-256 mismatch: expected ${expectedSha256}, got ${actual}`)
  }

  fs.mkdirSync(artDir, { recursive: true })
  const target = path.join(artDir, name)
  if (!fs.existsSync(target) || sha256(fs.readFileSync(target)) !== expectedSha256) {
    fs.writeFileSync(target, bytes)
  }

  console.log(`Materialized ${name}: ${bytes.length} bytes, sha256 ${actual}`)
}

// b1c1 — existing reviewed source.
{
  const partFiles = [
    'src/art/encoded/b1c1.part1.b64',
    'src/art/encoded/b1c1.part2.b64',
  ]
  const base64 = partFiles
    .map((file) => fs.readFileSync(path.join(root, file), 'utf8').trim())
    .join('')
  const bytes = Buffer.from(base64, 'base64')
  const expectedBytes = 12_100
  const expectedSha256 = '9b889befef58d5d632f23cb10af3d9a8ad1a24a29f522bf07ae32daac38fc2b2'

  if (bytes.length !== expectedBytes) {
    throw new Error(`b1c1 artwork byte length mismatch: expected ${expectedBytes}, got ${bytes.length}`)
  }
  writeVerified('b1c1.avif', bytes, expectedSha256)
}

// Six reviewed missing-Nino chapter scenes, packed once to keep the repository compact.
{
  const payloadBase64 = fs.readFileSync(path.join(root, 'src/art/encoded/batch6/payload.b64'), 'utf8').trim()
  const payload = Buffer.from(payloadBase64, 'base64')
  const expectedBytes = 127_956
  const expectedSha256 = '07015a6deaa0e626217bcf8eeec294c47961a216bf05a565ba506cc9981b1291'

  if (payload.length !== expectedBytes) {
    throw new Error(`batch6 artwork payload byte length mismatch: expected ${expectedBytes}, got ${payload.length}`)
  }
  const actualPayloadSha = sha256(payload)
  if (actualPayloadSha !== expectedSha256) {
    throw new Error(`batch6 artwork payload SHA-256 mismatch: expected ${expectedSha256}, got ${actualPayloadSha}`)
  }

  const assets = [
    { name: 'b1c2.webp', offset: 0, size: 20_170, sha256: '5706db2ac61a0eff478a3bdba3fd32dc5cde2cd87741fe418c372e50049f4a34' },
    { name: 'b1c3.webp', offset: 20_170, size: 17_088, sha256: 'c0968ab348e4b16f2d3046bc77ecdae0be2765678530197be32e812d3f7d5bb9' },
    { name: 'b1c4.webp', offset: 37_258, size: 24_362, sha256: 'e75b3c184c349962e591ff10b4ad6ab90e4557cc1980010f89d85c0ceb4c601e' },
    { name: 'b1c5.webp', offset: 61_620, size: 18_566, sha256: 'c0a97d69fbce6f4dfcdc9d7fa83474d08bee25b1f8f6acf320dd27a8497ea0c0' },
    { name: 'b2c3.webp', offset: 80_186, size: 24_992, sha256: 'c18a2083293473edf0bcb7c2239b593f3dd7815b191e7e06efb7fbcd93be2c96' },
    { name: 'b3c2.webp', offset: 105_178, size: 22_778, sha256: 'e0ea1c615c44c0f41d1b13a8998e98bd9375baa0a1f6d25472572411b898e895' },
  ]

  for (const asset of assets) {
    const bytes = payload.subarray(asset.offset, asset.offset + asset.size)
    if (bytes.length !== asset.size) {
      throw new Error(`${asset.name} artwork slice length mismatch: expected ${asset.size}, got ${bytes.length}`)
    }
    writeVerified(asset.name, bytes, asset.sha256)
  }
}


// b4c5 — reviewed Golden Chicken lookalike scene.
{
  const partFiles = [
    'src/art/encoded/b4c5.part1.b64',
    'src/art/encoded/b4c5.part2a.b64',
    'src/art/encoded/b4c5.part2b.b64',
    'src/art/encoded/b4c5.part2c.b64',
    'src/art/encoded/b4c5.part2d.b64',
    'src/art/encoded/b4c5.part3.b64',
    'src/art/encoded/b4c5.part4.b64',
  ]
  const base64 = partFiles
    .map((file) => fs.readFileSync(path.join(root, file), 'utf8').trim())
    .join('')
  const bytes = Buffer.from(base64, 'base64')
  const expectedBytes = 56_660
  const expectedSha256 = 'c0ff7b377cec762a87c024441ef47ecf5e9ebceacd27e2724fb68678ded7cc6b'

  if (bytes.length !== expectedBytes) {
    throw new Error(`b4c5 artwork byte length mismatch: expected ${expectedBytes}, got ${bytes.length}`)
  }
  writeVerified('b4c5.webp', bytes, expectedSha256)
}


// b7c1 — reviewed Trip packing scene.
{
  const partFiles = [
    'src/art/encoded/b7c1.part1.b64',
    'src/art/encoded/b7c1.part2.b64',
    'src/art/encoded/b7c1.part3.b64',
  ]
  const base64 = partFiles
    .map((file) => fs.readFileSync(path.join(root, file), 'utf8').trim())
    .join('')
  const bytes = Buffer.from(base64, 'base64')
  const expectedBytes = 30_498
  const expectedSha256 = '03abc25bd1c770bb86ccca15347b5a33f8950706a4bdd53b1dc2da124be3b836'

  if (bytes.length !== expectedBytes) {
    throw new Error(`b7c1 artwork byte length mismatch: expected ${expectedBytes}, got ${bytes.length}`)
  }
  writeVerified('b7c1.webp', bytes, expectedSha256)
}
