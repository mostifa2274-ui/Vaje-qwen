import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const status = JSON.parse(readFileSync(join(root, 'research/status.json'), 'utf8'))
const protocol = readFileSync(join(root, 'research/VALIDATION_PROTOCOL.md'), 'utf8')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(status.schemaVersion === 1, 'research status schemaVersion must be 1')
assert(
  ['protocol-ready-not-run', 'pilot-running', 'validated'].includes(status.status),
  'research status must explicitly describe evidence state',
)
assert(status.protocol === 'research/VALIDATION_PROTOCOL.md', 'research status must point to the frozen protocol')
assert(status.protocolId === 'ghesse-learning-outcomes-v1', 'research status must identify the frozen protocol revision')
assert(protocol.includes(`Protocol ID: **${status.protocolId}**`), 'protocol file and status must carry the same protocol ID')
assert(protocol.includes('7 days') && protocol.includes('30 days'), 'validation protocol must retain delayed follow-up measurements')
assert(protocol.includes('unseen') || protocol.includes('held-out'), 'validation protocol must retain transfer/held-out measurement')
assert(Array.isArray(status.studyEvidence), 'research status must keep a studyEvidence array')

if (status.status === 'validated') {
  assert(status.studyEvidence.length > 0, 'validated status requires attached study evidence')
  for (const evidence of status.studyEvidence) {
    assert(evidence && typeof evidence === 'object', 'each study evidence entry must be an object')
    assert(
      typeof evidence.path === 'string' && /^research\/evidence\/[A-Za-z0-9._/-]+$/.test(evidence.path),
      'study evidence must point to a repository artifact under research/evidence/',
    )
    assert(typeof evidence.sha256 === 'string' && /^[a-f0-9]{64}$/.test(evidence.sha256), 'study evidence must record a SHA-256')
    assert(typeof evidence.kind === 'string' && evidence.kind.trim(), 'study evidence must identify its kind')
    const artifact = join(root, evidence.path)
    assert(existsSync(artifact), `study evidence artifact is missing: ${evidence.path}`)
    const actualSha = createHash('sha256').update(readFileSync(artifact)).digest('hex')
    assert(actualSha === evidence.sha256, `study evidence SHA-256 mismatch: ${evidence.path}`)
  }
  assert(status.claim === 'empirically-validated', 'validated status must use the empirically-validated claim')
} else {
  assert(status.claim !== 'empirically-validated', 'an unvalidated study status must not claim empirical validation')
}

console.log(`Research evidence status validated: ${status.status}`)
