import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const DEFAULT_MANIFEST = join(root, 'provenance', 'release-rights.json')
const DEFAULT_VOCABULARY = join(root, 'src', 'data', 'vocabulary.json')

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function validSource(source) {
  return Boolean(
    source
    && typeof source === 'object'
    && typeof source.name === 'string'
    && source.name.trim()
    && typeof source.url === 'string'
    && /^https:\/\//.test(source.url)
    && typeof source.license === 'string'
    && source.license.trim(),
  )
}

export function verifyReleaseEvidence({
  confirmed,
  manifest,
  vocabularyBytes,
}) {
  const errors = []

  if (!confirmed) errors.push('GHESSE_RIGHTS_CONFIRMED=1 is not set.')
  if (!manifest || typeof manifest !== 'object') {
    errors.push('release-rights manifest is missing or invalid.')
    return { ok: false, errors, vocabularySha256: sha256(vocabularyBytes) }
  }

  if (manifest.schemaVersion !== 1) errors.push('release-rights schemaVersion must be 1.')
  if (manifest.status !== 'cleared') errors.push('release-rights status is not cleared.')
  if (manifest.activeVocabulary !== 'src/data/vocabulary.json') {
    errors.push('release-rights activeVocabulary must be src/data/vocabulary.json.')
  }
  if (!['documented-redistribution-rights', 'independent-reconstruction'].includes(manifest.basis)) {
    errors.push('release-rights basis must document redistribution rights or independent reconstruction.')
  }
  if (!Array.isArray(manifest.sources) || manifest.sources.length === 0 || !manifest.sources.every(validSource)) {
    errors.push('release-rights must retain at least one source with name, https URL, and license.')
  }
  if (typeof manifest.clearedAt !== 'string' || Number.isNaN(Date.parse(manifest.clearedAt))) {
    errors.push('release-rights clearedAt must be an ISO date/time.')
  }

  const vocabularySha256 = sha256(vocabularyBytes)
  if (typeof manifest.activeVocabularySha256 !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.activeVocabularySha256)) {
    errors.push('release-rights activeVocabularySha256 must be a lowercase SHA-256 hex digest.')
  } else if (manifest.activeVocabularySha256 !== vocabularySha256) {
    errors.push('release-rights vocabulary SHA-256 does not match the active vocabulary bytes.')
  }

  return { ok: errors.length === 0, errors, vocabularySha256 }
}

export function readReleaseEvidence(
  manifestPath = DEFAULT_MANIFEST,
  vocabularyPath = DEFAULT_VOCABULARY,
) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const vocabularyBytes = readFileSync(vocabularyPath)
  return { manifest, vocabularyBytes }
}

function runCli() {
  let evidence
  try {
    evidence = readReleaseEvidence()
  } catch (error) {
    console.error('PUBLIC RELEASE BLOCKED: release-rights evidence could not be read.')
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }

  const result = verifyReleaseEvidence({
    confirmed: process.env.GHESSE_RIGHTS_CONFIRMED === '1',
    ...evidence,
  })

  if (!result.ok) {
    console.error('PUBLIC RELEASE BLOCKED: vocabulary redistribution rights are not bound to this exact release.')
    for (const error of result.errors) console.error(`- ${error}`)
    console.error('Review CONTENT_PROVENANCE.md and provenance/release-rights.json.')
    process.exit(1)
  }

  console.log(`Rights evidence verified for vocabulary SHA-256 ${result.vocabularySha256}.`)
}

const invokedAsScript = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (invokedAsScript) runCli()
