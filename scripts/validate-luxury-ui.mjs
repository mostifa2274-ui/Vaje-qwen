import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const luxury = read('src/components/LuxuryUI.tsx')
const css = read('src/luxury.css')

const primitives = [
  'LuxuryPageHeader',
  'LuxuryPanel',
  'LuxurySectionHeading',
  'LuxuryProgress',
  'LuxuryAudioOrb',
  'LuxuryChoice',
  'LuxuryMetricGrid',
  'LuxurySheetFrame',
  'LuxuryDivider',
]

for (const primitive of primitives) {
  assert(luxury.includes(`export function ${primitive}`), `missing shared luxury primitive: ${primitive}`)
}

const pageContracts = {
  'src/pages/MapScreen.tsx': ['luxury-home', 'LuxuryProgress', 'LuxuryMetricGrid', 'luxury-home-hero', 'luxury-home-nav'],
  'src/pages/ReaderScreen.tsx': ['luxury-reader', 'LuxuryPageHeader', 'LuxuryProgress', 'luxury-reader-masthead'],
  'src/pages/WordPrepScreen.tsx': ['luxury-prep', 'LuxuryPageHeader', 'LuxuryProgress', 'LuxuryAudioOrb', 'LuxuryChoice'],
  'src/pages/DiagnosticScreen.tsx': ['luxury-exam', 'LuxuryPageHeader', 'LuxuryProgress', 'LuxuryAudioOrb', 'LuxuryChoice'],
  'src/pages/ReviewScreen.tsx': ['luxury-review', 'LuxuryPageHeader', 'LuxuryProgress', 'LuxuryChoice'],
  'src/pages/ExamScreen.tsx': ['luxury-exam', 'LuxuryPageHeader', 'LuxuryProgress', 'LuxuryAudioOrb', 'LuxuryChoice', 'LuxuryMetricGrid'],
  'src/pages/BookTestScreen.tsx': ['luxury-exam', 'LuxuryPageHeader', 'LuxuryProgress', 'LuxuryAudioOrb', 'LuxuryChoice', 'LuxuryMetricGrid'],
  'src/pages/FlashcardsScreen.tsx': ['luxury-flashcards', 'LuxuryPageHeader', 'LuxuryProgress', 'LuxuryMetricGrid'],
  'src/pages/GlossaryScreen.tsx': ['luxury-glossary', 'LuxuryPageHeader', 'LuxuryPanel', 'LuxurySectionHeading'],
  'src/pages/OfflineAudioScreen.tsx': ['luxury-settings', 'LuxuryPageHeader', 'LuxuryPanel', 'LuxurySectionHeading', 'LuxuryProgress'],
  'src/pages/SettingsScreen.tsx': ['luxury-settings', 'LuxuryPageHeader', 'LuxuryMetricGrid', 'luxury-profile-card'],
}

for (const [path, tokens] of Object.entries(pageContracts)) {
  const source = read(path)
  for (const token of tokens) {
    assert(source.includes(token), `${path} is missing luxury contract token: ${token}`)
  }
  assert(!source.includes('metric-card'), `${path} still uses legacy metric-card markup`)
}

const componentContracts = {
  'src/components/TestPassage.tsx': ['LuxuryAudioOrb', 'LuxuryChoice', 'luxury-test-player'],
  'src/components/GlossSheet.tsx': ['LuxurySheetFrame', 'LuxuryDivider', 'LuxuryMetricGrid'],
  'src/components/PronunciationPractice.tsx': ['luxury-pronunciation', 'luxury-module-trigger'],
  'src/components/ActiveUsePractice.tsx': ['luxury-active-use', 'luxury-comparison'],
  'src/components/SpellingHint.tsx': ['luxury-spelling-hint'],
  'src/components/GoalCelebration.tsx': ['luxury-goal-toast'],
  'src/components/SentenceRow.tsx': ['luxury-story-sentence'],
  'src/components/AppErrorBoundary.tsx': ['luxury-error-card'],
  'src/components/RouteErrorBoundary.tsx': ['luxury-error-card'],
}

for (const [path, tokens] of Object.entries(componentContracts)) {
  const source = read(path)
  for (const token of tokens) {
    assert(source.includes(token), `${path} is missing luxury component treatment: ${token}`)
  }
}

for (const selector of [
  '.luxury-page-header',
  '.luxury-panel',
  '.luxury-progress',
  '.luxury-audio-orb',
  '.luxury-choice',
  '.luxury-metric-grid',
  '.luxury-sheet-frame',
  '.luxury-home-hero',
  '.luxury-journey-hero',
  '.luxury-reader',
  '.luxury-prep',
  '.luxury-exam',
]) {
  assert(css.includes(selector), `luxury stylesheet is missing ${selector}`)
}

assert(css.includes('@media (forced-colors: active)'), 'luxury system must preserve forced-colors support')
assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'luxury system must preserve reduced-motion support')
assert(read('src/main.tsx').includes("import './luxury.css'"), 'luxury stylesheet must load after base styles')

console.log(`Luxury UI validation passed: ${Object.keys(pageContracts).length} routes and ${Object.keys(componentContracts).length} shared components use the common design system.`)
