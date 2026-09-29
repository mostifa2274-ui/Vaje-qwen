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
const rights = readJson('provenance/release-rights.json')
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
  'contentRights',
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
  contentRights: 'provenance/release-rights.json',
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

assert(['blocked', 'cleared'].includes(rights.status), 'release-rights status must be blocked or cleared')
assert(rights.activeVocabulary === 'src/data/vocabulary.json', 'rights record must identify the active vocabulary file')
assert(rights.activeVocabularySha256 === currentVocabularySha, 'rights record is not tied to the active vocabulary')
const rightsGate = rights.status === 'cleared' ? 'complete' : 'blocked'
assert(status.gates.contentRights.status === rightsGate, 'content-rights quality gate must mirror release-rights status')
if (rightsGate === 'complete') {
  assert(Array.isArray(rights.sources) && rights.sources.length > 0, 'cleared rights require documented sources/evidence')
}

const outcomesGate = research.status === 'validated' ? 'complete' : 'pending'
assert(status.gates.learnerOutcomesPilot.status === outcomesGate, 'learner-outcomes gate must mirror research evidence status')
if (outcomesGate === 'complete') {
  assert(research.claim === 'empirically-validated', 'completed learner-outcomes gate requires the validated research claim')
  assert(Array.isArray(research.studyEvidence) && research.studyEvidence.length > 0, 'completed learner-outcomes gate requires study evidence')
}

const editorialComplete =
  lexical.reviewedWordIds.length === vocabulary.length
  && hasSignoff(lexical.reviewerSignoff, currentVocabularySha)
  && hasSignoff(lexical.chapterAssessmentSignoff, currentVocabularySha)
assert(
  status.gates.nativeEditorialReview.status === (editorialComplete ? 'complete' : 'pending'),
  'native-editorial gate does not match genuine review coverage/sign-off',
)

assert(accessibility.schemaVersion === 1, 'accessibility status schema is invalid')
assert(['pending', 'complete'].includes(accessibility.status), 'accessibility status must be pending or complete')
const requiredAccessibilityRuns = [
  'android-talkback',
  'ios-voiceover',
  'desktop-keyboard-screenreader',
  'zoom-200',
  'large-text',
  'reduced-motion',
  'forced-contrast',
  'audio-screenreader-conflict',
  'microphone-permission-matrix',
  'offline-assistive-tech',
]
assert(
  JSON.stringify([...accessibility.requiredRuns].sort()) === JSON.stringify([...requiredAccessibilityRuns].sort()),
  'accessibility required-run set cannot be shortened or changed without updating the validator',
)
assert(Array.isArray(accessibility.completedRuns), 'accessibility completedRuns must be an array')
const completedRuns = new Set(accessibility.completedRuns)
assert(completedRuns.size === accessibility.completedRuns.length, 'accessibility completedRuns must be unique')
for (const run of accessibility.completedRuns) assert(requiredAccessibilityRuns.includes(run), `unknown accessibility run: ${run}`)
const accessibilityComplete =
  accessibility.status === 'complete'
  && accessibility.requiredRuns.every(run => completedRuns.has(run))
  && hasSignoff(accessibility.signoff)
assert(
  status.gates.accessibilityHumanQA.status === (accessibilityComplete ? 'complete' : 'pending'),
  'accessibility gate cannot close without every required human run and sign-off',
)

assert(art.schemaVersion === 1, 'art review status schema is invalid')
assert(['pending', 'complete'].includes(art.status), 'art review status must be pending or complete')
assert(Array.isArray(art.reviewedChapterIds), 'art reviewedChapterIds must be an array')
assert(new Set(art.reviewedChapterIds).size === art.reviewedChapterIds.length, 'art reviewedChapterIds must be unique')
const approvedChapterIds = new Set(artManifest.approved ?? [])
const reviewedChapterIds = new Set(art.reviewedChapterIds ?? [])
const artComplete =
  art.status === 'complete'
  && approvedChapterIds.size === 40
  && [...approvedChapterIds].every(id => reviewedChapterIds.has(id))
  && art.reviewedManifestSha256 === sha256('src/data/chapterArtBatch.json')
  && hasSignoff(art.signoff)
assert(
  status.gates.visualArtDirection.status === (artComplete ? 'complete' : 'pending'),
  'visual-art-direction gate cannot close without the exact manifest, all chapters and human sign-off',
)

assert(calibration.schemaVersion === 1, 'calibration status schema is invalid')
assert(['pending', 'complete'].includes(calibration.status), 'calibration status must be pending or complete')
assert(Array.isArray(calibration.studyEvidence), 'calibration studyEvidence must be an array')
assert(Array.isArray(calibration.policyChanges), 'calibration policyChanges must be an array')
const researchEvidence = new Set((research.studyEvidence ?? []).map(item => `${item?.path ?? ''}:${item?.sha256 ?? ''}`))
for (const evidence of calibration.studyEvidence) {
  assert(evidence && typeof evidence === 'object', 'calibration study evidence entries must be objects')
  assert(researchEvidence.has(`${evidence.path ?? ''}:${evidence.sha256 ?? ''}`), 'calibration evidence must reference validated research evidence exactly')
}
const calibrationComplete =
  calibration.status === 'complete'
  && research.status === 'validated'
  && calibration.researchProtocolId === research.protocolId
  && Array.isArray(calibration.studyEvidence) && calibration.studyEvidence.length > 0
  && Array.isArray(calibration.policyChanges) && calibration.policyChanges.length > 0
  && hasSignoff(calibration.signoff)
assert(
  status.gates.learningPolicyCalibration.status === (calibrationComplete ? 'complete' : 'pending'),
  'learning-policy calibration cannot close before validated outcome evidence and documented policy changes',
)

console.log([
  'Quality evidence program valid.',
  `rights: ${status.gates.contentRights.status}`,
  `learner outcomes: ${status.gates.learnerOutcomesPilot.status}`,
  `human lexical review: ${lexical.reviewedWordIds.length}/${vocabulary.length}`,
  `accessibility human QA: ${status.gates.accessibilityHumanQA.status}`,
  `signature art direction: ${status.gates.visualArtDirection.status}`,
  `learning-policy calibration: ${status.gates.learningPolicyCalibration.status}`,
].join('\n'))
