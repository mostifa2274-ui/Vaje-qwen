import { VOCAB, WORD_BY_ID } from '../data/chapters'
import { BOOK_TEST_CONTENT, type TestText } from '../data/bookTests'
import type { ExamProgress, GhesseState, WordEntry } from './types'
import { bookExamId } from './gates'
import { listeningChoiceOptions, recordRetrieval, seededSample, selectWeakestWordIds } from './review'
import { isHeadwordTranslationCorrect } from './persianTranslation'
import { sameHeadwordEntries } from './homophones'
import { bookTestTextsPerSkill, bookTestWordsFrom, bookWordIds } from './bookTestSize'

// The end-of-book test. After book N the learner proves four things, each
// scored on its own so a strength in one cannot hide a gap in another:
//
//   1. translation     — type the Persian meaning of English words
//   2. listeningWords  — hear other words and choose their meaning
//   3. reading         — read new texts and answer 5 questions on each
//   4. listening       — hear other new texts (never shown during the
//                        test) and answer 5 questions on each
//
// The test grows with the course (engine/bookTestSize.ts): half of every
// studied book's words are asked, split between the two vocabulary sections,
// and books 1–2 have one text per skill, 3–4 two, 5–6 three and 7–8 four.
// The texts are new stories written only with words taught up to book N.
// Each book has two sets of texts that alternate between attempts, so a
// retake after the review (which reveals the listening texts) is a
// different listening test.

// Every section needs every answer right.
export const BOOK_TEST_PASS_RATE = 1

export type BookTestSection = 'translation' | 'listeningWords' | 'reading' | 'listening'
export const BOOK_TEST_SECTIONS: readonly BookTestSection[] = ['translation', 'listeningWords', 'reading', 'listening']

export interface BookTestWord {
  wordId: string
  book: number
}

export interface BookTestListeningWord extends BookTestWord {
  options: Array<{ id: string; label: string }>
}

export interface BookTest {
  book: number
  attempt: number
  translation: BookTestWord[]
  listeningWords: BookTestListeningWord[]
  reading: TestText[]
  listening: TestText[]
}

/**
 * Answers in the order they are given. Vocabulary answers are the typed
 * Persian meaning or the chosen word id; an empty string is "I don't know".
 * Comprehension answers are option indexes.
 */
export interface BookTestAnswers {
  translation: string[]
  listeningWords: string[]
  /** Chosen option per question, per text. */
  reading: Array<Array<number | null>>
  listening: Array<Array<number | null>>
}

export interface BookTestSectionResult {
  correct: number
  total: number
  score: number
  passed: boolean
}

export interface BookTestResult {
  sections: Record<BookTestSection, BookTestSectionResult>
  correct: number
  total: number
  score: number
  passed: boolean
  /** Vocabulary items answered wrongly, in test order. */
  missedWordIds: string[]
}

export function emptyBookTestAnswers(test: BookTest): BookTestAnswers {
  return {
    translation: [],
    listeningWords: [],
    reading: test.reading.map(text => text.questions.map(() => null)),
    listening: test.listening.map(text => text.questions.map(() => null)),
  }
}

export function isBookTestBook(book: number): boolean {
  return Number.isInteger(book) && BOOK_TEST_CONTENT.has(book)
}

// Function words are tested in context by the two texts; typing a gloss for
// "the" or hearing "of" in isolation says little about real understanding.
const CONTEXT_ONLY_TOPICS = new Set(['grammar', 'pronouns', 'prepositions', 'linking', 'question_words'])

function eligibleForTranslation(word: WordEntry): boolean {
  return !CONTEXT_ONLY_TOPICS.has(word.topic)
}

function eligibleForListening(word: WordEntry): boolean {
  // "a, an" is two words, and "like"/"second" each name two deck entries:
  // hearing them alone cannot tell the learner which meaning is asked for.
  return eligibleForTranslation(word) && !word.word.includes(',') && sameHeadwordEntries(word, VOCAB).length === 1
}

/** Every word taught in books 1..book, in teaching order. */
export function bookTestPool(book: number): string[] {
  const ids: string[] = []
  for (let current = 1; current <= book; current++) ids.push(...bookWordIds(current))
  return ids
}

/**
 * How many words of each studied book the two vocabulary sections ask:
 * half of that book's words, split evenly between typing and listening.
 * When a book's share is odd, the spare word alternates between the
 * sections from book to book and from attempt to attempt.
 */
export function bookTestAllocation(book: number, rotation: number): Map<number, Record<'translation' | 'listeningWords', number>> {
  const allocation = new Map<number, Record<'translation' | 'listeningWords', number>>()
  for (let source = 1; source <= book; source++) {
    const total = bookTestWordsFrom(source)
    const translation = (source + rotation) % 2 === 0 ? Math.ceil(total / 2) : Math.floor(total / 2)
    allocation.set(source, { translation, listeningWords: total - translation })
  }
  return allocation
}

function pickFromBook(
  pool: string[],
  count: number,
  state: GhesseState,
  previouslyTested: ReadonlySet<string>,
  seed: string,
): string[] {
  if (count <= 0 || pool.length === 0) return []
  // Half the places go to the learner's weakest words; the rest prefer words
  // no earlier attempt has asked, so retakes widen coverage.
  const weak = selectWeakestWordIds(pool, state.words, Math.ceil(count / 2), `${seed}:weak`)
  const rest = pool.filter(id => !weak.includes(id))
  const untested = rest.filter(id => !previouslyTested.has(id))
  const fresh = seededSample(untested, count - weak.length, `${seed}:fresh`)
  const filler = seededSample(rest.filter(id => !fresh.includes(id)), count - weak.length - fresh.length, `${seed}:fill`)
  return [...weak, ...fresh, ...filler]
}

function selectSection(
  book: number,
  state: GhesseState,
  attempt: number,
  section: 'translation' | 'listeningWords',
  eligible: (word: WordEntry) => boolean,
  taken: Set<string>,
): BookTestWord[] {
  const previouslyTested = new Set(state.exams[bookExamId(book)]?.testedWordIds ?? [])
  const picked: BookTestWord[] = []
  for (const [source, counts] of bookTestAllocation(book, attempt - 1)) {
    const count = counts[section]
    const pool = bookWordIds(source).filter(id => !taken.has(id) && eligible(WORD_BY_ID.get(id)!))
    for (const wordId of pickFromBook(pool, count, state, previouslyTested, `book-test:${book}:${attempt}:${section}:${source}`)) {
      taken.add(wordId)
      picked.push({ wordId, book: source })
    }
  }
  const order = seededSample(picked.map(item => item.wordId), picked.length, `book-test:${book}:${attempt}:${section}:order`)
  return order.map(wordId => picked.find(item => item.wordId === wordId)!)
}

export function buildBookTest(book: number, state: GhesseState, attempt: number): BookTest | undefined {
  const content = BOOK_TEST_CONTENT.get(book)
  if (!content) return undefined
  const taken = new Set<string>()
  const translation = selectSection(book, state, attempt, 'translation', eligibleForTranslation, taken)
  const listeningWords = selectSection(book, state, attempt, 'listeningWords', eligibleForListening, taken).map(item => ({
    ...item,
    // The ':0' suffix keeps option sets identical to earlier releases, so a
    // test in progress when the app updates still matches its saved draft.
    options: listeningChoiceOptions(WORD_BY_ID.get(item.wordId)!, VOCAB, `book-test:${book}:${attempt}:listen:${item.wordId}:0`),
  }))
  return { book, attempt, translation, listeningWords, ...bookTestTextsForAttempt(book, attempt) }
}

/** The texts of one attempt: the first set on odd attempts, the second on even ones. */
export function bookTestTextsForAttempt(book: number, attempt: number): Pick<BookTest, 'reading' | 'listening'> {
  const content = BOOK_TEST_CONTENT.get(book)!
  const count = bookTestTextsPerSkill(book)
  const start = ((Math.max(1, attempt) - 1) % 2) * count
  return {
    reading: content.reading.slice(start, start + count),
    listening: content.listening.slice(start, start + count),
  }
}

/** Identifies one built test, so saved progress never attaches to another. */
export function bookTestSignature(test: BookTest): string {
  return [
    test.book,
    test.attempt,
    test.translation.map(item => item.wordId).join(','),
    test.listeningWords.map(item => `${item.wordId}:${item.options.map(option => option.id).join('/')}`).join(','),
    test.reading.map(text => text.id).join(','),
    test.listening.map(text => text.id).join(','),
  ].join('|')
}

export function translationCorrect(test: BookTest, index: number, typed: string | undefined): boolean {
  const word = WORD_BY_ID.get(test.translation[index]?.wordId ?? '')
  return Boolean(word && typed && isHeadwordTranslationCorrect(typed, word, VOCAB))
}

export function listeningWordCorrect(test: BookTest, index: number, chosen: string | undefined): boolean {
  const item = test.listeningWords[index]
  return Boolean(item && chosen === item.wordId)
}

function sectionResult(correct: number, total: number): BookTestSectionResult {
  const score = total ? correct / total : 0
  return { correct, total, score, passed: score >= BOOK_TEST_PASS_RATE }
}

export function scoreBookTest(test: BookTest, answers: BookTestAnswers): BookTestResult {
  const missedWordIds: string[] = []
  let translationRight = 0
  test.translation.forEach((item, index) => {
    if (translationCorrect(test, index, answers.translation[index])) translationRight++
    else missedWordIds.push(item.wordId)
  })
  let listeningRight = 0
  test.listeningWords.forEach((item, index) => {
    if (listeningWordCorrect(test, index, answers.listeningWords[index])) listeningRight++
    else missedWordIds.push(item.wordId)
  })
  const comprehension = (texts: TestText[], chosen: Array<Array<number | null>>) =>
    texts.reduce((sum, text, slot) => sum + text.questions.filter((question, index) => chosen[slot]?.[index] === question.answer).length, 0)
  const questionTotal = (texts: TestText[]) => texts.reduce((sum, text) => sum + text.questions.length, 0)

  const sections: Record<BookTestSection, BookTestSectionResult> = {
    translation: sectionResult(translationRight, test.translation.length),
    listeningWords: sectionResult(listeningRight, test.listeningWords.length),
    reading: sectionResult(comprehension(test.reading, answers.reading), questionTotal(test.reading)),
    listening: sectionResult(comprehension(test.listening, answers.listening), questionTotal(test.listening)),
  }
  const correct = BOOK_TEST_SECTIONS.reduce((sum, section) => sum + sections[section].correct, 0)
  const total = BOOK_TEST_SECTIONS.reduce((sum, section) => sum + sections[section].total, 0)
  return {
    sections,
    correct,
    total,
    score: total ? correct / total : 0,
    passed: BOOK_TEST_SECTIONS.every(section => sections[section].passed),
    missedWordIds,
  }
}

/**
 * Store an attempt in the book's exam slot. A pass is never revoked by a
 * later attempt; every vocabulary answer is spaced-repetition evidence, and
 * missed words must be recalled again in Smart Review before the next gate
 * opens (see examRemediationPending).
 */
export function recordBookTest(
  state: GhesseState,
  test: BookTest,
  answers: BookTestAnswers,
  result: BookTestResult,
  now: number,
  timings: Record<string, number> = {},
): GhesseState {
  const words = { ...state.words }
  const record = (wordId: string, correct: boolean, elapsed: number | undefined) => {
    const progress = words[wordId]
    if (progress) words[wordId] = recordRetrieval(progress, correct, 'reverse', now, 'exam', elapsed)
  }
  test.translation.forEach((item, index) => record(item.wordId, translationCorrect(test, index, answers.translation[index]), timings[`translation:${index}`]))
  test.listeningWords.forEach((item, index) => record(item.wordId, listeningWordCorrect(test, index, answers.listeningWords[index]), timings[`listeningWords:${index}`]))

  const id = bookExamId(test.book)
  const previous = state.exams[id]
  const tested = [...test.translation, ...test.listeningWords].map(item => item.wordId)
  const translationScore = result.sections.translation.score
  const progress: ExamProgress = {
    attempts: (previous?.attempts ?? 0) + 1,
    passed: previous?.passed === true || result.passed,
    passedAt: previous?.passedAt ?? (result.passed ? now : undefined),
    lastAttemptAt: now,
    lastScore: result.score,
    bestScore: Math.max(previous?.bestScore ?? 0, result.score),
    lastProductiveScore: translationScore,
    bestProductiveScore: Math.max(previous?.bestProductiveScore ?? 0, translationScore),
    missedWordIds: result.missedWordIds,
    testedWordIds: [...new Set([...(previous?.testedWordIds ?? []), ...tested])],
  }
  return { ...state, words, exams: { ...state.exams, [id]: progress } }
}
