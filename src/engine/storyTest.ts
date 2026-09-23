import { CHAPTERS, WORD_BY_ID, chaptersOfBook } from '../data/chapters'
import type { Chapter, GhesseState, StoryTestProgress } from './types'
import { buildReadingQuestions, type ReadingOption, type ReadingQuestion } from './comprehension'
import { faNum } from './format'

// Book-level story comprehension. After each book the learner answers
// questions about that book's story and, from book 2 on, about every earlier
// book too, so the whole narrative stays connected rather than chapter-local.

export const STORY_TEST_PASS_RATE = 0.8
export const STORY_TEST_CURRENT_COUNT = 10
const CURRENT_CHAPTER_DETAIL_COUNT = STORY_TEST_CURRENT_COUNT - 2
const PREVIOUS_MINIMUM = 6

export type StoryTestScope = 'current' | 'previous'

export interface StoryTestQuestion extends ReadingQuestion {
  book: number
  scope: StoryTestScope
  /** The chapter to reread when this question is missed. */
  chapterId: string
  /** False when naming the chapter would reveal the answer. */
  showChapter: boolean
}

export interface StoryTest {
  book: number
  attempt: number
  questions: StoryTestQuestion[]
}

export interface StoryTestResult {
  correct: number
  total: number
  score: number
  passed: boolean
  currentCorrect: number
  currentTotal: number
  previousCorrect: number
  previousTotal: number
  missed: Array<{ question: StoryTestQuestion; chosenId?: string }>
}

export function storyTestId(book: number): string {
  return `story-${book}`
}

export function storyTestTitle(book: number): string {
  return `درک مطلب کتاب ${faNum(book)}`
}

export function isStoryTestBook(book: number): boolean {
  return Number.isInteger(book) && book >= 1 && book <= 8
}

/** Earlier books reviewed at the end of book N, oldest first. */
export function previousQuestionCount(book: number): number {
  return book <= 1 ? 0 : Math.max(PREVIOUS_MINIMUM, book - 1)
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededOrder<T>(items: readonly T[], seed: string, key: (item: T) => string): T[] {
  return [...items].sort((a, b) => hashString(`${seed}:${key(a)}`) - hashString(`${seed}:${key(b)}`))
}

function chapterLabel(chapter: Chapter): string {
  return `فصل ${faNum(chapter.n)}: ${chapter.titleFa}`
}

const STOP_WORDS = new Set([
  'the', 'and', 'but', 'for', 'from', 'with', 'this', 'that', 'there', 'then', 'they', 'them', 'their',
  'she', 'her', 'his', 'him', 'you', 'your', 'our', 'are', 'was', 'were', 'has', 'have', 'had', 'into',
  'onto', 'what', 'when', 'where', 'who', 'will', 'can', 'not', 'one', 'again', 'still', 'very', 'says',
  'said', 'asks', 'mina', 'nino', 'cat', 'looks', 'look', 'sees', 'every', 'more', 'some', 'too', 'just',
  'about', 'after', 'before', 'while', 'because', 'near', 'beside', 'each', 'other', 'another', 'also',
])

function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z'\s-]+/g, ' ')
    .split(/\s+/)
    .map(word => word.replace(/^['-]+|['-]+$/g, ''))
    .filter(word => word.length > 3 && !STOP_WORDS.has(word))
}

/**
 * Sentences that clearly belong to one chapter of a book: each contains
 * content words that never appear in the book's other chapters, so a learner
 * who followed the story can place it. Best candidates first.
 */
const distinctiveCache = new Map<string, number[]>()

function distinctiveEvents(chapter: Chapter, siblings: readonly Chapter[]): number[] {
  const cacheKey = `${chapter.id}|${siblings.map(sibling => sibling.id).join(',')}`
  const cached = distinctiveCache.get(cacheKey)
  if (cached) return cached
  const elsewhere = new Set<string>()
  for (const other of siblings) {
    if (other.id === chapter.id) continue
    for (const sentence of other.sentences) for (const word of contentWords(sentence.en)) elsewhere.add(word)
  }
  const seen = new Set<string>()
  const ranked: Array<{ index: number; distinct: number }> = []
  chapter.sentences.forEach((sentence, index) => {
    const text = sentence.en.trim()
    const words = text.split(/\s+/).length
    const key = text.toLowerCase()
    if (words < 5 || words > 16 || seen.has(key) || text.includes('"')) return
    seen.add(key)
    const distinct = new Set(contentWords(text).filter(word => !elsewhere.has(word))).size
    if (distinct >= 2) ranked.push({ index, distinct })
  })
  const result = ranked.sort((a, b) => b.distinct - a.distinct || a.index - b.index).map(item => item.index)
  distinctiveCache.set(cacheKey, result)
  return result
}

function pickEvent(chapter: Chapter, siblings: readonly Chapter[], seed: string): number {
  const candidates = distinctiveEvents(chapter, siblings).slice(0, 6)
  if (candidates.length === 0) throw new Error(`No distinctive story event in ${chapter.id}`)
  return seededOrder(candidates, seed, String)[0]
}

function whichChapterQuestion(book: number, scope: StoryTestScope, seed: string, used: Set<string>): StoryTestQuestion {
  const chapters = chaptersOfBook(book)
  const available = chapters.filter(chapter => !used.has(`which:${chapter.id}`))
  const target = seededOrder(available.length ? available : chapters, `${seed}:target`, chapter => chapter.id)[0]
  used.add(`which:${target.id}`)
  const event = pickEvent(target, chapters, `${seed}:event`)
  const distractors = seededOrder(chapters.filter(chapter => chapter.id !== target.id), `${seed}:options`, chapter => chapter.id).slice(0, 3)
  const options: ReadingOption[] = [target, ...distractors]
    .sort((a, b) => a.n - b.n)
    .map(chapter => ({ id: `chapter:${chapter.id}`, label: chapterLabel(chapter) }))
  return {
    id: `which-chapter:${target.id}:${event}`,
    prompt: `این اتفاق در کدام فصلِ کتاب ${faNum(book)} رخ می‌دهد؟`,
    context: target.sentences[event].en,
    contextDir: 'ltr',
    optionDir: 'rtl',
    options,
    answerId: `chapter:${target.id}`,
    book,
    scope,
    chapterId: target.id,
    showChapter: false,
  }
}

function orderQuestion(book: number, seed: string): StoryTestQuestion {
  const chapters = chaptersOfBook(book)
  const picked = seededOrder(chapters, `${seed}:chapters`, chapter => chapter.id)
    .slice(0, 4)
    .sort((a, b) => a.n - b.n)
  const events = picked.map(chapter => ({ chapter, index: pickEvent(chapter, chapters, `${seed}:${chapter.id}`) }))
  const options = seededOrder(
    events.map(({ chapter, index }) => ({ id: `order:${chapter.id}:${index}`, label: chapter.sentences[index].en })),
    `${seed}:options`,
    option => option.id,
  )
  const first = events[0]
  return {
    id: `order:${book}:${picked.map(chapter => chapter.id).join('-')}`,
    prompt: `در کتاب ${faNum(book)}، کدام اتفاق زودتر از بقیه رخ می‌دهد؟`,
    optionDir: 'ltr',
    options,
    answerId: `order:${first.chapter.id}:${first.index}`,
    book,
    scope: 'current',
    chapterId: first.chapter.id,
    showChapter: false,
  }
}

type ChapterQuestionKind = 'detail' | 'sequence'

// Translation-matching items test sentence meaning, not memory of the story,
// so book-level tests draw only story details (who/what, which events happen
// in the chapter) and the order of events.
const readingQuestionCache = new Map<string, ReadingQuestion[]>()

function chapterStoryPool(chapter: Chapter, kind: ChapterQuestionKind): ReadingQuestion[] {
  let questions = readingQuestionCache.get(chapter.id)
  if (!questions) {
    questions = buildReadingQuestions(chapter, WORD_BY_ID, CHAPTERS)
    readingQuestionCache.set(chapter.id, questions)
  }
  return questions.filter(question => kind === 'detail'
    ? question.id.includes(':authored:') || question.id.includes(':story-event:')
    : question.id.includes(':sequence:'))
}

function chapterDetailQuestion(
  chapter: Chapter,
  scope: StoryTestScope,
  kind: ChapterQuestionKind,
  seed: string,
  used: Set<string>,
): StoryTestQuestion {
  const unused = (pool: ReadingQuestion[]) => pool.filter(question => !used.has(question.id))
  const preferred = unused(chapterStoryPool(chapter, kind))
  const pool = preferred.length ? preferred : unused(chapterStoryPool(chapter, kind === 'detail' ? 'sequence' : 'detail'))
  const question = seededOrder(pool, seed, item => item.id)[0]
  used.add(question.id)
  return {
    ...question,
    // Chapter questions say "in the story"; here the chapter is named above
    // the question, so point at it explicitly.
    prompt: question.prompt.replace('در قصه', 'در این فصل'),
    book: chapter.book,
    scope,
    chapterId: chapter.id,
    showChapter: true,
  }
}

function spread(total: number, slots: number): number[] {
  return Array.from({ length: slots }, (_, slot) => Math.floor(total / slots) + (slot < total % slots ? 1 : 0))
}

export function buildStoryTest(book: number, attempt: number): StoryTest {
  if (!isStoryTestBook(book)) throw new Error(`Unknown story test book: ${book}`)
  const seed = `${storyTestId(book)}:${attempt}`
  const used = new Set<string>()
  const questions: StoryTestQuestion[] = []

  // Earlier books first, oldest to newest, so the test walks the story in order.
  if (book > 1) {
    const recentFirst = Array.from({ length: book - 1 }, (_, index) => book - 1 - index)
    const counts = spread(previousQuestionCount(book), recentFirst.length)
    const perBook = new Map<number, StoryTestQuestion[]>()
    recentFirst.forEach((previousBook, position) => {
      const items: StoryTestQuestion[] = []
      const chapters = chaptersOfBook(previousBook)
      for (let slot = 0; slot < counts[position]; slot++) {
        const itemSeed = `${seed}:previous:${previousBook}:${slot}`
        if ((position + slot) % 2 === 0) {
          items.push(whichChapterQuestion(previousBook, 'previous', itemSeed, used))
        } else {
          const chapter = seededOrder(chapters, `${itemSeed}:chapter`, item => item.id)[0]
          items.push(chapterDetailQuestion(chapter, 'previous', 'detail', itemSeed, used))
        }
      }
      perBook.set(previousBook, items)
    })
    for (let previousBook = 1; previousBook < book; previousBook++) questions.push(...(perBook.get(previousBook) ?? []))
  }

  // The finished book: every chapter at least once in story order (details
  // first, then the order of events), then two questions that connect its
  // chapters.
  const chapters = chaptersOfBook(book)
  const extraChapters = new Set(
    seededOrder(chapters, `${seed}:extra`, chapter => chapter.id)
      .slice(0, CURRENT_CHAPTER_DETAIL_COUNT % chapters.length)
      .map(chapter => chapter.id),
  )
  const base = Math.floor(CURRENT_CHAPTER_DETAIL_COUNT / chapters.length)
  for (const chapter of chapters) {
    const count = base + (extraChapters.has(chapter.id) ? 1 : 0)
    for (let slot = 0; slot < count; slot++) {
      const kind = slot % 2 === 0 ? 'detail' : 'sequence'
      questions.push(chapterDetailQuestion(chapter, 'current', kind, `${seed}:current:${chapter.id}:${slot}`, used))
    }
  }
  questions.push(whichChapterQuestion(book, 'current', `${seed}:current:which`, used))
  questions.push(orderQuestion(book, `${seed}:current:order`))

  return { book, attempt, questions }
}

export function storyTestSignature(test: StoryTest): string {
  return JSON.stringify([test.book, test.attempt, test.questions.map(question => [question.id, question.answerId])])
}

export function scoreStoryTest(test: StoryTest, answers: Readonly<Record<number, string>>): StoryTestResult {
  let correct = 0
  let currentCorrect = 0
  let currentTotal = 0
  let previousCorrect = 0
  let previousTotal = 0
  const missed: StoryTestResult['missed'] = []
  test.questions.forEach((question, index) => {
    const ok = answers[index] === question.answerId
    if (question.scope === 'current') {
      currentTotal++
      if (ok) currentCorrect++
    } else {
      previousTotal++
      if (ok) previousCorrect++
    }
    if (ok) correct++
    else missed.push({ question, chosenId: answers[index] })
  })
  const total = test.questions.length
  const score = total ? correct / total : 0
  return {
    correct,
    total,
    score,
    passed: score >= STORY_TEST_PASS_RATE,
    currentCorrect,
    currentTotal,
    previousCorrect,
    previousTotal,
    missed,
  }
}

export function recordStoryTest(state: GhesseState, book: number, result: StoryTestResult, now: number): GhesseState {
  const id = storyTestId(book)
  const previous: StoryTestProgress | undefined = state.storyTests[id]
  return {
    ...state,
    storyTests: {
      ...state.storyTests,
      [id]: {
        attempts: (previous?.attempts ?? 0) + 1,
        // A pass is kept: a later practice retake cannot relock the path.
        passed: previous?.passed === true || result.passed,
        passedAt: previous?.passedAt ?? (result.passed ? now : undefined),
        lastAttemptAt: now,
        lastScore: result.score,
        bestScore: Math.max(previous?.bestScore ?? 0, result.score),
      },
    },
  }
}
