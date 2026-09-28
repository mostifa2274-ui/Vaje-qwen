// Comprehension texts for the end-of-book tests. A test after book N uses
// ceil(N/2) reading and as many listening texts (engine/bookTestSize.ts);
// each book stores two such sets, used on alternate attempts, so book N has
// 2 × ceil(N/2) texts of each skill. They are new stories, not chapter text,
// written only with vocabulary taught up to that book; bookTests.test.ts
// enforces this word by word, questions and options included.

export interface TestSentence {
  en: string
  fa: string
}

export interface TestQuestion {
  q: string
  options: string[]
  answer: number
}

export interface TestText {
  id: string
  titleEn: string
  titleFa: string
  /** Character names that may appear in addition to taught vocabulary. */
  names: string[]
  sentences: TestSentence[]
  questions: TestQuestion[]
}

export interface BookTestContent {
  book: number
  reading: TestText[]
  listening: TestText[]
}

const modules = import.meta.glob('./bookTests/*.json', { eager: true })

export const BOOK_TEST_CONTENT: Map<number, BookTestContent> = new Map(
  Object.values(modules)
    .map(module => (module as { default: BookTestContent }).default)
    .map(content => [content.book, content] as const),
)
