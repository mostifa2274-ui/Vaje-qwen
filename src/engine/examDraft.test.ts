import { beforeEach, describe, expect, it } from 'vitest'
import type { BuiltExam } from './exams'
import {
  clearExamDraft,
  EXAM_BREAK_EVERY,
  examSignature,
  loadExamDraft,
  sanitizeExamDraft,
  saveExamDraft,
  type ExamDraft,
} from './examDraft'

const sessionMem = new Map<string, string>()
globalThis.sessionStorage = {
  getItem: (key: string) => sessionMem.get(key) ?? null,
  setItem: (key: string, value: string) => void sessionMem.set(key, value),
  removeItem: (key: string) => void sessionMem.delete(key),
  clear: () => sessionMem.clear(),
  key: (index: number) => [...sessionMem.keys()][index] ?? null,
  get length() { return sessionMem.size },
} as Storage

function builtExam(count = 4): BuiltExam {
  return {
    definition: {
      id: 'book-1',
      kind: 'book',
      book: 1,
      titleFa: 'آزمون کتاب ۱',
      subtitleFa: '',
      questionCount: count,
      passRate: 0.85,
      productivePassRate: 0.8,
    },
    questions: Array.from({ length: count }, (_, index) => ({
      index,
      wordId: `word-${index}`,
      mode: index % 2 === 0 ? 'productive' as const : 'reverse' as const,
      prompt: `prompt-${index}`,
      promptDir: index % 2 === 0 ? 'rtl' as const : 'ltr' as const,
      options: index % 2 === 0 ? undefined : [
        { id: `word-${index}`, label: 'correct' },
        { id: `other-${index}`, label: 'other' },
      ],
      answerId: `word-${index}`,
      acceptedAnswers: [`answer-${index}`],
    })),
  }
}

function draft(exam: BuiltExam, overrides: Partial<ExamDraft> = {}): ExamDraft {
  return {
    version: 1,
    examId: 'book-1',
    attempt: 1,
    signature: examSignature(exam),
    index: 2,
    answers: { 0: true, 1: false },
    timings: { 0: 1200, 1: 2400 },
    typed: 'next answer',
    onBreak: false,
    updatedAt: 100,
    ...overrides,
  }
}

describe('exam session drafts', () => {
  beforeEach(() => sessionStorage.clear())

  it('builds a deterministic signature from the authoritative question sequence', () => {
    expect(examSignature(builtExam())).toBe(examSignature(builtExam()))
    expect(examSignature(builtExam(3))).not.toBe(examSignature(builtExam(4)))
  })

  it('round-trips a valid sequential exam draft', () => {
    const exam = builtExam()
    const value = draft(exam)
    expect(saveExamDraft(value, exam)).toBe(true)

    const loaded = loadExamDraft('book-1', 1, exam)
    expect(loaded?.index).toBe(2)
    expect(loaded?.answers).toEqual({ 0: true, 1: false })
    expect(loaded?.timings).toEqual({ 0: 1200, 1: 2400 })
    expect(loaded?.typed).toBe('next answer')
  })

  it('rejects a different attempt or question signature', () => {
    const exam = builtExam()
    expect(sanitizeExamDraft(draft(exam, { attempt: 2 }), 'book-1', 1, exam)).toBeUndefined()
    expect(sanitizeExamDraft(draft(exam, { signature: 'tampered' }), 'book-1', 1, exam)).toBeUndefined()
  })

  it('rejects non-sequential answers or timings', () => {
    const exam = builtExam()
    expect(sanitizeExamDraft(draft(exam, { answers: { 0: true } }), 'book-1', 1, exam)).toBeUndefined()
    expect(sanitizeExamDraft(draft(exam, { timings: { 0: 1000 } }), 'book-1', 1, exam)).toBeUndefined()
    expect(sanitizeExamDraft(draft(exam, { answers: { 0: true, 1: false, 2: true } }), 'book-1', 1, exam)).toBeUndefined()
  })

  it('keeps skipped questions only in a draft marked by explore mode', () => {
    const exam = builtExam()
    const skipped = draft(exam, { index: 0, answers: { 2: true }, timings: { 2: 900 }, skipped: true })
    expect(saveExamDraft(skipped, exam)).toBe(true)
    expect(loadExamDraft('book-1', 1, exam)).toMatchObject({ index: 0, answers: { 2: true }, timings: { 2: 900 }, skipped: true })
    expect(sanitizeExamDraft({ ...skipped, skipped: undefined }, 'book-1', 1, exam)).toBeUndefined()
    expect(sanitizeExamDraft({ ...skipped, answers: { 99: true } }, 'book-1', 1, exam)).toBeUndefined()
  })

  it('restores a break only at the configured break boundary', () => {
    const exam = builtExam(EXAM_BREAK_EVERY + 1)
    const answers = Object.fromEntries(Array.from({ length: EXAM_BREAK_EVERY }, (_, i) => [i, i % 2 === 0])) as Record<number, boolean>
    const timings = Object.fromEntries(Array.from({ length: EXAM_BREAK_EVERY }, (_, i) => [i, 1000 + i])) as Record<number, number>
    const atBreak = sanitizeExamDraft(draft(exam, {
      index: EXAM_BREAK_EVERY,
      answers,
      timings,
      onBreak: true,
    }), 'book-1', 1, exam)
    expect(atBreak?.onBreak).toBe(true)

    const notAtBreak = sanitizeExamDraft(draft(exam, {
      index: 2,
      onBreak: true,
    }), 'book-1', 1, exam)
    expect(notAtBreak?.onBreak).toBe(false)
  })

  it('clears persisted exam recovery state', () => {
    const exam = builtExam()
    expect(saveExamDraft(draft(exam), exam)).toBe(true)
    clearExamDraft('book-1')
    expect(loadExamDraft('book-1', 1, exam)).toBeUndefined()
  })
})
