import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { readReleaseEvidence, verifyReleaseEvidence } from './release-gate.mjs'

const root = new URL('..', import.meta.url).pathname
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const directWorkflow = readFileSync(join(root, '.github/workflows/deploy-production.yml'), 'utf8')
const rightsManifest = JSON.parse(readFileSync(join(root, 'provenance/release-rights.json'), 'utf8'))
const vocabularyBytes = readFileSync(join(root, 'src/data/vocabulary.json'))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(
  pkg.scripts?.['cloudflare:build']?.includes('npm run release:check'),
  'cloudflare:build must enforce npm run release:check before public build',
)
assert(
  pkg.scripts?.deploy?.includes('npm run cloudflare:build'),
  'deploy must pass through cloudflare:build so the release gate cannot be bypassed',
)
assert(
  directWorkflow.includes('GHESSE_RIGHTS_CONFIRMED'),
  'direct Cloudflare workflow must receive GHESSE_RIGHTS_CONFIRMED from Actions secrets',
)
assert(
  directWorkflow.includes('npm run release:check'),
  'direct Cloudflare workflow must enforce release:check before Wrangler deploy',
)

assert(rightsManifest.schemaVersion === 1, 'release-rights manifest schemaVersion must be 1')
assert(
  ['blocked', 'cleared'].includes(rightsManifest.status),
  'release-rights manifest status must be blocked or cleared',
)
assert(
  rightsManifest.activeVocabulary === 'src/data/vocabulary.json',
  'release-rights manifest must bind the active vocabulary path',
)

const gatePath = join(root, 'scripts', 'release-gate.mjs')

const deniedEnv = { ...process.env }
delete deniedEnv.GHESSE_RIGHTS_CONFIRMED
const denied = spawnSync(process.execPath, [gatePath], {
  cwd: root,
  env: deniedEnv,
  encoding: 'utf8',
})
assert(denied.status !== 0, 'release gate must fail without GHESSE_RIGHTS_CONFIRMED=1')
assert(
  `${denied.stdout}\n${denied.stderr}`.includes('PUBLIC RELEASE BLOCKED'),
  'release gate denial must explain that public release is blocked',
)

const envOnly = spawnSync(process.execPath, [gatePath], {
  cwd: root,
  env: { ...process.env, GHESSE_RIGHTS_CONFIRMED: '1' },
  encoding: 'utf8',
})
if (rightsManifest.status === 'blocked') {
  assert(
    envOnly.status !== 0,
    'GHESSE_RIGHTS_CONFIRMED=1 alone must not bypass a blocked provenance manifest',
  )
}

const vocabularySha256 = createHash('sha256').update(vocabularyBytes).digest('hex')
const syntheticCleared = {
  schemaVersion: 1,
  status: 'cleared',
  activeVocabulary: 'src/data/vocabulary.json',
  activeVocabularySha256: vocabularySha256,
  basis: 'independent-reconstruction',
  sources: [{
    name: 'Synthetic validator evidence',
    url: 'https://example.invalid/provenance-test',
    license: 'CC0-1.0',
  }],
  clearedAt: '2026-01-01T00:00:00.000Z',
}

const positive = verifyReleaseEvidence({
  confirmed: true,
  manifest: syntheticCleared,
  vocabularyBytes,
})
assert(positive.ok, `synthetic cleared evidence should verify: ${positive.errors.join('; ')}`)

const staleHash = verifyReleaseEvidence({
  confirmed: true,
  manifest: { ...syntheticCleared, activeVocabularySha256: '0'.repeat(64) },
  vocabularyBytes,
})
assert(!staleHash.ok, 'stale vocabulary evidence must fail verification')

const missingSource = verifyReleaseEvidence({
  confirmed: true,
  manifest: { ...syntheticCleared, sources: [] },
  vocabularyBytes,
})
assert(!missingSource.ok, 'cleared evidence without retained source/license evidence must fail')

const evidence = readReleaseEvidence()
assert(
  Buffer.compare(evidence.vocabularyBytes, vocabularyBytes) === 0,
  'release-gate evidence reader must read the active vocabulary bytes',
)

console.log('Release configuration validated: public deploy is evidence-bound, hash-bound, and fail-closed.')
