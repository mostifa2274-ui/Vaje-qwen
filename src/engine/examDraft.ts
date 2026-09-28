import type { BuiltExam, ExamComprehensionAnswers } from './exams'

export const EXAM_BREAK_EVERY = 16

export interface ExamDraft {
  version: 1
  examId: string
  attempt: number
  signature: string
  index: number
  answers: Record<number, boolean>
  timings: Record<number, number>
  typed: string
  onBreak: boolean
  /** Explore mode skipped questions, so answers may have gaps. */
  skipped?: true
  /** Set once the word questions are done and the texts are open. */
  stage?: 'texts'
  /** Current text: the reading texts first, then the listening ones. */
  textIndex?: number
  comprehension?: ExamComprehensionAnswers
  /** Listening texts heard in full at least once. */
  heard?: boolean[]
  updatedAt: number
}

const PREFIX = 'ghesse:exam:v1:'
const MAX_TYPED_LENGTH = 300
const MAX_TIMING_MS = 60 * 60 * 1000

function storageKey(examId: string): string {
  return `${PREFIX}${examId}`
}

export function examSignature(exam: BuiltExam): string {
  return JSON.stringify([
    exam.questions.map(question => [
      question.wordId,
      question.mode,
      question.answerId,
      question.options?.map(option => option.id) ?? [],
    ]),
    exam.reading.map(text => text.id),
    exam.listening.map(text => text.id),
  ])
}

function safeComprehension(raw: unknown, exam: BuiltExam): ExamComprehensionAnswers | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as Partial<ExamComprehensionAnswers>
  const part = (answers: unknown, texts: BuiltExam['reading']): Array<Array<number | null>> | undefined => {
    if (!Array.isArray(answers) || answers.length !== texts.length) return undefined
    const result: Array<Array<number | null>> = []
    for (const [index, text] of texts.entries()) {
      const chosen: unknown = answers[index]
      if (!Array.isArray(chosen) || chosen.length !== text.questions.length) return undefined
      const clean: Array<number | null> = []
      for (const [question, choice] of chosen.entries()) {
        if (choice === null) clean.push(null)
        else if (typeof choice === 'number' && Number.isInteger(choice) && choice >= 0 && choice < text.questions[question].options.length) clean.push(choice)
        else return undefined
      }
      result.push(clean)
    }
    return result
  }
  const reading = part(value.reading, exam.reading)
  const listening = part(value.listening, exam.listening)
  return reading && listening ? { reading, listening } : undefined
}

// Normally every question before the current one is answered. A draft from
// explore mode (`skipped`) may hold any answered subset of the exam instead.
function safeSequentialAnswers(raw: unknown, index: number, total: number, skipped: boolean): Record<number, boolean> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const result: Record<number, boolean> = {}
  const limit = skipped ? total : index
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = Number(key)
    if (!Number.isInteger(parsed) || parsed < 0 || parsed >= limit || typeof value !== 'boolean') return undefined
    result[parsed] = value
  }
  if (skipped) return result
  for (let i = 0; i < index; i++) {
    if (typeof result[i] !== 'boolean') return undefined
  }
  return result
}

function safeSequentialTimings(raw: unknown, index: number, total: number, skipped: boolean): Record<number, number> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const result: Record<number, number> = {}
  const limit = skipped ? total : index
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = Number(key)
    if (
      !Number.isInteger(parsed)
      || parsed < 0
      || parsed >= limit
      || typeof value !== 'number'
      || !Number.isFinite(value)
      || value <= 0
    ) return undefined
    result[parsed] = Math.min(MAX_TIMING_MS, Math.max(1, Math.floor(value)))
  }
  if (skipped) return result
  for (let i = 0; i < index; i++) {
    if (typeof result[i] !== 'number') return undefined
  }
  return result
}

export function sanitizeExamDraft(
  raw: unknown,
  examId: string,
  attempt: number,
  exam: BuiltExam,
): ExamDraft | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as Partial<ExamDraft>
  if (value.version !== 1 || value.examId !== examId || value.attempt !== attempt) return undefined

  const signature = examSignature(exam)
  if (value.signature !== signature) return undefined

  const indexRaw = value.index
  if (
    typeof indexRaw !== 'number'
    || !Number.isInteger(indexRaw)
    || indexRaw < 0
    || indexRaw >= exam.questions.length
  ) return undefined
  const index = indexRaw

  const skipped = value.skipped === true
  const total = exam.questions.length
  const textCount = exam.reading.length + exam.listening.length
  const texts = value.stage === 'texts' && textCount > 0
  // In the texts stage every word question lies behind the learner.
  const answeredUpTo = texts ? total : index
  const answers = safeSequentialAnswers(value.answers, answeredUpTo, total, skipped)
  const timings = safeSequentialTimings(value.timings, answeredUpTo, total, skipped)
  if (!answers || !timings) return undefined

  let textFields: Pick<ExamDraft, 'stage' | 'textIndex' | 'comprehension' | 'heard'> = {}
  if (texts) {
    const textIndex = value.textIndex
    if (typeof textIndex !== 'number' || !Number.isInteger(textIndex) || textIndex < 0 || textIndex >= textCount) return undefined
    const comprehension = safeComprehension(value.comprehension, exam)
    if (!comprehension) return undefined
    const heard = value.heard
    if (!Array.isArray(heard) || heard.length !== exam.listening.length || heard.some(item => typeof item !== 'boolean')) return undefined
    // Listening answers need a full hearing first.
    if (comprehension.listening.some((chosen, text) => !heard[text] && chosen.some(choice => choice !== null))) return undefined
    if (!skipped) {
      const done = [...comprehension.reading, ...comprehension.listening]
      if (done.slice(0, textIndex).some(chosen => chosen.some(choice => choice === null))) return undefined
    }
    textFields = { stage: 'texts', textIndex, comprehension, heard: [...heard] }
  }

  const onBreak = !texts && value.onBreak === true && index > 0 && index % EXAM_BREAK_EVERY === 0
  const typed = texts ? '' : typeof value.typed === 'string' ? value.typed.slice(0, MAX_TYPED_LENGTH) : ''

  return {
    version: 1,
    examId,
    attempt,
    signature,
    index,
    answers,
    timings,
    typed,
    onBreak,
    ...(skipped ? { skipped: true as const } : {}),
    ...textFields,
    updatedAt: typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) && value.updatedAt > 0
      ? value.updatedAt
      : Date.now(),
  }
}

export function loadExamDraft(examId: string, attempt: number, exam: BuiltExam): ExamDraft | undefined {
  if (typeof sessionStorage === 'undefined') return undefined
  try {
    const raw = sessionStorage.getItem(storageKey(examId))
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as unknown
    const draft = sanitizeExamDraft(parsed, examId, attempt, exam)
    if (!draft) sessionStorage.removeItem(storageKey(examId))
    return draft
  } catch {
    try {
      sessionStorage.removeItem(storageKey(examId))
    } catch {
      // Optional recovery state only.
    }
    return undefined
  }
}

export function saveExamDraft(draft: ExamDraft, exam: BuiltExam): boolean {
  if (typeof sessionStorage === 'undefined') return false
  const normalized = sanitizeExamDraft(draft, draft.examId, draft.attempt, exam)
  if (!normalized) return false
  try {
    sessionStorage.setItem(storageKey(draft.examId), JSON.stringify(normalized))
    return true
  } catch {
    return false
  }
}

export function clearExamDraft(examId: string): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(storageKey(examId))
  } catch {
    // Exam recovery is optional and must never block the core flow.
  }
}
