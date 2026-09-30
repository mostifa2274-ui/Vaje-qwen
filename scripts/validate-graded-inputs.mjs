import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname

const gradedInputs = [
  ['src/pages/DiagnosticScreen.tsx', 'diagnostic-answer', true],
  ['src/pages/ReviewScreen.tsx', 'review-answer', true],
  ['src/pages/ExamScreen.tsx', 'exam-answer', true],
  ['src/pages/FlashcardsScreen.tsx', 'flashcard-answer', false],
  ['src/pages/WordPrepScreen.tsx', 'prep-written', false],
  ['src/pages/BookTestScreen.tsx', 'book-test-translation', false],
]

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function inputBlock(source, id) {
  const idAt = source.indexOf(`id="${id}"`)
  assert(idAt >= 0, `graded input ${id} is missing`)
  const start = source.lastIndexOf('<input', idAt)
  const end = source.indexOf('/>', idAt)
  assert(start >= 0 && end >= idAt, `cannot locate input block for ${id}`)
  return source.slice(start, end + 2)
}

for (const [path, id, english] of gradedInputs) {
  const source = readFileSync(join(root, path), 'utf8')
  const block = inputBlock(source, id)
  assert(block.includes('autoComplete="off"'), `${id}: autocomplete must be disabled during independent recall`)
  assert(block.includes('autoCorrect="off"'), `${id}: keyboard autocorrection must be disabled during independent recall`)
  assert(block.includes('spellCheck={false}'), `${id}: spellcheck must be disabled during independent recall`)
  if (english) {
    assert(block.includes('autoCapitalize="none"'), `${id}: English recall must not auto-capitalize`)
    assert(block.includes('lang="en"') && block.includes('dir="ltr"'), `${id}: English recall input must retain English LTR semantics`)
  }
}

console.log('Graded text-input integrity validated.')
