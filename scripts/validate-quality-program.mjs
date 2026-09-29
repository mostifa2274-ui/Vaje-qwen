import fs from 'node:fs'
import path from 'node:path'

const root = new URL('..', import.meta.url).pathname
const status = JSON.parse(fs.readFileSync(path.join(root, 'quality/best-in-class-status.json'), 'utf8'))
const lexical = JSON.parse(fs.readFileSync(path.join(root, 'quality/lexical-review.json'), 'utf8'))
const rights = JSON.parse(fs.readFileSync(path.join(root, 'provenance/release-rights.json'), 'utf8'))
const vocabulary = JSON.parse(fs.readFileSync(path.join(root, 'src/data/vocabulary.json'), 'utf8'))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(status.schemaVersion === 1 && status.gates && typeof status.gates === 'object', 'best-in-class status file is malformed')
for (const [name, gate] of Object.entries(status.gates)) {
  assert(['pending', 'blocked', 'complete'].includes(gate.status), 'quality gate ' + name + ' has invalid status')
  assert(typeof gate.evidence === 'string' && gate.evidence.trim(), 'quality gate ' + name + ' must name evidence')
  assert(fs.existsSync(path.join(root, gate.evidence)), 'quality gate ' + name + ' evidence file is missing: ' + gate.evidence)
}
assert(status.gates.contentRights.status === rights.status, 'quality rights gate must mirror provenance/release-rights.json')

const ids = new Set(vocabulary.map(word => word.id))
assert(vocabulary.length === 899 && ids.size === 899, 'lexical review ledger is tied to the active 899-word deck')
assert(lexical.targetWords === vocabulary.length, 'lexical review target must match active vocabulary')
assert(Array.isArray(lexical.reviewedWordIds), 'reviewedWordIds must be an array')
assert(new Set(lexical.reviewedWordIds).size === lexical.reviewedWordIds.length, 'lexical review ids must be unique')
for (const id of lexical.reviewedWordIds) assert(ids.has(id), 'lexical review contains unknown word id: ' + id)
if (lexical.reviewedWordIds.length > 0) {
  assert(lexical.reviewerSignoff && typeof lexical.reviewerSignoff === 'object', 'reviewed lexical entries require genuine reviewer sign-off')
}
const reviewed = new Set(lexical.reviewedWordIds)
const enrichmentFields = ['senseId', 'senseFa', 'inflections', 'collocations', 'usageNoteFa', 'pronunciationNoteFa', 'wordFamily']
for (const word of vocabulary) {
  const enriched = enrichmentFields.some(field => {
    const value = word[field]
    return Array.isArray(value) ? value.length > 0 : typeof value === 'string' ? value.trim().length > 0 : value != null
  })
  assert(!enriched || reviewed.has(word.id), 'unreviewed lexical enrichment is not allowed for ' + word.id)
}

console.log('Quality program valid: lexical human review ' + lexical.reviewedWordIds.length + '/' + vocabulary.length + '; external gates are explicit.')
