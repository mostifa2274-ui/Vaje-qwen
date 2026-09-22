import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const directWorkflow = readFileSync(join(root, '.github/workflows/deploy-production.yml'), 'utf8')

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

const allowed = spawnSync(process.execPath, [gatePath], {
  cwd: root,
  env: { ...process.env, GHESSE_RIGHTS_CONFIRMED: '1' },
  encoding: 'utf8',
})
assert(allowed.status === 0, 'release gate must pass with GHESSE_RIGHTS_CONFIRMED=1')

console.log('Release configuration validated: public deploy is fail-closed and both deployment paths enforce the rights gate.')
