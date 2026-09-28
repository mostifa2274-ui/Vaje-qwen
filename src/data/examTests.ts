import type { TestText } from './bookTests'

// Comprehension texts for the two cumulative exams. The midpoint exam (after
// book 4) asks two reading and two listening texts per attempt; the final
// exam asks four of each. Each pool holds two sets, used on alternate
// attempts, so a retake after the answer review brings new texts.
// examTests.test.ts checks the vocabulary of every text.

export type CumulativeExam = 'midpoint' | 'final'

export interface ExamTestContent {
  exam: CumulativeExam
  reading: TestText[]
  listening: TestText[]
}

export const EXAM_TEXTS_PER_ATTEMPT: Record<CumulativeExam, number> = { midpoint: 2, final: 4 }

const modules = import.meta.glob('./examTests/*.json', { eager: true })

export const EXAM_TEST_CONTENT: Map<CumulativeExam, ExamTestContent> = new Map(
  Object.values(modules)
    .map(module => (module as { default: ExamTestContent }).default)
    .map(content => [content.exam, content] as const),
)

/** The reading and listening texts one attempt uses. */
export function examTextsForAttempt(exam: CumulativeExam, attempt: number): { reading: TestText[]; listening: TestText[] } {
  const content = EXAM_TEST_CONTENT.get(exam)
  if (!content) return { reading: [], listening: [] }
  const count = EXAM_TEXTS_PER_ATTEMPT[exam]
  const start = ((Math.max(1, attempt) - 1) % 2) * count
  return {
    reading: content.reading.slice(start, start + count),
    listening: content.listening.slice(start, start + count),
  }
}
