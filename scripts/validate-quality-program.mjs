import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const readJson = path => JSON.parse(readFileSync(join(root, path), 'utf8'))
const sha256 = path => createHash('sha256').update(readFileSync(join(root, path))).digest('hex')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function hasSignoff(value, vocabularySha) {
  const valid = Boolean(
    value
    && typeof value === 'object'
    && typeof value.reviewer === 'string' && value.reviewer.trim()
    && typeof value.role === 'string' && value.role.trim()
    && typeof value.scope === 'string' && value.scope.trim()
    && typeof value.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.date),
  )
  if (!valid) return false
  return vocabularySha === undefined || value.activeVocabularySha256 === vocabularySha
}

const status = readJson('quality/best-in-class-status.json')
const research = readJson('research/status.json')
const lexical = readJson('quality/lexical-review.json')
const accessibility = readJson('quality/accessibility-status.json')
const art = readJson('quality/art-review-status.json')
const calibration = readJson('quality/calibration-status.json')
const artManifest = readJson('src/data/chapterArtBatch.json')
const vocabulary = readJson('src/data/vocabulary.json')

assert(status.schemaVersion === 1 && status.gates && typeof status.gates === 'object', 'best-in-class status file is malformed')
assert(status.target === 'best-in-class-learning-product', 'quality program target changed unexpectedly')
assert(status.productClaim === undefined, 'unearned best-in-class product claims must not be stored as status')
const expectedGates = [
  'learnerOutcomesPilot',
  'nativeEditorialReview',
  'accessibilityHumanQA',
  'visualArtDirection',
  'learningPolicyCalibration',
]
assert(
  JSON.stringify(Object.keys(status.gates).sort()) === JSON.stringify([...expectedGates].sort()),
  'best-in-class gate set changed without updating the quality validator',
)

const expectedEvidence = {
  learnerOutcomesPilot: 'research/status.json',
  nativeEditorialReview: 'quality/lexical-review.json',
  accessibilityHumanQA: 'quality/accessibility-status.json',
  visualArtDirection: 'quality/art-review-status.json',
  learningPolicyCalibration: 'quality/calibration-status.json',
}

for (const [name, gate] of Object.entries(status.gates)) {
  assert(['pending', 'blocked', 'complete'].includes(gate.status), `quality gate ${name} has invalid status`)
  assert(gate.evidence === expectedEvidence[name], `quality gate ${name} must use its canonical evidence file`)
  const artifact = resolve(root, gate.evidence)
  const rel = relative(root, artifact)
  assert(rel && !rel.startsWith('..') && !isAbsolute(rel), `quality gate ${name} evidence must stay inside the repository`)
  assert(existsSync(artifact), `quality gate ${name} evidence file is missing: ${gate.evidence}`)
}

const currentVocabularySha = sha256('src/data/vocabulary.json')
assert(vocabulary.length === 899 && new Set(vocabulary.map(word => word.id)).size === 899, 'human review ledger currently targets the active 899-word course')
assert(lexical.targetWords === vocabulary.length, 'lexical review target must match active vocabulary count')
assert(lexical.activeVocabularySha256 === currentVocabularySha, 'lexical review ledger vocabulary hash is stale')
assert(Array.isArray(lexical.reviewedWordIds), 'lexical reviewedWordIds must be an array')
assert(new Set(lexical.reviewedWordIds).size === lexical.reviewedWordIds.length, 'lexical reviewedWordIds must be unique')
const wordIds = new Set(vocabulary.map(word => word.id))
for (const id of lexical.reviewedWordIds) assert(wordIds.has(id), `lexical review contains unknown word id: ${id}`)

const outcomesGate = research.status === 'validated' ? 'complete' : 'pending'
assert(status.gates.learnerOutcomesPilot.status === outcomesGate, 'learner-outcomes gate must mirror research evidence status')
if (outcomesGate === 'complete') {
  assert(research.claim === 'empirically-validated', 'completed learner-outcomes gate requires the validated research claim')
  assert(Array.isArray(research.studyEvidence) && research.studyEvidence.length > 0, 'completed learner-outcomes gate requires study evidence')
}
