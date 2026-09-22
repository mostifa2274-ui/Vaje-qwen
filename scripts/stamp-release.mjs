import { readFile, writeFile } from 'node:fs/promises'

const source = new URL('../public/release.json', import.meta.url)
const target = new URL('../dist/release.json', import.meta.url)
const serviceWorkerTarget = new URL('../dist/sw.js', import.meta.url)
const base = JSON.parse(await readFile(source, 'utf8'))
const commit = process.env.WORKERS_CI_COMMIT_SHA || process.env.GITHUB_SHA || 'local'
const branch = process.env.WORKERS_CI_BRANCH || process.env.GITHUB_REF_NAME || 'local'

await writeFile(target, JSON.stringify({ ...base, commit, branch }, null, 2) + '\n', 'utf8')

const rawServiceWorker = await readFile(serviceWorkerTarget, 'utf8')
const cacheTag = commit
  .replace(/[^a-zA-Z0-9_-]/g, '')
  .slice(0, 16) || 'local'
const placeholder = '__GHESSE_BUILD_CACHE__'
if (!rawServiceWorker.includes(placeholder)) {
  throw new Error('Service worker cache placeholder missing from dist/sw.js')
}
await writeFile(
  serviceWorkerTarget,
  rawServiceWorker.replaceAll(placeholder, cacheTag),
  'utf8',
)

console.log(`Stamped dist/release.json for ${commit} (${branch})`)
console.log(`Stamped dist/sw.js cache as ghesse-shell-${cacheTag}`)
