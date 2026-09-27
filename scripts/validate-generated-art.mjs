import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = new URL('..', import.meta.url).pathname
const assets = {
  'b2c5.webp': {
    type: 'webp',
    sha256: 'dba58216f8fbdf38e3426636f1cbf209ce74fbda99f7a7dc5d0e4eeaec9d8d25',
  },
  'b3c1.webp': {
    type: 'webp',
    sha256: '189592526fe66c96c667bdda0e2ed7ae8d7bfa35922025e03b4294fa30074359',
  },
  'b3c5.webp': {
    type: 'webp',
    sha256: '582bf5656a97949605518981242868effb7c5b5cfb1c4d2a1c6ad7bd6d2fd7bf',
  },
  'b5c4.webp': {
    type: 'webp',
    sha256: 'c6f7ff3adc2acf706515bf19d7679d68b27874aef80ef3446b190b9ff891da37',
  },
  'b6c3.webp': {
    type: 'webp',
    sha256: '3bf781a0e7816fa081c92541824dd96931ed9c253e25915f9e796296d4decf03',
  },
  'b6c4.webp': {
    type: 'webp',
    sha256: '1d6e3bd7f27f8e84633eefc3eb1906d231101025d5ec73743f9f86255a17d5d1',
  },
  'b7c4.webp': {
    type: 'webp',
    sha256: 'c672fae5344f6bd4224f9789ec7cf97433c334056b4ca19c043fd609b130b092',
  },
  'b7c5.webp': {
    type: 'webp',
    sha256: 'fdc0c82b03a27d76c6ef3075cdbf1cb20f68339ddb7989d4faacf720e9462d02',
  },
  'b8c1.webp': {
    type: 'webp',
    sha256: '585663ee57eced82608838794e06701365bef2470f0891b0b3625f9240e812f8',
  },
  'b8c2.webp': {
    type: 'webp',
    sha256: '940108358664b5d85d061a19ba1e0ca4eff80c4d1edaa47d1024f642d355def4',
  },
  'b8c3.webp': {
    type: 'webp',
    sha256: '9e3a6f07f96f404e44df22d08d4e3583b9b83b85aed1652ff13adf2641ff0cc1',
  },
  'b8c4.webp': {
    type: 'webp',
    sha256: '78c5c93d388827a408e1f6cde358a02c2c755125bda10138ea451957dd150633',
  },
  'b8c5.webp': {
    type: 'webp',
    sha256: '444e514b60208c481e81b175601159c90d618ed9b549bda207e9a18bc1065228',
  },
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
  'b2c4.webp': {
    type: 'webp',
    sha256: 'f5b497e0f34b75c41ac99bdcae77d0ee69e133e3b223fac0d3a38fdd6349cc56',
  },
  'b4c3.webp': {
    type: 'webp',
    sha256: 'ae09a984f5dd9380d399bcda8cd330064c2fafce8f6251a1f138a504cfeab146',
  },
  'b3c6.webp': {
    type: 'webp',
    sha256: '77b3db74f071b3946da19529a2e93a29e3cdbb6c78630314dd2b8001e80c9cfd',
  },
  'b4c1.webp': {
    type: 'webp',
    sha256: 'a69eaf407e30008997b5636fb1acb0041e9cd61b3fd7c7f6157b5c19c44f1e00',
  },
  'b4c2.webp': {
    type: 'webp',
    sha256: '89490969e8a1949eb1a0985421157d546bd5b7ff455b1c7479d557f70a1e8a41',
  },
  'b4c4.webp': {
    type: 'webp',
    sha256: 'b0f1c0f29ecd08dd774df0aa556732985af7fa0fe01ca68fc001c0305a6dbfcc',
  },
  'b5c3.webp': {
    type: 'webp',
    sha256: '33435725e15c20973d881e6c30109d9af8b5858f79849be43d5a4901519e7c81',
  },
  'b6c2.webp': {
    type: 'webp',
    sha256: '330d5637416fceb61dc63ae10fe1f91d86b7a44cb95e645932c84ebc82d1c53d',
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
  'b6c1.webp': {
    type: 'webp',
    sha256: '161d7c9eb497018609fa5d8a73c832fcc89d7b8bb1dc7a3465ca1b7874139642',
  },
  'b7c3.webp': {
    type: 'webp',
    sha256: 'f13bd6ef7e3a76390463f023447080b4a6826d229e8329c4d7b0a316afbb67e0',
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

