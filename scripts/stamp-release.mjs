import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = new URL('../public/release.json', import.meta.url)
const target = new URL('../dist/release.json', import.meta.url)
const serviceWorkerTarget = new URL('../dist/sw.js', import.meta.url)
const distDir = dirname(fileURLToPath(target))
const assetsDir = join(distDir, 'assets')
const base = JSON.parse(await readFile(source, 'utf8'))
const commit = process.env.WORKERS_CI_COMMIT_SHA || process.env.GITHUB_SHA || 'local'
const branch = process.env.WORKERS_CI_BRANCH || process.env.GITHUB_REF_NAME || 'local'

await writeFile(target, JSON.stringify({ ...base, commit, branch }, null, 2) + '\n', 'utf8')

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await collectFiles(fullPath))
    else if (entry.isFile()) files.push(fullPath)
  }
  return files
}

const rawServiceWorker = await readFile(serviceWorkerTarget, 'utf8')
const cacheTag = commit
  .replace(/[^a-zA-Z0-9_-]/g, '')
  .slice(0, 16) || 'local'
const cachePlaceholder = '__GHESSE_BUILD_CACHE__'
const assetsPlaceholder = '__GHESSE_BUILD_ASSETS__'

if (rawServiceWorker.split(cachePlaceholder).length !== 2) {
  throw new Error('Service worker cache placeholder missing or duplicated in dist/sw.js')
}
if (rawServiceWorker.split(assetsPlaceholder).length !== 2) {
  throw new Error('Service worker build-assets placeholder missing or duplicated in dist/sw.js')
}

const buildAssets = (await collectFiles(assetsDir))
  .map(file => `./${relative(distDir, file).split(sep).join('/')}`)
  .sort()

if (buildAssets.length === 0) {
  throw new Error('No generated Vite assets found for offline precaching')
}

const stampedServiceWorker = rawServiceWorker
  .replace(cachePlaceholder, cacheTag)
  .replace(assetsPlaceholder, () => JSON.stringify(buildAssets))

await writeFile(serviceWorkerTarget, stampedServiceWorker, 'utf8')

console.log(`Stamped dist/release.json for ${commit} (${branch})`)
console.log(`Stamped dist/sw.js cache as ghesse-shell-${cacheTag}`)
console.log(`Stamped ${buildAssets.length} generated assets for offline precaching`)
