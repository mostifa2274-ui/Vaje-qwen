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
import { introduceWordsOfCompletedChapters, recordCompletedRead, recordPreparedChapter } from './progress'
import { clampNarrationRate, englishNarrationVoices, narrationLaunchDecision, selectNarrationVoice, shouldWaitForHigherQualityVoice, voiceQualityScore, type VoiceLike } from './narration'
import { acceptedAnswers, blankWordProgress, buildReviewQuestion, dueWordIds, interleaveReviewQueue, isTypedCorrect, modeForProgress, recordRetrieval, reliableRetrievalElapsedMs, isTroubleWord } from './review'
import { buildExam, scoreExam } from './exams'
import { certificationStatus, nextBestAction } from './analytics'
import { FINAL_EXAM_ID, MIDPOINT_EXAM_ID, bookExamId, canPrepareChapter, canReadChapter, canTakeExam, examRemediationPending, examRemediationWordIds } from './gates'
import { LISTENING_QUESTION_COUNT, READING_QUESTION_COUNT } from './comprehension'

const FULL_LISTENING = { firstPassCorrect: LISTENING_QUESTION_COUNT, total: LISTENING_QUESTION_COUNT, verifiedCorrect: LISTENING_QUESTION_COUNT }
import { CHAPTERS, VOCAB } from '../data/chapters'
import type { GhesseState, WordEntry } from './types'

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
    expect(state.dayEvidenceVersion).toBe(1)
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

  it('migrates legacy UTC day evidence and prevents a false same-local-day stage', () => {
    const nodeProcess = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process
    const previousTz = nodeProcess.env.TZ
    nodeProcess.env.TZ = 'Asia/Tehran'
    try {
      // 21:30 UTC is 01:00 on the next local calendar day in Tehran.
      const legacySuccessAt = Date.UTC(2026, 8, 29, 21, 30)
      expect(new Date(legacySuccessAt).getDate()).toBe(30)

      const fresh = emptyState(legacySuccessAt, 'b1c1')
      const legacyState = Object.fromEntries(
        Object.entries(fresh).filter(([key]) => key !== 'dayEvidenceVersion'),
      )
      const legacyWord = {
        ...blankWordProgress(legacySuccessAt),
        reviewStage: 2,
        reviewCorrect: 2,
        productiveCorrect: 1,
        lastReviewedAt: legacySuccessAt,
        lastIndependentSuccessAt: legacySuccessAt,
        lastReviewWasCorrect: true,
        lastMode: 'productive' as const,
        // The old engine stored the UTC date.
        successDays: ['2026-09-29'],
        productiveSuccessDays: ['2026-09-29'],
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...legacyState,
        words: { cat: legacyWord },
      }))

      const migrated = loadState(legacySuccessAt + 60_000, 'b1c1', ['b1c1'], ['cat'])
      expect(migrated.dayEvidenceVersion).toBe(1)
      expect(migrated.words.cat.successDays).toEqual(['2026-09-30'])
      expect(migrated.words.cat.productiveSuccessDays).toEqual(['2026-09-30'])
      expect(migrated.words.cat.lastProductiveSuccessAt).toBe(legacySuccessAt)

      const sameLocalDay = recordRetrieval(
        migrated.words.cat,
        true,
        'productive',
        legacySuccessAt + 2 * 60 * 60_000,
      )
      expect(sameLocalDay.reviewStage).toBe(2)
      expect(sameLocalDay.successDays).toEqual(['2026-09-30'])
      expect(sameLocalDay.productiveSuccessDays).toEqual(['2026-09-30'])

      const nextLocalDay = recordRetrieval(
        sameLocalDay,
        true,
        'productive',
        Date.UTC(2026, 8, 30, 21, 30),
      )
      expect(nextLocalDay.reviewStage).toBe(3)
      expect(nextLocalDay.successDays).toEqual(['2026-09-30', '2026-10-01'])
      expect(nextLocalDay.productiveSuccessDays).toEqual(['2026-09-30', '2026-10-01'])
    } finally {
      if (previousTz === undefined) delete nodeProcess.env.TZ
      else nodeProcess.env.TZ = previousTz
    }
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

  it('an unspaced midnight retry cannot create or reset spaced evidence', () => {
    const start = Date.UTC(2026, 0, 1, 23, 58)
    let p = blankWordProgress(start)
    p = recordRetrieval(p, true, 'recognition', start)
    expect(p.reviewStage).toBe(1)
    expect(p.successDays).toHaveLength(1)

    const fiveMinutesLater = start + 5 * 60_000
    p = recordRetrieval(p, true, 'reverse', fiveMinutesLater)
    expect(new Date(fiveMinutesLater).getUTCDate()).toBe(2)
    expect(p.reviewStage).toBe(1)
    expect(p.successDays).toHaveLength(1)

    const genuinelySpaced = fiveMinutesLater + 8 * 60 * 60_000 + 60_000
    p = recordRetrieval(p, true, 'reverse', genuinelySpaced)
    expect(new Date(genuinelySpaced).getUTCDate()).toBe(2)
    expect(p.reviewStage).toBe(2)
    expect(p.successDays).toHaveLength(2)
  })

  it('unspaced productive practice does not postpone the next spaced productive day', () => {
    const start = Date.UTC(2026, 0, 1, 23, 58)
    let p = blankWordProgress(start)
    p = recordRetrieval(p, true, 'productive', start)
    expect(p.productiveSuccessDays).toHaveLength(1)

    const fiveMinutesLater = start + 5 * 60_000
    p = recordRetrieval(p, true, 'spelling', fiveMinutesLater)
    expect(p.productiveSuccessDays).toHaveLength(1)

    const genuinelySpaced = fiveMinutesLater + 8 * 60 * 60_000 + 60_000
    p = recordRetrieval(p, true, 'contextProductive', genuinelySpaced)
    expect(new Date(genuinelySpaced).getUTCDate()).toBe(2)
    expect(p.productiveSuccessDays).toHaveLength(2)
  })

  it('a lapse relearned on a day that already had a success returns tomorrow', () => {
    const start = Date.UTC(2026, 0, 1, 8)
    let p = blankWordProgress(start)
    p = recordRetrieval(p, true, 'recognition', start)
    p = recordRetrieval(p, false, 'reverse', start + 3_600_000)
    expect(p.dueAt).toBe(start + 3_600_000 + 10 * 60_000)

    const later = start + 2 * 3_600_000
    p = recordRetrieval(p, true, 'reverse', later)
    // Still no same-day spacing credit, but no longer due all day either.
    expect(p.reviewStage).toBe(0)
    expect(p.successDays).toHaveLength(1)
    expect(p.dueAt).toBe(later + 86_400_000)
    expect(dueWordIds({ word: p }, later + 60_000)).toEqual([])

    // A same-day success on a word that is not due leaves its schedule alone.
    const scheduled = { ...p, dueAt: later + 5 * 86_400_000 }
    expect(recordRetrieval(scheduled, true, 'reverse', later + 60_000).dueAt).toBe(later + 5 * 86_400_000)
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

  it('never chooses an audio-dependent spelling card when audio is unavailable', () => {
    const start = Date.UTC(2026, 0, 1)
    const p = blankWordProgress(start)
    p.reviewStage = 5
    p.skillStats.meaning.correct = 3
    p.skillStats.context.correct = 2
    p.skillStats.production.correct = 2
    expect(modeForProgress(p, true)).toBe('spelling')
    const fallback = modeForProgress(p, false)
    expect(fallback).not.toBe('spelling')
    expect(['productive', 'contextProductive', 'reverse']).toContain(fallback)
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

  it('rejects sparse imported prep totals that do not cover the real chapter assignment', () => {
    const state = emptyState(1, 'b1c1')
    expect(CHAPTERS[0].new.length).toBeGreaterThan(1)
    state.chapters.b1c1 = {
      preparedAt: 10,
      prepAttempts: 1,
      prepWrittenCorrect: 1,
      prepWrittenTotal: 1,
      prepListeningCorrect: 1,
      prepListeningTotal: 1,
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
    expect(state.chapters.b1c1.prepWrittenFirstPassCorrect).toBe(1)
    expect(state.chapters.b1c1.prepListeningFirstPassCorrect).toBe(1)
  })


  it('does not let repeated prep practice manipulate later scheduling difficulty', () => {
    let state = emptyState(1, 'b1c1')
    const ids = CHAPTERS[0].new.slice(0, 1)
    state = recordPreparedChapter(state, 'b1c1', ids, ids, ids, ids, ids, 10)
    const afterFirstPrep = state.words[ids[0]].difficulty
    expect(state.chapters.b1c1.prepWrittenFirstPassCorrect).toBe(0)
    expect(state.chapters.b1c1.prepListeningFirstPassCorrect).toBe(0)
    state = recordPreparedChapter(state, 'b1c1', ids, ids, ids, [], [], 20)
    expect(state.words[ids[0]].difficulty).toBe(afterFirstPrep)
    // Rehearsing an already prepared chapter must not rewrite the original
    // first-attempt evidence into a perfect score.
    expect(state.chapters.b1c1.prepWrittenFirstPassCorrect).toBe(0)
    expect(state.chapters.b1c1.prepListeningFirstPassCorrect).toBe(0)
  })

  it('requires the previous book exam before crossing book boundary', () => {
    const state = emptyState(1, 'b1c1')
    for (const ch of CHAPTERS.filter(ch => ch.book === 1)) {
      state.chapters[ch.id] = { preparedAt: 1, prepAttempts: 1, completed: true, checksCorrect: 2, checksTotal: 2, reads: 1 }
    }
    consolidateBook(state, 1)
    expect(canTakeExam(state, bookExamId(1))).toBe(true)
    expect(canPrepareChapter(state, 'b2c1')).toBe(false)
    state.exams[bookExamId(1)] = { attempts: 1, passed: true, passedAt: 2, lastAttemptAt: 2, lastScore: .9, bestScore: .9, lastProductiveScore: 1, bestProductiveScore: 1, missedWordIds: [], testedWordIds: [] }
    expect(canPrepareChapter(state, 'b2c1')).toBe(true)
  })

  it('requires the midpoint gate before the final exam even in sparse imported state', () => {
    const state = emptyState(1, 'b1c1')
    const passed = {
      attempts: 1,
      passed: true,
      passedAt: 2,
      lastAttemptAt: 2,
      lastScore: .95,
      bestScore: .95,
      lastProductiveScore: .95,
      bestProductiveScore: .95,
      missedWordIds: [],
      testedWordIds: [],
    }
    for (let book = 1; book <= 8; book++) state.exams[bookExamId(book)] = { ...passed }

    expect(canTakeExam(state, FINAL_EXAM_ID)).toBe(false)

    state.exams[MIDPOINT_EXAM_ID] = { ...passed }
    expect(canTakeExam(state, FINAL_EXAM_ID)).toBe(true)
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
    consolidateBook(state, 1)
    state.exams[examId] = {
      attempts: 1, passed: false, lastAttemptAt: 3 * 86_400_000, lastScore: .7, bestScore: .7,
      lastProductiveScore: .6, bestProductiveScore: .6, missedWordIds: [missedId], testedWordIds: [missedId],
    }
    expect(examRemediationPending(state, examId)).toBe(true)
    expect(examRemediationWordIds(state)).toContain(missedId)
    expect(canTakeExam(state, examId)).toBe(false)

    state.words[missedId] = recordRetrieval(state.words[missedId], true, 'productive', 3 * 86_400_000 + 1, 'relearn')
    expect(examRemediationPending(state, examId)).toBe(true)

    state.words[missedId] = recordRetrieval(state.words[missedId], true, 'productive', 3 * 86_400_000 + 2, 'review')
    expect(examRemediationPending(state, examId)).toBe(false)
    expect(canTakeExam(state, examId)).toBe(true)
  })
})

/** Every word of the book recalled without help two days after it was taught. */
function consolidateBook(state: GhesseState, book: number) {
  for (const ch of CHAPTERS.filter(ch => ch.book === book)) {
    for (const id of ch.new) state.words[id] = { ...blankWordProgress(1), lastIndependentSuccessAt: 2 * 86_400_000 + 1 }
  }
}

describe('review timing evidence', () => {
  it('keeps uninterrupted latency but treats resumed-card timing as unknown', () => {
    expect(reliableRetrievalElapsedMs(1_000, 6_500, true)).toBe(5_500)
    expect(reliableRetrievalElapsedMs(1_000, 6_500, false)).toBeUndefined()
    expect(reliableRetrievalElapsedMs(0, 6_500, true)).toBeUndefined()
    expect(reliableRetrievalElapsedMs(7_000, 6_500, true)).toBeUndefined()
  })

  it('does not let unknown resumed latency create an artificial Easy grade', () => {
    const progress = blankWordProgress(1)
    progress.reviewStage = 5
    const uninterrupted = recordRetrieval(progress, true, 'productive', 20_000, 'review', 5_000)
    const resumed = recordRetrieval(progress, true, 'productive', 20_000, 'review', undefined)
    expect(uninterrupted.difficulty).toBeLessThan(resumed.difficulty)
  })
})

describe('review and exam generation', () => {
  it('accepts safe typed aliases and normalizes punctuation', () => {
    const article = VOCAB.find(w => w.id === 'a-an')!
    expect(acceptedAnswers(article)).toEqual(expect.arrayContaining(['a', 'an']))
    expect(isTypedCorrect(' An ', article)).toBe(true)
    const shirt = VOCAB.find(w => w.id === 't-shirt')!
    expect(isTypedCorrect('T–shirt', shirt)).toBe(true)
    expect(isTypedCorrect('T shirt', shirt)).toBe(true)

    const noOne = VOCAB.find(w => w.id === 'no-one')!
    expect(isTypedCorrect('no-one', noOne)).toBe(true)

    const ok = VOCAB.find(w => w.id === 'ok')!
    expect(isTypedCorrect('okay', ok)).toBe(true)
    expect(isTypedCorrect('O.K.', ok)).toBe(true)

    const tv = VOCAB.find(w => w.id === 'tv')!
    const cd = VOCAB.find(w => w.id === 'cd')!
    const dvd = VOCAB.find(w => w.id === 'dvd')!
    expect(isTypedCorrect('T.V.', tv)).toBe(true)
    expect(isTypedCorrect('C.D.', cd)).toBe(true)
    expect(isTypedCorrect('D.V.D.', dvd)).toBe(true)

    const book = VOCAB.find(w => w.id === 'book')!
    expect(isTypedCorrect('ＢＯＯＫ', book)).toBe(true)
    expect(isTypedCorrect('book,', book)).toBe(true)
    expect(isTypedCorrect('book:', book)).toBe(true)

    // Do not broaden into misspellings, inflections or unrelated synonyms.
    expect(isTypedCorrect('noone', noOne)).toBe(false)
    expect(isTypedCorrect('books', book)).toBe(false)
    expect(isTypedCorrect('television', tv)).toBe(false)
  })

  it('interleaves adjacent topics and homographs without changing the selected review set', () => {
    const topicBlocked = ['cat', 'dog', 'bird', 'like', 'fish']
    const interleaved = interleaveReviewQueue(topicBlocked, MINI_VOCAB)
    expect(interleaved[0]).toBe('cat')
    expect(interleaved[1]).toBe('like')
    expect(new Set(interleaved)).toEqual(new Set(topicBlocked))

    const homographs = interleaveReviewQueue(['like', 'like-2', 'cat'], MINI_VOCAB)
    expect(homographs).toEqual(['like', 'cat', 'like-2'])

    // Small queues and unknown metadata preserve scheduler order.
    expect(interleaveReviewQueue(['cat', 'dog'], MINI_VOCAB)).toEqual(['cat', 'dog'])
    expect(interleaveReviewQueue(['missing', 'cat', 'dog'], MINI_VOCAB)).toEqual(['missing', 'cat', 'dog'])
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

  it('creates complete midpoint and final exams with productive recall', () => {
    const state = emptyState(1, 'b1c1')
    for (const word of VOCAB) state.words[word.id] = blankWordProgress(1)
    // Book exams are end-of-book tests with their own builder (bookTest.test.ts).
    expect(buildExam('book-1', state, 1)).toBeUndefined()
    for (const id of ['midpoint-4', 'final-8']) {
      const exam = buildExam(id, state, 1)!
      expect(exam.questions.length).toBe(exam.definition.questionCount)
      expect(new Set(exam.questions.map(q => q.wordId)).size).toBe(exam.questions.length)
      expect(exam.questions.some(q => q.mode === 'productive')).toBe(true)
      const texts = id === 'midpoint-4' ? 2 : 4
      expect(exam.reading).toHaveLength(texts)
      expect(exam.listening).toHaveLength(texts)
      const allCorrect = Object.fromEntries(exam.questions.map(q => [q.index, true]))
      const rightTexts = {
        reading: exam.reading.map(text => text.questions.map(question => question.answer)),
        listening: exam.listening.map(text => text.questions.map(question => question.answer)),
      }
      const perfectResult = scoreExam(exam, allCorrect, rightTexts)
      expect(perfectResult.passed).toBe(true)
      expect(perfectResult.overallScore).toBe(1)

      // Criterion gates tolerate a small number of errors; missed vocabulary
      // is still remediated before progression.
      const nonTyped = exam.questions.find(question => !['productive', 'contextProductive', 'spelling', 'cloze'].includes(question.mode))!
      expect(scoreExam(exam, { ...allCorrect, [nonTyped.index]: false }, rightTexts).passed).toBe(true)

      const comprehensionTotal = [...exam.reading, ...exam.listening].reduce((sum, text) => sum + text.questions.length, 0)
      const tooManyWrong = { ...allCorrect }
      // The epsilon keeps 20 × (1 − 0.9) at 2, not 1.999….
      const failCount = Math.floor((exam.questions.length + comprehensionTotal) * (1 - exam.definition.passRate) + 1e-9) + 1
      for (const question of exam.questions.slice(0, failCount)) tooManyWrong[question.index] = false
      expect(scoreExam(exam, tooManyWrong, rightTexts).passed).toBe(false)

      const oneWrongText = {
        ...rightTexts,
        listening: rightTexts.listening.map((answers, index) => index === 0 ? [(answers[0]! + 1) % 4, ...answers.slice(1)] : answers),
      }
      expect(scoreExam(exam, allCorrect, oneWrongText).passed).toBe(true)

      const comprehensionFails = Math.floor(comprehensionTotal * (1 - exam.definition.passRate) + 1e-9) + 1
      let remaining = comprehensionFails
      const wrongTexts = {
        reading: rightTexts.reading.map(answers => answers.map(answer => {
          if (remaining <= 0) return answer
          remaining--
          return (answer! + 1) % 4
        })),
        listening: rightTexts.listening.map(answers => answers.map(answer => {
          if (remaining <= 0) return answer
          remaining--
          return (answer! + 1) % 4
        })),
      }
      expect(scoreExam(exam, allCorrect, wrongTexts).passed).toBe(false)
      expect(scoreExam(exam, allCorrect).passed).toBe(false)
    }
  })


  it('guarantees chapter representation in midpoint and final exams', () => {
    const state = emptyState(1, 'b1c1')
    for (const word of VOCAB) state.words[word.id] = blankWordProgress(1)
    const cases: Array<[string, typeof CHAPTERS]> = [
      ['midpoint-4', CHAPTERS.filter(ch => ch.book <= 4)],
      ['final-8', CHAPTERS],
    ]
    for (const [id, chapters] of cases) {
      const exam = buildExam(id, state, 1)!
      const tested = new Set(exam.questions.map(q => q.wordId))
      for (const chapter of chapters) {
        expect(chapter.new.some(wordId => tested.has(wordId))).toBe(true)
      }
    }
  })


  it('broadens exam coverage across attempts', () => {
    const state = emptyState(1, 'b1c1')
    for (const word of VOCAB) state.words[word.id] = blankWordProgress(1)
    const first = buildExam(MIDPOINT_EXAM_ID, state, 1)!
    state.exams[MIDPOINT_EXAM_ID] = {
      attempts: 1, passed: false, lastScore: 0, bestScore: 0,
      lastProductiveScore: 0, bestProductiveScore: 0, missedWordIds: [],
      testedWordIds: first.questions.map(q => q.wordId),
    }
    const second = buildExam(MIDPOINT_EXAM_ID, state, 2)!
    const old = new Set(state.exams[MIDPOINT_EXAM_ID].testedWordIds)
    expect(second.questions.some(q => !old.has(q.wordId))).toBe(true)
  })
})

describe('chapter completion scheduling', () => {
  it('rejects completion when an unfinished chapter has not passed the prep gate', () => {
    const state = emptyState(1, 'c1')
    state.words.cat = blankWordProgress(1)
    const next = recordCompletedRead(
      state,
      'c1',
      ['cat'],
      READING_QUESTION_COUNT,
      READING_QUESTION_COUNT,
      READING_QUESTION_COUNT,
      FULL_LISTENING,
      20,
      ['c1', 'c2'],
      'c2',
    )
    expect(next).toBe(state)
    expect(next.chapters.c1).toBeUndefined()
    expect(next.currentChapter).toBe('c1')
  })

  it('rejects a smaller perfect comprehension set such as 2/2', () => {
    let state = emptyState(1, 'c1')
    state = recordPreparedChapter(state, 'c1', ['cat'], ['cat'], ['cat'], [], [], 10)
    const next = recordCompletedRead(state, 'c1', ['cat'], 2, 2, 2, FULL_LISTENING, 20, ['c1', 'c2'], 'c2')
    expect(next).toBe(state)
    expect(next.chapters.c1.completed).toBe(false)
  })

  it('rejects completion until every one of the ten comprehension questions has been corrected', () => {
    let state = emptyState(1, 'c1')
    state = recordPreparedChapter(state, 'c1', ['cat'], ['cat'], ['cat'], [], [], 10)
    const next = recordCompletedRead(
      state,
      'c1',
      ['cat'],
      7,
      READING_QUESTION_COUNT,
      READING_QUESTION_COUNT - 1,
      FULL_LISTENING,
      20,
      ['c1', 'c2'],
      'c2',
    )
    expect(next).toBe(state)
    expect(next.chapters.c1.completed).toBe(false)
    expect(next.currentChapter).toBe('c1')
  })

  it('keeps the honest first-pass score after full correction and completes the chapter', () => {
    let state = emptyState(1, 'c1')
    state = recordPreparedChapter(state, 'c1', ['cat'], ['cat'], ['cat'], [], [], 10)
    const next = recordCompletedRead(
      state,
      'c1',
      ['cat'],
      7,
      READING_QUESTION_COUNT,
      READING_QUESTION_COUNT,
      FULL_LISTENING,
      20,
      ['c1', 'c2'],
      'c2',
    )
    expect(next.chapters.c1.completed).toBe(true)
    expect(next.chapters.c1.checksCorrect).toBe(7)
    expect(next.chapters.c1.checksTotal).toBe(READING_QUESTION_COUNT)
    expect(next.currentChapter).toBe('c2')
    expect(next.words.cat.dueAt).toBe(20 + 86_400_000)
  })

  it('rejects completion until every listening answer has been corrected too', () => {
    let state = emptyState(1, 'c1')
    state = recordPreparedChapter(state, 'c1', ['cat'], ['cat'], ['cat'], [], [], 10)
    const partial = { firstPassCorrect: 3, total: LISTENING_QUESTION_COUNT, verifiedCorrect: LISTENING_QUESTION_COUNT - 1 }
    expect(recordCompletedRead(state, 'c1', ['cat'], 10, READING_QUESTION_COUNT, READING_QUESTION_COUNT, partial, 20, ['c1', 'c2'], 'c2')).toBe(state)
    const corrected = { ...partial, verifiedCorrect: LISTENING_QUESTION_COUNT }
    const next = recordCompletedRead(state, 'c1', ['cat'], 10, READING_QUESTION_COUNT, READING_QUESTION_COUNT, corrected, 20, ['c1', 'c2'], 'c2')
    expect(next.chapters.c1.completed).toBe(true)
    expect(next.chapters.c1.listeningCorrect).toBe(3)
    expect(next.chapters.c1.listeningTotal).toBe(LISTENING_QUESTION_COUNT)
  })

  it('allows legacy completed chapters to be reread without regressing the frontier', () => {
    const order = ['c1', 'c2', 'c3']
    const state = emptyState(1, 'c3')
    state.words.cat = blankWordProgress(1)
    state.chapters.c1 = {
      preparedAt: 1,
      prepAttempts: 1,
      completed: true,
      completedAt: 2,
      lastReadAt: 2,
      checksCorrect: 2,
      checksTotal: 2,
      reads: 1,
    }
    const next = recordCompletedRead(
      state,
      'c1',
      ['cat'],
      8,
      READING_QUESTION_COUNT,
      READING_QUESTION_COUNT,
      FULL_LISTENING,
      20,
      order,
      'c2',
    )
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

  it('falls back after one grace period but still recognizes a later quality upgrade', () => {
    const generic = voice('generic', 'English United States', 'en-US', true, true)
    const natural = voice('neural', 'Microsoft Aria Online (Natural)', 'en-US', false, false)

    expect(narrationLaunchDecision([generic], '', false)).toBe('wait')
    expect(narrationLaunchDecision([generic], '', true)).toBe('fallback')
    expect(narrationLaunchDecision([generic, natural], '', true)).toBe('ready')
  })

  it('clamps narration rate', () => {
    expect(clampNarrationRate(.2)).toBe(.75)
    expect(clampNarrationRate(2)).toBe(1.1)
  })
})


describe('mastery certification', () => {
  it('uses explicitly internal wording when every course evidence threshold is met', () => {
    const now = Date.UTC(2026, 0, 20)
    const state = emptyState(now, 'b1c1')

    for (const chapter of CHAPTERS) {
      state.chapters[chapter.id] = {
        preparedAt: now - 20 * 86_400_000,
        prepAttempts: 1,
        completed: true,
        completedAt: now - 15 * 86_400_000,
        lastReadAt: now - 15 * 86_400_000,
        checksCorrect: READING_QUESTION_COUNT,
        checksTotal: READING_QUESTION_COUNT,
        listeningCorrect: LISTENING_QUESTION_COUNT,
        listeningTotal: LISTENING_QUESTION_COUNT,
        reads: 1,
      }
    }

    for (const word of VOCAB) {
      state.words[word.id] = {
        ...blankWordProgress(now - 20 * 86_400_000),
        reviewStage: 5,
        reviewCorrect: 4,
        reviewWrong: 0,
        reviewStreak: 4,
        lastReviewedAt: now,
        lastIndependentSuccessAt: now,
        lastProductiveSuccessAt: now,
        lastReviewWasCorrect: true,
        intervalDays: 30,
        productiveCorrect: 2,
        successDays: ['2026-01-01', '2026-01-05', '2026-01-10', '2026-01-20'],
        productiveSuccessDays: ['2026-01-10', '2026-01-20'],
        skillStats: {
          meaning: { correct: 2, wrong: 0 },
          context: { correct: 2, wrong: 0 },
          production: { correct: 2, wrong: 0 },
          form: { correct: 2, wrong: 0 },
        },
      }
    }

    const passedExam = {
      attempts: 1,
      passed: true,
      passedAt: now,
      lastAttemptAt: now,
      lastScore: 1,
      bestScore: 1,
      lastProductiveScore: 1,
      bestProductiveScore: 1,
      missedWordIds: [],
      testedWordIds: [],
    }
    for (let book = 1; book <= 8; book++) state.exams[bookExamId(book)] = { ...passedExam }
    state.exams[MIDPOINT_EXAM_ID] = { ...passedExam }
    state.exams['final-8'] = { ...passedExam }

    expect(certificationStatus(state, now).ready).toBe(true)
    const action = nextBestAction(state, now)
    expect(action.kind).toBe('complete')
    expect(action.title).toBe('معیارهای دوره کامل شد')
    expect(action.detail).toContain('درون‌برنامه‌ای')
    expect(action.detail).toContain('سنجش مستقل')
  })

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

describe('course updates', () => {
  it('schedules words moved into an already finished chapter for review', () => {
    const chapter = CHAPTERS[0]
    const [moved, ...taught] = chapter.new
    const state = {
      ...emptyState(1, chapter.id),
      chapters: { [chapter.id]: { preparedAt: 5, prepAttempts: 1, completed: true, completedAt: 5, checksCorrect: 10, checksTotal: 10, reads: 1 } },
      words: Object.fromEntries(taught.map(id => [id, { ...blankWordProgress(5), dueAt: 99 }])),
    }
    const next = introduceWordsOfCompletedChapters(state, CHAPTERS, 50)
    const day = 24 * 60 * 60 * 1000
    expect(next.words[moved]).toMatchObject({ introduced: true, firstSeenAt: 50, dueAt: 50 + day })
    expect(dueWordIds(next.words, 50 + day)).toContain(moved)
    for (const id of taught) expect(next.words[id]).toBe(state.words[id])
    expect(introduceWordsOfCompletedChapters(next, CHAPTERS, 60)).toBe(next)
  })

  it('leaves unfinished chapters to their own prep', () => {
    const state = emptyState(1, CHAPTERS[0].id)
    expect(introduceWordsOfCompletedChapters(state, CHAPTERS, 50)).toBe(state)
  })
})
