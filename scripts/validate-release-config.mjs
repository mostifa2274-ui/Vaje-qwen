import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const directWorkflow = readFileSync(join(root, '.github/workflows/deploy-production.yml'), 'utf8')
const manifest = JSON.parse(readFileSync(join(root, 'provenance/release-rights.json'), 'utf8'))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(pkg.scripts?.['cloudflare:build'] === 'npm run check', 'Cloudflare build must run quality checks')
assert(pkg.scripts?.check?.includes('npm run build'), 'quality checks must create dist for Wrangler')
assert(pkg.scripts?.deploy?.includes('npm run cloudflare:build'), 'deploy must build before Wrangler')
assert(
  directWorkflow.includes('npm run build') && directWorkflow.includes('npx wrangler@4.135.0 deploy'),
  'the direct workflow must build before deploying',
)
assert(!pkg.scripts?.['release:check'], 'obsolete content-rights deployment gate must be removed')
assert(!directWorkflow.includes('GHESSE_RIGHTS_CONFIRMED'), 'direct workflow must not require the old rights flag')
assert(manifest.schemaVersion === 1, 'provenance record schemaVersion must be 1')
assert(['blocked', 'cleared'].includes(manifest.status), 'provenance status must remain explicit')
assert(manifest.activeVocabulary === 'src/data/vocabulary.json', 'record must identify the active deck')
console.log(`Deployment configuration validated; provenance status is ${manifest.status} and is not a build gate.`)
