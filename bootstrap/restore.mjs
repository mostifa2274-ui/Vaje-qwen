import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import zlib from 'node:zlib'

const root = path.resolve(import.meta.dirname, '..')
const dir = path.join(root, 'bootstrap')
const expectedArchive = 'cf4d295003d75307d6c904d60333e710553d4e1fb5ccc20aceab385a492a6487'
const expectedParts = [
  '5fae3bae2b68fcb760412276ec688073b1db73b697c090d24a3eac754d95e907',
  '288f3e4c14648e51c97b0e079c63c647cdc930315e451974f7efda6b92e80a8a',
  '9103926288bb3a69832a060a81f11ad2ff26f424a86cc3d9ff121807670df551',
  '8e264306e49ad10d228ce365fd20183a0bba4074ca016a81b16d646bcc847bf1',
  'cdb899ea2610cdebcef5ce8683d4041fdffc076130cb6c603f35fe07a802c7ae',
  '73c782f80997733155d829423003738ff7e02ddd723d653758d87d7887fb0aed',
  '8569959e9c48e8c4a4201b5fd647585c86aaecf78bf022f1a114d4ebad64f302',
  '804e717bcc18dbb31bb6c44dc915aaba8a071120215cdc86e480d0a66d26ec97',
  'dbac5a00c2b8376eeec270df8678582cdaa3ab6448060222c053fc8f5a10dda7',
  'e628fb2818d92d97a2bb42753ed04ca7202a569f0ae74050c11972a3cf7157a4'
]

const sha = (data) => crypto.createHash('sha256').update(data).digest('hex')
const parts = expectedParts.map((expected, i) => {
  const name = `part-${String(i).padStart(2, '0')}.b64`
  const data = fs.readFileSync(path.join(dir, name), 'utf8').trim()
  const got = sha(data)
  if (got !== expected) throw new Error(`${name} checksum mismatch: ${got}`)
  return data
})

const archive = Buffer.from(parts.join(''), 'base64')
const gotArchive = sha(archive)
if (gotArchive !== expectedArchive) throw new Error(`payload checksum mismatch: ${gotArchive}`)
const tar = zlib.gunzipSync(archive)

const readString = (buf, start, len) => {
  const s = buf.subarray(start, start + len)
  const end = s.indexOf(0)
  return s.subarray(0, end < 0 ? s.length : end).toString('utf8')
}
const readOctal = (buf, start, len) => {
  const v = readString(buf, start, len).replace(/\0/g, '').trim()
  return v ? Number.parseInt(v, 8) : 0
}
const safe = (name) => {
  const n = path.posix.normalize(name.replace(/^\.\//, '').replace(/\\/g, '/'))
  if (!n || n === '.') return null
  if (n.startsWith('/') || n === '..' || n.startsWith('../')) throw new Error(`unsafe path: ${name}`)
  return n
}

let offset = 0
let files = 0
while (offset + 512 <= tar.length) {
  const h = tar.subarray(offset, offset + 512)
  if (h.every((b) => b === 0)) break
  const name = readString(h, 0, 100)
  const prefix = readString(h, 345, 155)
  const rel = safe(prefix ? `${prefix}/${name}` : name)
  const size = readOctal(h, 124, 12)
  const type = String.fromCharCode(h[156] || 48)
  offset += 512
  if (rel) {
    const dest = path.join(root, ...rel.split('/'))
    if (type === '5') fs.mkdirSync(dest, { recursive: true })
    else if (type === '0' || type === '\0') {
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.writeFileSync(dest, tar.subarray(offset, offset + size))
      files++
    } else throw new Error(`unsupported tar entry ${type}: ${rel}`)
  }
  offset += Math.ceil(size / 512) * 512
}
if (files < 25) throw new Error(`restore incomplete: only ${files} files`)

const replaceOnce = (rel, from, to) => {
  const target = path.join(root, rel)
  const source = fs.readFileSync(target, 'utf8')
  const first = source.indexOf(from)
  if (first < 0 || source.indexOf(from, first + from.length) >= 0) {
    throw new Error(`expected exactly one fixup site in ${rel}`)
  }
  fs.writeFileSync(target, source.replace(from, to))
}

replaceOnce(
  'src/screens/Progress.tsx',
  `  // donut segments, in mastery order
  let offset = 0
  const segments = MASTERY_ORDER.map((level) => {
    const fraction = counts[level] / VOCABULARY.length
    const seg = { level, fraction, offset }
    offset += fraction
    return seg
  })`,
  `  // donut segments, in mastery order
  const segments = MASTERY_ORDER.map((level, index) => {
    const fraction = counts[level] / VOCABULARY.length
    const offset = MASTERY_ORDER.slice(0, index).reduce(
      (sum, prior) => sum + counts[prior] / VOCABULARY.length,
      0
    )
    return { level, fraction, offset }
  })`
)

replaceOnce(
  'src/screens/Settings.tsx',
  `  useEffect(() => {
    void refreshAudio()
    return () => downloadAbortRef.current?.abort()
  }, [refreshAudio])`,
  `  useEffect(() => {
    let active = true
    void offlineAudioStatus(VOCABULARY).then((next) => {
      if (active) setAudioStatus(next)
    })
    return () => {
      active = false
      downloadAbortRef.current?.abort()
    }
  }, [])`
)

const eslintPath = path.join(root, 'eslint.config.js')
const eslintSource = fs.readFileSync(eslintPath, 'utf8')
const eslintEnd = `  }
])
`
if (!eslintSource.endsWith(eslintEnd)) throw new Error('unexpected eslint config shape')
fs.writeFileSync(
  eslintPath,
  eslintSource.slice(0, -eslintEnd.length) +
    `  },
  {
    files: ['src/state/app.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' }
  }
])
`
)

const cssPath = path.join(root, 'src/index.css')
let css = fs.readFileSync(cssPath, 'utf8')
const fontStart = css.indexOf('/* ——— fonts ——— */')
const tokenStart = css.indexOf('/* ——— tokens ——— */')
if (fontStart < 0 || tokenStart <= fontStart) throw new Error('unexpected font CSS shape')
css = css.slice(0, fontStart) +
  `/* ——— deployment font stack — bundled font files are omitted from the compact Git transport ——— */
` +
  css.slice(tokenStart)
css = css
  .replace("--font-fa: 'Vazirmatn', 'Tahoma', sans-serif;", "--font-fa: Tahoma, 'Noto Sans Arabic', Arial, sans-serif;")
  .replace("--font-en: 'Hanken Grotesk', 'Vazirmatn', sans-serif;", "--font-en: Inter, 'Segoe UI', Arial, sans-serif;")
fs.writeFileSync(cssPath, css)

console.log(`Vajeh source restored, verified and hardened (${files} files).`)
