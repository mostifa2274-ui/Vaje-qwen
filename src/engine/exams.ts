import { CHAPTERS, VOCAB } from '../data/chapters'
import type { TestText } from '../data/bookTests'
import { examTextsForAttempt } from '../data/examTests'
import type { GhesseState, SkillDimension, WordEntry } from './types'
import { examDefinition, type ExamDefinition } from './gates'
import { buildReviewQuestion, dimensionForMode, isTypedMode, seededSample, selectWeakestWordIds, type ReviewMode, type ReviewQuestion } from './review'

export interface ExamQuestion extends ReviewQuestion {
  index: number
}

export interface BuiltExam {
  definition: ExamDefinition
  questions: ExamQuestion[]
  /** New texts read on screen, then answered (5 questions each). */
  reading: TestText[]
  /** New texts only heard, never shown, then answered (5 questions each). */
  listening: TestText[]
}

/** Chosen option per question, per text; null while unanswered. */
export interface ExamComprehensionAnswers {
  reading: Array<Array<number | null>>
  listening: Array<Array<number | null>>
}

export function emptyComprehensionAnswers(exam: BuiltExam): ExamComprehensionAnswers {
  return {
    reading: exam.reading.map(text => text.questions.map(() => null)),
    listening: exam.listening.map(text => text.questions.map(() => null)),
  }
}

export interface ExamResult {
  correct: number
  total: number
  score: number
  productiveCorrect: number
  productiveTotal: number
  productiveScore: number
  overallCorrect: number
  overallTotal: number
  overallScore: number
  comprehensionCorrect: number
  comprehensionTotal: number
  passed: boolean
  missedWordIds: string[]
  skillScores: Record<SkillDimension, { correct: number; total: number }>
}

export function wordIdsThroughBook(book: number): string[] {
  const ids: string[] = []
  for (const chapter of CHAPTERS.filter(ch => ch.book <= book)) ids.push(...chapter.new)
  return [...new Set(ids)]
}

export function examPool(id: string): string[] {
  const def = examDefinition(id)
  if (!def) return []
  if (def.kind === 'book') return wordIdsThroughBook(def.book!)
  if (def.kind === 'midpoint') return wordIdsThroughBook(4)
  return VOCAB.map(word => word.id)
}

type CumulativeKind = Exclude<ExamDefinition['kind'], 'book'>

function modeForPosition(kind: CumulativeKind, index: number): ReviewMode {
  const cycles: Record<CumulativeKind, ReviewMode[]> = {
    midpoint: ['productive', 'contextProductive', 'cloze', 'spelling', 'reverse'],
    final: ['productive', 'contextProductive', 'spelling', 'cloze', 'reverse'],
  }
  const cycle = cycles[kind]
  return cycle[index % cycle.length]
}

/**
 * Build a criterion-referenced coverage floor before adaptive sampling:
 * at least one word from every chapter in scope. Across repeat attempts, an
 * untested word in that chapter is preferred so coverage expands naturally.
 */
function coverageAnchors(id: string, state: GhesseState, attempt: number): string[] {
  const def = examDefinition(id)
  if (!def) return []
  const chapters = def.kind === 'midpoint' ? CHAPTERS.filter(ch => ch.book <= 4) : CHAPTERS
  const previouslyTested = new Set(state.exams[id]?.testedWordIds ?? [])
  const anchors: string[] = []
  for (const chapter of chapters) {
    const available = chapter.new.filter(wordId => !anchors.includes(wordId))
    const untested = available.filter(wordId => !previouslyTested.has(wordId))
    const firstPool = untested.length ? untested : available
    const first = selectWeakestWordIds(firstPool, state.words, 1, `${id}:${attempt}:${chapter.id}:anchor-1`)
    anchors.push(...first)
  }
  return anchors
}

/**
 * Exam sampling combines criterion coverage with adaptation:
 * - guaranteed chapter representation from coverageAnchors
 * - weak words receive most of the remaining capacity
 * - previously untested words receive explicit coverage pressure
 * - the remainder is a deterministic breadth sample.
 */
function selectExamWords(id: string, state: GhesseState, count: number, attempt: number): string[] {
  const pool = examPool(id)
  const previouslyTested = new Set(state.exams[id]?.testedWordIds ?? [])
  const seed = `${id}:attempt:${attempt}`
  const anchors = coverageAnchors(id, state, attempt).slice(0, count)
  const selected = [...anchors]
  const selectedSet = new Set(selected)

  const capacityAfterAnchors = count - selected.length
  const weakCount = Math.min(Math.ceil(capacityAfterAnchors * 0.6), capacityAfterAnchors)
  if (weakCount > 0) {
    const weak = selectWeakestWordIds(pool.filter(wordId => !selectedSet.has(wordId)), state.words, weakCount, `${seed}:weak`)
    selected.push(...weak)
    weak.forEach(id => selectedSet.add(id))
  }

  const capacityAfterWeak = count - selected.length
  if (capacityAfterWeak > 0) {
    const untested = pool.filter(wordId => !selectedSet.has(wordId) && !previouslyTested.has(wordId))
    const coverageCount = Math.min(Math.ceil(capacityAfterWeak * 0.6), untested.length)
    const coverage = seededSample(untested, coverageCount, `${seed}:coverage`)
    selected.push(...coverage)
    coverage.forEach(id => selectedSet.add(id))
  }

  const remaining = count - selected.length
  if (remaining > 0) selected.push(...seededSample(pool.filter(wordId => !selectedSet.has(wordId)), remaining, `${seed}:breadth`))
  return seededSample(selected, selected.length, `${seed}:order`)
}

/** Midpoint and final exams. Book tests are built by engine/bookTest.ts. */
export function buildExam(id: string, state: GhesseState, attempt: number): BuiltExam | undefined {
  const definition = examDefinition(id)
  if (!definition || definition.kind === 'book') return undefined
  const kind = definition.kind
  const pool = examPool(id)
  const count = Math.min(definition.questionCount, pool.length)
  const selected = selectExamWords(id, state, count, attempt)
  const byId = new Map<string, WordEntry>(VOCAB.map(word => [word.id, word]))
  const questions = selected.map((wordId, index) => {
    const word = byId.get(wordId)!
    const mode = modeForPosition(kind, index)
    return {
      ...buildReviewQuestion(word, VOCAB, mode, `${id}:${attempt}:${index}:${wordId}`),
      index,
    }
  })
  return { definition, questions, ...examTextsForAttempt(kind, attempt) }
}

export function scoreExam(
  exam: BuiltExam,
  answers: Record<number, boolean>,
  comprehension: ExamComprehensionAnswers = emptyComprehensionAnswers(exam),
): ExamResult {
  let correct = 0
  let productiveCorrect = 0
  let productiveTotal = 0
  const missedWordIds: string[] = []
  const skillScores: Record<SkillDimension, { correct: number; total: number }> = {
    meaning: { correct: 0, total: 0 },
    context: { correct: 0, total: 0 },
    production: { correct: 0, total: 0 },
    form: { correct: 0, total: 0 },
  }
  for (const question of exam.questions) {
    const ok = answers[question.index] === true
    if (ok) correct++
    else missedWordIds.push(question.wordId)
    const dimension = dimensionForMode(question.mode)
    skillScores[dimension].total++
    if (ok) skillScores[dimension].correct++
    if (isTypedMode(question.mode)) {
      productiveTotal++
      if (ok) productiveCorrect++
    }
  }
  const total = exam.questions.length
  const score = total ? correct / total : 0
  const productiveScore = productiveTotal ? productiveCorrect / productiveTotal : 1
  let comprehensionCorrect = 0
  let comprehensionTotal = 0
  const scoreTexts = (texts: TestText[], chosen: Array<Array<number | null>>) => texts.forEach((text, textIndex) => {
    text.questions.forEach((question, index) => {
      comprehensionTotal++
      if (chosen[textIndex]?.[index] === question.answer) comprehensionCorrect++
    })
  })
  scoreTexts(exam.reading, comprehension.reading)
  scoreTexts(exam.listening, comprehension.listening)
  const comprehensionScore = comprehensionTotal ? comprehensionCorrect / comprehensionTotal : 1
  const overallCorrect = correct + comprehensionCorrect
  const overallTotal = total + comprehensionTotal
  const overallScore = overallTotal ? overallCorrect / overallTotal : 0
  return {
    correct,
    total,
    score,
    productiveCorrect,
    productiveTotal,
    productiveScore,
    overallCorrect,
    overallTotal,
    overallScore,
    comprehensionCorrect,
    comprehensionTotal,
    // Cumulative gates use criterion thresholds rather than perfection. Missed
    // vocabulary still becomes remediation and must be independently recalled.
    passed: overallScore >= exam.definition.passRate
      && productiveScore >= exam.definition.productivePassRate
      && comprehensionScore >= exam.definition.passRate,
    missedWordIds,
    skillScores,
  }
}
