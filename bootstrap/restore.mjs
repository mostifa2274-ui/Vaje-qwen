import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import zlib from 'node:zlib'

const root = path.resolve(import.meta.dirname, '..')
const dir = path.join(root, 'bootstrap')
const expectedArchive = '0113987b0c4a1da295e0732e5a1a38d8560d049d77400b1e785caecb13985bf3'
const expectedArchiveBytes = 159412
const expectedFiles = 97
const expectedParts = ["53907eb28b0e8738df058fc13117981c370868c557933d1f0e1cabbf48dbc64a", "57764ff843020f95a89aab3fbff6af2f639efb24dd102f897d4a4b06f54787f7", "86afd57faccc7768a38ae1d0cf03b61bb7272e714689c77d5ec23e5ddf85254f", "08827b40137811705db3faa2aedf68ae7b460bb7bcc73b5653449a99fef54397", "76a2311b8edddf626905c30d8cd00bf1d6ba400a1b3ced07a4cd42751ad81145", "aa24503f07b3e4566049108cd6f8b2b7b2bc3872550cbc9c42948ca75035d4a7", "7355e28e841addfceeac161a46894fa09d7bf873d6397246ccc9b802e040161f", "70bc10cf8ea6ad444e4d33bf54c0fe8748ae2a6f9028dfcfd9ea2e1df2b4468b"]
const sha = (data) => crypto.createHash('sha256').update(data).digest('hex')

const encoded = expectedParts.map((expected, i) => {
  const name = `ghesse-${String(i).padStart(2, '0')}.b64`
  const data = fs.readFileSync(path.join(dir, name), 'utf8').trim()
  const got = sha(data)
  if (got !== expected) throw new Error(`${name} checksum mismatch: ${got}`)
  return data
}).join('')

const archive = Buffer.from(encoded, 'base64')
if (archive.length !== expectedArchiveBytes) throw new Error(`payload size mismatch: ${archive.length}`)
const gotArchive = sha(archive)
if (gotArchive !== expectedArchive) throw new Error(`payload checksum mismatch: ${gotArchive}`)
const tar = zlib.brotliDecompressSync(archive)

const readString = (buf, start, len) => { const s=buf.subarray(start,start+len); const end=s.indexOf(0); return s.subarray(0,end<0?s.length:end).toString('utf8') }
const readOctal = (buf, start, len) => { const v=readString(buf,start,len).replace(/\0/g,'').trim(); return v?Number.parseInt(v,8):0 }
const safe = (name) => {
  const n=path.posix.normalize(name.replace(/^\.\//,'').replace(/\\/g,'/'))
  if (!n || n==='.') return null
  if (n.startsWith('/') || n==='..' || n.startsWith('../')) throw new Error(`unsafe path: ${name}`)
  return n
}

for (const rel of ['src','public','scripts']) fs.rmSync(path.join(root, rel), { recursive: true, force: true })
for (const rel of ['index.html','eslint.config.js','postcss.config.js','tailwind.config.js','tsconfig.json','tsconfig.app.json','tsconfig.node.json','vite.config.ts','package-lock.json']) fs.rmSync(path.join(root, rel), { force: true })

let offset=0, files=0
while (offset+512<=tar.length) {
  const h=tar.subarray(offset,offset+512)
  if (h.every((b)=>b===0)) break
  const name=readString(h,0,100), prefix=readString(h,345,155)
  const rel=safe(prefix?`${prefix}/${name}`:name)
  const size=readOctal(h,124,12), type=String.fromCharCode(h[156]||48)
  offset+=512
  if (rel) {
    const dest=path.join(root,...rel.split('/'))
    if (!dest.startsWith(root+path.sep)) throw new Error(`unsafe destination: ${rel}`)
    if (type==='5') fs.mkdirSync(dest,{recursive:true})
    else if (type==='0' || type==='\0') { fs.mkdirSync(path.dirname(dest),{recursive:true}); fs.writeFileSync(dest,tar.subarray(offset,offset+size)); files++ }
    else throw new Error(`unsupported tar entry ${type}: ${rel}`)
  }
  offset += Math.ceil(size/512)*512
}
if (files !== expectedFiles) throw new Error(`restore incomplete: expected ${expectedFiles} files, wrote ${files}`)
console.log(`Ghesse 5.0 source restored and SHA-256 verified (${files} files).`)