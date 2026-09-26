import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = new URL('..', import.meta.url).pathname
const assets = {
  'b1c1.avif': {
    type: 'avif',
    sha256: '9b889befef58d5d632f23cb10af3d9a8ad1a24a29f522bf07ae32daac38fc2b2',
  },
  'b1c2.webp': {
    type: 'webp',
    sha256: '5706db2ac61a0eff478a3bdba3fd32dc5cde2cd87741fe418c372e50049f4a34',
  },
  'b1c3.webp': {
    type: 'webp',
    sha256: 'c0968ab348e4b16f2d3046bc77ecdae0be2765678530197be32e812d3f7d5bb9',
  },
  'b1c4.webp': {
    type: 'webp',
    sha256: 'e75b3c184c349962e591ff10b4ad6ab90e4557cc1980010f89d85c0ceb4c601e',
  },
  'b1c5.webp': {
    type: 'webp',
    sha256: 'c0a97d69fbce6f4dfcdc9d7fa83474d08bee25b1f8f6acf320dd27a8497ea0c0',
  },
  'b2c3.webp': {
    type: 'webp',
    sha256: 'c18a2083293473edf0bcb7c2239b593f3dd7815b191e7e06efb7fbcd93be2c96',
  },
  'b3c4.webp': {
    type: 'webp',
    sha256: '46cf5b5ba9345a59f5fbb32b871580614da59d062cb92f5d3dd1f58017c424ae',
  },
  'b3c3.webp': {
    type: 'webp',
    sha256: '07d46568fd42a5fd90077b242014b44e3645de709fcb375b681ddbd4d2016a71',
  },
  'b3c2.webp': {
    type: 'webp',
    sha256: 'e0ea1c615c44c0f41d1b13a8998e98bd9375baa0a1f6d25472572411b898e895',
  },
  'b2c1.webp': {
    type: 'webp',
    sha256: '12e4cd0a3816bae06565fdfc0919cd01f6dce83df424ac878d70cb51fdea6b1a',
  },
  'b2c2.avif': {
    type: 'avif',
    sha256: '3bc4682c77077fe5acf5f7694c05d9728a64ca50bcae3f9f832393ceaae5a5b7',
  },
  'b4c1.webp': {
    type: 'webp',
    sha256: 'a69eaf407e30008997b5636fb1acb0041e9cd61b3fd7c7f6157b5c19c44f1e00',
  },
  'b4c5.webp': {
    type: 'webp',
    sha256: 'c0ff7b377cec762a87c024441ef47ecf5e9ebceacd27e2724fb68678ded7cc6b',
  },
  'b5c1.webp': {
    type: 'webp',
    sha256: '560a9873984fe584d764639ee0f8f7bbaeb4dcf9f3da9f4a59e9da9beabb1ecc',
  },
  'b5c2.webp': {
    type: 'webp',
    sha256: '29839ea91cc7b36db8f736bb42582b1e834d10be8280b8750ec596d84df1d1aa',
  },
  'b7c1.webp': {
    type: 'webp',
    sha256: 'a11f2560a05a96bd786e3f1766a32f559dbd04ab88f7e40f040d63af1677dd03',
  },
  'b7c2.webp': {
    type: 'webp',
    sha256: '6eaed484bb740740031d0a9f1dbbed420f70a542ba0ff65b669b657bf786ce56',
  },
  'b8c6.avif': {
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
