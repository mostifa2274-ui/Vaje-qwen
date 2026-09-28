import { CHAPTERS, lemmaMap } from './chapters'
import type { TestText } from './bookTests'
import { tokenizeSentence } from '../engine/lemmatize'

// Used by the data tests: comprehension questions and their options are in
// English, written only with words the learner has been taught by then.

const taughtAt = new Map<string, number>()
CHAPTERS.forEach((chapter, index) => {
  for (const id of chapter.new) if (!taughtAt.has(id)) taughtAt.set(id, index)
})

/** Index of the last chapter of a book. */
export function lastChapterOfBook(book: number): number {
  return CHAPTERS.reduce((last, chapter, index) => chapter.book <= book ? index : last, -1)
}

// Heard or read, never tapped for glosses, so a possessive or "let's" is
// checked as its base words.
function checkable(line: string): string {
  return line.replace(/_{2,}/g, ' ').replace(/\b(l)et['’]s\b/gi, '$1et us').replace(/(\w)['’]s\b/g, '$1')
}

/** Problems with a text's questions for a learner who has finished chapter index `level`. */
export function questionProblems(text: TestText, level: number): string[] {
  const problems: string[] = []
  for (const question of text.questions) {
    if (!/\?$/.test(question.q.trim()) && !/_{3,}/.test(question.q)) problems.push(`${text.id}: not a question or a gap: ${question.q}`)
    for (const line of [question.q, ...question.options]) {
      if (/[؀-ۿ]/.test(line)) problems.push(`${text.id}: not English: ${line}`)
      for (const token of tokenizeSentence(checkable(line), lemmaMap)) {
        if (!token.isWord || text.names.includes(token.raw)) continue
        if (!token.id) problems.push(`${text.id}: unknown "${token.raw}" in: ${line}`)
        else if ((taughtAt.get(token.id) ?? Infinity) > level) problems.push(`${text.id}: "${token.raw}" (${token.id}) is taught later, in: ${line}`)
      }
    }
  }
  return problems
}
