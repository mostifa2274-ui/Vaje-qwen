import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import zlib from 'node:zlib'

const root = path.resolve(import.meta.dirname, '..')
const dir = path.join(root, 'bootstrap')
const expectedArchive = '7f648f6f5cc7cea8a198f6857fe01dedca546bf3e150de962d278e9d7a02fb99'
const expectedArchiveBytes = 159219
const expectedFiles = 97
const expectedParts = ["85e283e989acc028a82465a342a2d1e1115d38d6066553d897367ea55ae2a9e8", "e1bb79ecdf793dbd86241d7f61620e3a95a78a6e5e65f5d1295115cb42e91cb0", "3fe599daabbf417927904414972a9e6f97ae143210694a20e3b7481395b52298", "32a0029efded6ea2a2f25230fc0d48452aa9ca7fadcd0d5fe2a16834ef45ec34", "e5c72bfcccc7b08952fdd1a015f758d976efa55d7044b8b54f666906b23096c5", "3d0a5cf9f640143691cfc3acfc5538dc6582968816f37bbded749f8899f24c58", "9bb3059cf8f9d008cad9f84c573588425755b1f31c49b686cff6e1af71fa1f61", "f75c1df2f1439ba7495f7ec83e2bbcee2ceb2f135efb67cb71786a833755b8fa"]
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