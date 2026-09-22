import { beforeEach, describe, expect, it } from 'vitest'

const mem = new Map<string, string>()
globalThis.localStorage = {
  getItem: (key: string) => mem.get(key) ?? null,
  setItem: (key: string, value: string) => void mem.set(key, value),
  removeItem: (key: string) => void mem.delete(key),
  clear: () => mem.clear(),
  key: (index: number) => [...mem.keys()][index] ?? null,
  get length() { return mem.size },
} as Storage

import { buildLemmaMap, lemmaOf, preprocess, tokenizeSentence } from './lemmatize'
import { emptyState, loadState, saveState, STORAGE_KEY } from './store'
import { wordMastery } from './mastery'
import { recordCompletedRead, recordPreparedChapter } from './progress'
import { clampNarrationRate, englishNarrationVoices, selectNarrationVoice, shouldWaitForHigherQualityVoice, voiceQualityScore, type VoiceLike } from './narration'
import { acceptedAnswers, blankWordProgress, buildReviewQuestion, isTypedCorrect, modeForProgress, recordRetrieval, isTroubleWord } from './review'
import { buildExam, scoreExam } from './exams'
import { certificationStatus } from './analytics'
import { MIDPOINT_EXAM_ID, bookExamId, canPrepareChapter, canReadChapter, canTakeExam, examRemediationPending, examRemediationWordIds } from './gates'
import { CHAPTERS, VOCAB } from '../data/chapters'
import type { WordEntry } from './types'

const MINI_VOCAB: WordEntry[] = [
  { id: 'cat', word: 'cat', fa: 'گربه', ipa: '', topic: 'animals', ex: 'The cat is black.', tr: '', pos: 'n.', cefr: 'A1' },
  { id: 'dog', word: 'dog', fa: 'سگ', ipa: '', topic: 'animals', ex: 'The dog is here.', tr: '', pos: 'n.', cefr: 'A1' },
  { id: 'bird', word: 'bird', fa: 'پرنده', ipa: '', topic: 'animals', ex: 'The bird can fly.', tr: '', pos: 'n.', cefr: 'A1' },
  { id: 'fish', word: 'fish', fa: 'ماهی', ipa: '', topic: 'animals', ex: 'The fish is small.', tr: '', pos: 'n.', cefr: 'A1' },
  { id: 'be', word: 'be', fa: 'بودن', ipa: '', topic: 'verb', ex: '', tr: '', pos: 'v.', cefr: 'A1' },
  { id: 'have-to', word: 'have to', fa: 'مجبور بودن', ipa: '', topic: 'verb', ex: '', tr: '', pos: 'v.', cefr: 'A1' },
  { id: 'like', word: 'like', fa: 'مثل', ipa: '', topic: 'grammar', ex: '', tr: '', pos: 'prep.', cefr: 'A1' },
  { id: 'like-2', word: 'like', fa: 'دوست داشتن', ipa: '', topic: 'verb', ex: '', tr: '', pos: 'v.', cefr: 'A1' },
  { id: 'second', word: 'second', fa: 'دوم', ipa: '', topic: 'number', ex: '', tr: '', pos: 'det.', cefr: 'A1' },
  { id: 'second-2', word: 'second', fa: 'ثانیه', ipa: '', topic: 'time', ex: '', tr: '', pos: 'n.', cefr: 'A1' },
  { id: 'o-clock', word: 'o’clock', fa: 'ساعت', ipa: '', topic: 'time', ex: '', tr: '', pos: 'adv.', cefr: 'A1' },
  { id: 'run', word: 'run', fa: 'دویدن', ipa: '', topic: 'verb', ex: '', tr: '', pos: 'v.', cefr: 'A1' },
  { id: 'thanks', word: 'thanks', fa: 'تشکر', ipa: '', topic: 'communication', ex: '', tr: '', pos: 'int.', cefr: 'A1' },
  { id: 'live', word: 'live', fa: '', ipa: '', topic: '', ex: '', tr: '', pos: 'v.', cefr: 'A1' },
  { id: 'life', word: 'life', fa: '', ipa: '', topic: '', ex: '', tr: '', pos: 'n.', cefr: 'A1' },
  { id: 'use', word: 'use', fa: '', ipa: '', topic: '', ex: '', tr: '', pos: 'v.', cefr: 'A1' },
  { id: 'us', word: 'us', fa: '', ipa: '', topic: '', ex: '', tr: '', pos: 'pron.', cefr: 'A1' },
  { id: 'hate', word: 'hate', fa: '', ipa: '', topic: '', ex: '', tr: '', pos: 'v.', cefr: 'A1' },
  { id: 'hat', word: 'hat', fa: '', ipa: '', topic: '', ex: '', tr: '', pos: 'n.', cefr: 'A1' },
  { id: 'fly', word: 'fly', fa: '', ipa: '', topic: '', ex: '', tr: '', pos: 'v.', cefr: 'A1' },
  { id: 'try', word: 'try', fa: '', ipa: '', topic: '', ex: '', tr: '', pos: 'v.', cefr: 'A1' },
  { id: 't-shirt', word: 'T-shirt', fa: '', ipa: '', topic: '', ex: '', tr: '', pos: 'n.', cefr: 'A1' },
]
const lemmaMap = buildLemmaMap(MINI_VOCAB)

describe('lemmatizer regressions', () => {
  it('maps risky inflections without collisions', () => {
    expect(lemmaOf('lives', lemmaMap)).toBe('live')
    expect(lemmaOf('uses', lemmaMap)).toBe('use')
    expect(lemmaOf('hates', lemmaMap)).toBe('hate')
    expect(lemmaOf('flies', lemmaMap)).toBe('fly')
    expect(lemmaOf('tries', lemmaMap)).toBe('try')
  })
  it('handles phrases, hyphens and homonyms', () => {
    expect(preprocess('We have to go.', lemmaMap.phrases)).toContain('have-to')
    expect(tokenizeSentence('A red T-shirt.', lemmaMap).find(t => t.raw === 'T-shirt')?.id).toBe('t-shirt')
    expect(tokenizeSentence('I like it.', lemmaMap).find(t => t.raw === 'like')?.id).toBe('like-2')
    expect(tokenizeSentence('Wait one second.', lemmaMap).find(t => t.raw === 'second')?.id).toBe('second-2')
  })
})

describe('store v6', () => {
  beforeEach(() => localStorage.clear())

  it('creates schema v6', () => {
    const state = emptyState(1, 'b1c1')
    expect(state.version).toBe(6)
    expect(state.exams).toEqual({})
  })

  it('round-trips prep and exam progress', () => {
    const state = emptyState(1, 'b1c1')
    state.chapters.b1c1 = { preparedAt: 2, prepAttempts: 1, prepTotal: 2, prepFirstPassCorrect: 2, completed: true, checksCorrect: 2, checksTotal: 2, reads: 1 }
    state.exams['book-1'] = { attempts: 1, passed: true, passedAt: 3, lastAttemptAt: 3, lastScore: .9, bestScore: .9, lastProductiveScore: 1, bestProductiveScore: 1, missedWordIds: [], testedWordIds: [] }
    expect(saveState(state)).toBe(true)
    const back = loadState(4, 'b1c1', ['b1c1'], ['cat'])
    expect(back.chapters.b1c1.preparedAt).toBe(2)
    expect(back.exams['book-1'].passed).toBe(true)
  })

  it('migrates v4/v3-compatible data and filters unknown word ids', () => {
    localStorage.setItem('ghesse:state:v4', JSON.stringify({
      version: 4,
      currentChapter: 'b1c1',
      chapters: { b1c1: { completed: true, completedAt: 10, checksCorrect: 2, checksTotal: 2, reads: 1 } },
      words: { cat: { introduced: true, taps: 1, checkCorrect: 0, checkWrong: 0 }, injected: { introduced: true } },
      soundOn: true,
      showFaDefault: false,
      created: 1,
    }))
    const state = loadState(20, 'b1c1', ['b1c1'], ['cat'])
    expect(state.version).toBe(6)
    expect(state.chapters.b1c1.preparedAt).toBe(10)
    expect(state.words.cat.reviewStage).toBe(0)
    expect(state.words.injected).toBeUndefined()
  })

  it('uses rolling backup when primary is corrupted', () => {
    const first = emptyState(1, 'b1c1')
    expect(saveState(first)).toBe(true)
    expect(saveState({ ...first, currentChapter: 'b1c2' })).toBe(true)
    localStorage.setItem(STORAGE_KEY, '{broken')
    expect(loadState(3, 'b1c1', ['b1c1', 'b1c2'], []).currentChapter).toBe('b1c1')
  })
})

describe('spaced mastery', () => {
  it('same-day repetition cannot advance spacing stage', () => {
    const start = Date.UTC(2026, 0, 1)
    let p = blankWordProgress(start)
    p = recordRetrieval(p, true, 'recognition', start)
    expect(p.reviewStage).toBe(1)
    p = recordRetrieval(p, true, 'reverse', start + 60_000)
    expect(p.reviewStage).toBe(1)
    expect(p.successDays).toHaveLength(1)
  })

  it('requires multi-day productive recall for mastered', () => {
    const state = emptyState(1, 'b1c1')
    const start = Date.UTC(2026, 0, 1)
    let p = blankWordProgress(start)
    p = recordRetrieval(p, true, 'recognition', start)
    p = recordRetrieval(p, true, 'reverse', start + 1 * 86_400_000)
    p = recordRetrieval(p, true, 'cloze', start + 4 * 86_400_000)
    p = recordRetrieval(p, true, 'productive', start + 11 * 86_400_000)
    state.words.cat = p
    expect(wordMastery('cat', state)).not.toBe('mastered')
    // Mastery now requires evidence across meaning, context, production and form.
    p = recordRetrieval(p, true, 'spelling', start + 18 * 86_400_000)
    p = recordRetrieval(p, true, 'productive', start + 25 * 86_400_000)
    state.words.cat = p
    expect(p.intervalDays).toBeGreaterThanOrEqual(30)
    expect(wordMastery('cat', state)).toBe('mastered')
  })

  it('a lapse reduces stage and becomes immediately due in an exam', () => {
    const start = Date.UTC(2026, 0, 1)
    let p = blankWordProgress(start)
    p.reviewStage = 4
    p.intervalDays = 14
    p = recordRetrieval(p, false, 'productive', start, 'exam')
    expect(p.reviewStage).toBe(2)
    expect(p.dueAt).toBe(start)
    expect(p.lastReviewWasCorrect).toBe(false)
  })


  it('moves to productive recall early and adapts difficulty', () => {
    const start = Date.UTC(2026, 0, 1)
    let p = blankWordProgress(start)
    p.reviewStage = 3
    // At stage 3, the adaptive selector should target production once the
    // other evidence channels have their minimum coverage.
    p.skillStats.meaning.correct = 3
    p.skillStats.context.correct = 2
    p.skillStats.form.correct = 1
    expect(modeForProgress(p)).toBe('productive')
    const before = p.difficulty
    p = recordRetrieval(p, false, 'productive', start, 'review', 12_000)
    expect(p.difficulty).toBeGreaterThan(before)
    expect(p.lapses).toBe(1)
  })

  it('flags repeated weak retrieval as a trouble word', () => {
    const start = Date.UTC(2026, 0, 1)
    let p = blankWordProgress(start)
    for (let i = 0; i < 3; i++) p = recordRetrieval(p, false, 'productive', start + i * 60_000)
    expect(isTroubleWord(p)).toBe(true)
  })


  it('does not count an immediate post-feedback relearn as independent mastery evidence', () => {
    const start = Date.UTC(2026, 0, 1)
    let p = blankWordProgress(start)
    p = recordRetrieval(p, false, 'productive', start, 'review')
    const stageAfterMiss = p.reviewStage
    const wrongAfterMiss = p.reviewWrong
    const lapseAfterMiss = p.lapses
    const productionAfterMiss = { ...p.skillStats.production }
    p = recordRetrieval(p, true, 'productive', start + 60_000, 'relearn')
    expect(p.reviewStage).toBe(stageAfterMiss)
    expect(p.reviewWrong).toBe(wrongAfterMiss)
    expect(p.lapses).toBe(lapseAfterMiss)
    expect(p.skillStats.production).toEqual(productionAfterMiss)
    expect(p.successDays).toHaveLength(0)
    expect(p.productiveSuccessDays).toHaveLength(0)
    expect(p.lastIndependentSuccessAt).toBeUndefined()
  })
})

describe('chapter prep and gate progression', () => {
  it('requires preparation before reading', () => {
    let state = emptyState(1, 'b1c1')
    expect(canPrepareChapter(state, 'b1c1')).toBe(true)
    expect(canReadChapter(state, 'b1c1')).toBe(false)
    const ids = CHAPTERS[0].new
    state = recordPreparedChapter(state, 'b1c1', ids, ids, ids, [], [], 10)
    expect(canReadChapter(state, 'b1c1')).toBe(true)
  })


  it('does not unlock an unfinished chapter from legacy preparedAt alone', () => {
    const state = emptyState(1, 'b1c1')
    state.chapters.b1c1 = {
      preparedAt: 10,
      prepAttempts: 1,
      completed: false,
      checksCorrect: 0,
      checksTotal: 0,
      reads: 0,
    }
    expect(canReadChapter(state, 'b1c1')).toBe(false)
  })

  it('fails closed when either prep test has not passed every word', () => {
    let state = emptyState(1, 'b1c1')
    const ids = CHAPTERS[0].new.slice(0, 2)
    state = recordPreparedChapter(state, 'b1c1', ids, [ids[0]], ids, [], [], 10)
    expect(canReadChapter(state, 'b1c1')).toBe(false)
    expect(state.chapters.b1c1?.preparedAt).toBeUndefined()

    state = recordPreparedChapter(state, 'b1c1', ids, ids, [ids[0]], [], [], 20)
    expect(canReadChapter(state, 'b1c1')).toBe(false)
    expect(state.chapters.b1c1?.preparedAt).toBeUndefined()
  })


  it('uses prep misses to tune difficulty without granting mastery evidence', () => {
    let state = emptyState(1, 'b1c1')
    const ids = CHAPTERS[0].new.slice(0, 2)
    state = recordPreparedChapter(state, 'b1c1', ids, ids, ids, [ids[0]], [ids[0]], 10)
    expect(state.words[ids[0]].difficulty).toBeGreaterThan(state.words[ids[1]].difficulty)
    expect(state.words[ids[0]].reviewCorrect).toBe(0)
    expect(state.words[ids[0]].successDays).toHaveLength(0)
  })


  it('does not let repeated prep practice manipulate later scheduling difficulty', () => {
    let state = emptyState(1, 'b1c1')
    const ids = CHAPTERS[0].new.slice(0, 1)
    state = recordPreparedChapter(state, 'b1c1', ids, ids, ids, ids, ids, 10)
    const afterFirstPrep = state.words[ids[0]].difficulty
    state = recordPreparedChapter(state, 'b1c1', ids, ids, ids, [], [], 20)
    expect(state.words[ids[0]].difficulty).toBe(afterFirstPrep)
  })

  it('requires the previous book exam before crossing book boundary', () => {
    const state = emptyState(1, 'b1c1')
    for (const ch of CHAPTERS.filter(ch => ch.book === 1)) {
      state.chapters[ch.id] = { preparedAt: 1, prepAttempts: 1, completed: true, checksCorrect: 2, checksTotal: 2, reads: 1 }
    }
    expect(canTakeExam(state, bookExamId(1))).toBe(true)
    expect(canPrepareChapter(state, 'b2c1')).toBe(false)
    state.exams[bookExamId(1)] = { attempts: 1, passed: true, passedAt: 2, lastAttemptAt: 2, lastScore: .9, bestScore: .9, lastProductiveScore: 1, bestProductiveScore: 1, missedWordIds: [], testedWordIds: [] }
    expect(canPrepareChapter(state, 'b2c1')).toBe(true)
  })

  it('requires midpoint exam before Book 5', () => {
    const state = emptyState(1, 'b1c1')
    for (const ch of CHAPTERS.filter(ch => ch.book <= 4)) state.chapters[ch.id] = { preparedAt: 1, prepAttempts: 1, completed: true, checksCorrect: 2, checksTotal: 2, reads: 1 }
    for (const book of [1, 2, 3, 4]) state.exams[bookExamId(book)] = { attempts: 1, passed: true, passedAt: 2, lastAttemptAt: 2, lastScore: .9, bestScore: .9, lastProductiveScore: 1, bestProductiveScore: 1, missedWordIds: [], testedWordIds: [] }
    expect(canTakeExam(state, MIDPOINT_EXAM_ID)).toBe(true)
    expect(canPrepareChapter(state, 'b5c1')).toBe(false)
    state.exams[MIDPOINT_EXAM_ID] = { attempts: 1, passed: true, passedAt: 3, lastAttemptAt: 3, lastScore: .9, bestScore: .9, lastProductiveScore: .9, bestProductiveScore: .9, missedWordIds: [], testedWordIds: [] }
    expect(canPrepareChapter(state, 'b5c1')).toBe(true)
  })


  it('locks an exam retake until every missed word is remediated after the failed attempt', () => {
    const state = emptyState(1, 'b1c1')
    for (const ch of CHAPTERS.filter(ch => ch.book === 1)) {
      state.chapters[ch.id] = { preparedAt: 1, prepAttempts: 1, completed: true, checksCorrect: 2, checksTotal: 2, reads: 1 }
    }
    const examId = bookExamId(1)
    const missedId = CHAPTERS.find(ch => ch.book === 1)!.new[0]
    state.words[missedId] = blankWordProgress(1)
    state.exams[examId] = {
      attempts: 1, passed: false, lastAttemptAt: 100, lastScore: .7, bestScore: .7,
      lastProductiveScore: .6, bestProductiveScore: .6, missedWordIds: [missedId], testedWordIds: [missedId],
    }
    expect(examRemediationPending(state, examId)).toBe(true)
    expect(examRemediationWordIds(state)).toContain(missedId)
    expect(canTakeExam(state, examId)).toBe(false)

    state.words[missedId] = recordRetrieval(state.words[missedId], true, 'productive', 101, 'relearn')
    expect(examRemediationPending(state, examId)).toBe(true)

    state.words[missedId] = recordRetrieval(state.words[missedId], true, 'productive', 102, 'review')
    expect(examRemediationPending(state, examId)).toBe(false)
    expect(canTakeExam(state, examId)).toBe(true)
  })
})

describe('review and exam generation', () => {
  it('accepts safe typed aliases and normalizes punctuation', () => {
    const article = VOCAB.find(w => w.id === 'a-an')!
    expect(acceptedAnswers(article)).toEqual(expect.arrayContaining(['a', 'an']))
    expect(isTypedCorrect(' An ', article)).toBe(true)
    const shirt = VOCAB.find(w => w.id === 't-shirt')!
    expect(isTypedCorrect('T–shirt', shirt)).toBe(true)
  })

  it('builds four unique MCQ labels for all vocabulary words', () => {
    for (const word of VOCAB) {
      for (const mode of ['recognition', 'reverse', 'cloze'] as const) {
        const q = buildReviewQuestion(word, VOCAB, mode, `qa:${word.id}:${mode}`)
        expect(q.options).toHaveLength(4)
        expect(new Set(q.options!.map(o => o.label.trim().toLowerCase())).size).toBe(4)
        expect(q.options!.some(o => o.id === word.id)).toBe(true)
      }
    }
  })

  it('creates complete book, midpoint and final exams with productive recall', () => {
    const state = emptyState(1, 'b1c1')
    for (const word of VOCAB) state.words[word.id] = blankWordProgress(1)
    for (const id of ['book-1', 'midpoint-4', 'final-8']) {
      const exam = buildExam(id, state, 1)!
      expect(exam.questions.length).toBe(exam.definition.questionCount)
      expect(new Set(exam.questions.map(q => q.wordId)).size).toBe(exam.questions.length)
      expect(exam.questions.some(q => q.mode === 'productive')).toBe(true)
      const allCorrect = Object.fromEntries(exam.questions.map(q => [q.index, true]))
      expect(scoreExam(exam, allCorrect).passed).toBe(true)
    }
  })


  it('guarantees chapter representation in book, midpoint and final exams', () => {
    const state = emptyState(1, 'b1c1')
    for (const word of VOCAB) state.words[word.id] = blankWordProgress(1)
    const cases: Array<[string, typeof CHAPTERS]> = [
      ['book-1', CHAPTERS.filter(ch => ch.book === 1)],
      ['midpoint-4', CHAPTERS.filter(ch => ch.book <= 4)],
      ['final-8', CHAPTERS],
    ]
    for (const [id, chapters] of cases) {
      const exam = buildExam(id, state, 1)!
      const tested = new Set(exam.questions.map(q => q.wordId))
      for (const chapter of chapters) {
        expect(chapter.new.some(wordId => tested.has(wordId))).toBe(true)
      }
      if (id === 'book-1') {
        for (const chapter of chapters) {
          expect(chapter.new.filter(wordId => tested.has(wordId)).length).toBeGreaterThanOrEqual(2)
        }
      }
    }
  })


  it('broadens exam coverage across attempts', () => {
    const state = emptyState(1, 'b1c1')
    for (const word of VOCAB) state.words[word.id] = blankWordProgress(1)
    const first = buildExam('book-1', state, 1)!
    state.exams['book-1'] = {
      attempts: 1, passed: false, lastScore: 0, bestScore: 0,
      lastProductiveScore: 0, bestProductiveScore: 0, missedWordIds: [],
      testedWordIds: first.questions.map(q => q.wordId),
    }
    const second = buildExam('book-1', state, 2)!
    const old = new Set(state.exams['book-1'].testedWordIds)
    expect(second.questions.some(q => !old.has(q.wordId))).toBe(true)
  })
})

describe('chapter completion scheduling', () => {
  it('schedules new words for next-day retrieval and does not regress frontier on reread', () => {
    const order = ['c1', 'c2', 'c3']
    const state = emptyState(1, 'c3')
    state.words.cat = blankWordProgress(1)
    state.chapters.c1 = { preparedAt: 1, prepAttempts: 1, completed: true, completedAt: 2, lastReadAt: 2, checksCorrect: 2, checksTotal: 2, reads: 1 }
    const next = recordCompletedRead(state, 'c1', ['cat'], 1, 2, 20, order, 'c2')
    expect(next.currentChapter).toBe('c3')
    expect(next.chapters.c1.reads).toBe(2)
    expect(next.words.cat.dueAt).toBe(20 + 86_400_000)
  })
})

describe('narration voice selection', () => {
  const voice = (voiceURI: string, name: string, lang: string, isDefault = false, localService = false): VoiceLike => ({ voiceURI, name, lang, default: isDefault, localService })
  it('prioritizes selected voice and natural US voices', () => {
    const voices = [voice('uk', 'UK', 'en-GB', true, true), voice('us', 'US Natural', 'en-US', false, false)]
    expect(selectNarrationVoice(voices, 'uk')?.voiceURI).toBe('uk')
    expect(englishNarrationVoices(voices)[0].voiceURI).toBe('us')
  })
  it('prefers natural/neural remote voices over legacy synthetic voices', () => {
    const natural = voice('neural', 'Microsoft Aria Online (Natural)', 'en-US', false, false)
    const legacy = voice('legacy', 'eSpeak English', 'en-US', true, true)
    expect(voiceQualityScore(natural)).toBeGreaterThan(voiceQualityScore(legacy))
    expect(englishNarrationVoices([legacy, natural])[0].voiceURI).toBe('neural')
  })

  it('waits only when the cold-start catalogue lacks a quality English voice', () => {
    const natural = voice('neural', 'Microsoft Aria Online (Natural)', 'en-US', false, false)
    const samantha = voice('samantha', 'Samantha', 'en-US', true, true)
    const generic = voice('generic', 'English United States', 'en-US', true, true)
    const legacy = voice('legacy', 'eSpeak English', 'en-US', true, true)
    const nonEnglish = voice('sv', 'Swedish', 'sv-SE', true, true)

    expect(shouldWaitForHigherQualityVoice([])).toBe(true)
    expect(shouldWaitForHigherQualityVoice([nonEnglish])).toBe(true)
    expect(shouldWaitForHigherQualityVoice([legacy])).toBe(true)
    expect(shouldWaitForHigherQualityVoice([generic])).toBe(true)
    expect(shouldWaitForHigherQualityVoice([samantha])).toBe(false)
    expect(shouldWaitForHigherQualityVoice([natural])).toBe(false)
  })

  it('never delays a user-selected English voice that is already available', () => {
    const selected = voice('chosen', 'Plain English Voice', 'en-US', false, true)
    expect(shouldWaitForHigherQualityVoice([selected], 'chosen')).toBe(false)
  })

  it('clamps narration rate', () => {
    expect(clampNarrationRate(.2)).toBe(.75)
    expect(clampNarrationRate(2)).toBe(1.1)
  })
})


describe('mastery certification', () => {
  it('cannot be earned by passing the final exam alone', () => {
    const state = emptyState(1, 'b1c1')
    state.exams['final-8'] = {
      attempts: 1, passed: true, passedAt: 1, lastAttemptAt: 1,
      lastScore: 1, bestScore: 1, lastProductiveScore: 1, bestProductiveScore: 1,
      missedWordIds: [], testedWordIds: [],
    }
    const status = certificationStatus(state, Date.UTC(2026, 0, 1))
    expect(status.ready).toBe(false)
    expect(status.finalExamPassed).toBe(true)
  })
  it('prioritizes remediation even when an exam passed with missed words', () => {
    let state = emptyState(1, 'b1c1')
    const missedId = CHAPTERS[0].new[0]
    state = {
      ...state,
      exams: {
        ...state.exams,
        'book-1': {
          attempts: 1,
          passed: true,
          passedAt: 1000,
          lastAttemptAt: 1000,
          lastScore: 0.9,
          bestScore: 0.9,
          lastProductiveScore: 0.85,
          bestProductiveScore: 0.85,
          missedWordIds: [missedId],
          testedWordIds: [missedId],
        },
      },
    }
    expect(examRemediationWordIds(state)).toContain(missedId)
    expect(examRemediationPending(state, 'book-1')).toBe(true)
  })


})