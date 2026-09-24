// Comprehension texts for the end-of-book tests. Each book has two reading
// and two listening texts (variants A and B, used on alternate attempts).
// They are new stories, not chapter text, written only with vocabulary
// taught up to that book; bookTests.test.ts enforces this word by word.

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
  reading: [TestText, TestText]
  listening: [TestText, TestText]
}

const modules = import.meta.glob('./bookTests/*.json', { eager: true })

export const BOOK_TEST_CONTENT: Map<number, BookTestContent> = new Map(
  Object.values(modules)
    .map(module => (module as { default: BookTestContent }).default)
    .map(content => [content.book, content] as const),
)
