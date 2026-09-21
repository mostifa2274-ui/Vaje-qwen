import { readFile, writeFile } from 'node:fs/promises'

const source = new URL('../public/release.json', import.meta.url)
const target = new URL('../dist/release.json', import.meta.url)
const base = JSON.parse(await readFile(source, 'utf8'))
const commit = process.env.WORKERS_CI_COMMIT_SHA || process.env.GITHUB_SHA || 'local'
const branch = process.env.WORKERS_CI_BRANCH || process.env.GITHUB_REF_NAME || 'local'

await writeFile(target, JSON.stringify({ ...base, commit, branch }, null, 2) + '\n', 'utf8')
console.log(`Stamped dist/release.json for ${commit} (${branch})`)
