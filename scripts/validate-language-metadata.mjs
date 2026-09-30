import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const required = {
  'src/components/ActiveUsePractice.tsx': [
    'className="answer-input mt-2 min-h-24 w-full font-en"\n          lang="en"\n          dir="ltr"',
    'className="mt-1 font-en leading-7" lang="en" dir="ltr"',
  ],
  'src/components/GlossSheet.tsx': [
    'className="font-en text-3xl font-bold" lang="en" dir="ltr"',
    'className="font-en text-base leading-relaxed" lang="en" dir="ltr"',
  ],
  'src/components/SentenceRow.tsx': [
    'className="story-en" lang="en" dir="ltr"',
    'className="sr-only" lang="fa"',
  ],
  'src/components/TestPassage.tsx': [
    'className="test-passage" lang="en" dir="ltr"',
    'lang="en" dir="ltr" role="group"',
  ],
  'src/pages/ReaderScreen.tsx': [
    'className="mt-2 font-en text-lg font-bold leading-8" lang="en" dir="ltr"',
  ],
  'src/pages/GlossaryScreen.tsx': [
    'className="glossary-word font-en" lang="en" dir="ltr"',
  ],
  'src/pages/WordPrepScreen.tsx': [
    'data-testid="teach-headword" className="font-en text-4xl font-bold" lang="en" dir="ltr"',
    'className="font-en text-lg leading-8" lang="en" dir="ltr"',
  ],
}

for (const [path, needles] of Object.entries(required)) {
  const source = readFileSync(join(root, path), 'utf8')
  for (const needle of needles) {
    assert(source.includes(needle), `${path}: missing language-metadata contract: ${needle}`)
  }
}

console.log('English/Persian assistive-language metadata validated.')
