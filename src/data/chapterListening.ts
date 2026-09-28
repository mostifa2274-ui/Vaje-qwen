import type { TestText } from './bookTests'

// Listening comprehension after each chapter's story. Every chapter has one
// new text about the same part of the story, told in different words (a
// phone call, a note, another character's view). It is only ever heard,
// never shown, until the questions are done. chapterListening.test.ts checks
// that each text uses only words taught by the end of its chapter.

const modules = import.meta.glob('./chapterListening/*.json', { eager: true })

export const CHAPTER_LISTENING: Map<string, TestText> = new Map(
  Object.entries(modules).map(([file, module]) => [
    file.replace(/^.*\/(b\dc\d)\.json$/, '$1'),
    (module as { default: TestText }).default,
  ] as const),
)
