import { CHAPTER_BY_ID } from '../data/chapters'
import type { GhesseState } from './types'
import {
  canOpenChapter,
  canOpenExam,
  canOpenStory,
  canPrepareChapter,
  canReadChapter,
  examDefinition,
} from './gates'
import { diagnosticFailed } from './diagnosticDraft'

export type AppView =
  | { name: 'map' }
  | { name: 'prep'; chapterId: string }
  | { name: 'diagnostic'; chapterId: string }
  | { name: 'read'; chapterId: string }
  | { name: 'review' }
  | { name: 'exam'; examId: string }
  | { name: 'glossary' }
  | { name: 'flashcards' }
  | { name: 'offline-audio' }
  | { name: 'settings' }

function safeDecodeRouteSegment(value: string): string | undefined {
  try {
    return decodeURIComponent(value)
  } catch {
    return undefined
  }
}

/** Parse a hash path. Unknown or malformed targets fall back to the map. */
export function parseHash(hash = typeof window === 'undefined' ? '' : window.location.hash): AppView {
  const path = hash.replace(/^#\/?/, '')
  if (path === 'review') return { name: 'review' }
  if (path === 'glossary') return { name: 'glossary' }
  if (path === 'flashcards') return { name: 'flashcards' }
  if (path === 'offline-audio') return { name: 'offline-audio' }
  if (path === 'settings') return { name: 'settings' }
  if (path.startsWith('prep/')) {
    const chapterId = safeDecodeRouteSegment(path.slice(5))
    if (chapterId && CHAPTER_BY_ID.has(chapterId)) return { name: 'prep', chapterId }
  }
  if (path.startsWith('diagnostic/')) {
    const chapterId = safeDecodeRouteSegment(path.slice(11))
    if (chapterId && CHAPTER_BY_ID.has(chapterId)) return { name: 'diagnostic', chapterId }
  }
  if (path.startsWith('read/')) {
    const chapterId = safeDecodeRouteSegment(path.slice(5))
    if (chapterId && CHAPTER_BY_ID.has(chapterId)) return { name: 'read', chapterId }
  }
  if (path.startsWith('exam/')) {
    const examId = safeDecodeRouteSegment(path.slice(5))
    if (examId && examDefinition(examId)) return { name: 'exam', examId }
  }
  return { name: 'map' }
}

export function rawViewFromHash(): AppView {
  return parseHash()
}

/** Send a URL that the learner is not allowed to open back to a legal screen. */
export function resolveView(view: AppView, state: GhesseState): AppView {
  if (view.name === 'read') {
    if (!canOpenChapter(state, view.chapterId)) return { name: 'map' }
    if (!canOpenStory(state, view.chapterId)) return { name: 'prep', chapterId: view.chapterId }
  }
  if (view.name === 'prep') {
    if (!canOpenChapter(state, view.chapterId)) return { name: 'map' }
    // A prepared chapter goes straight to its story; explore mode may revisit its words.
    if (!state.exploreAll && canReadChapter(state, view.chapterId)) return { name: 'read', chapterId: view.chapterId }
  }
  if (view.name === 'diagnostic') {
    // Prove-known is only for the learner's actual next chapter, never an
    // Explore preview. After a first miss, this session must use teaching.
    if (!canPrepareChapter(state, view.chapterId)) return { name: 'map' }
    if (canReadChapter(state, view.chapterId)) return { name: 'read', chapterId: view.chapterId }
    if (diagnosticFailed(view.chapterId)) return { name: 'prep', chapterId: view.chapterId }
  }
  if (view.name === 'exam' && !canOpenExam(state, view.examId)) return { name: 'map' }
  return view
}

export function hashFor(view: AppView): string {
  if (view.name === 'prep') return `#/prep/${encodeURIComponent(view.chapterId)}`
  if (view.name === 'diagnostic') return `#/diagnostic/${encodeURIComponent(view.chapterId)}`
  if (view.name === 'read') return `#/read/${encodeURIComponent(view.chapterId)}`
  if (view.name === 'review') return '#/review'
  if (view.name === 'exam') return `#/exam/${encodeURIComponent(view.examId)}`
  if (view.name === 'glossary') return '#/glossary'
  if (view.name === 'flashcards') return '#/flashcards'
  if (view.name === 'offline-audio') return '#/offline-audio'
  if (view.name === 'settings') return '#/settings'
  return '#/map'
}

export function viewLabel(view: AppView): string {
  if (view.name === 'prep') {
    const chapter = CHAPTER_BY_ID.get(view.chapterId)
    return chapter ? `آمادگی فصل: ${chapter.titleFa}` : 'آمادگی فصل'
  }
  if (view.name === 'diagnostic') {
    const chapter = CHAPTER_BY_ID.get(view.chapterId)
    return chapter ? `تعیین سطح فصل: ${chapter.titleFa}` : 'تعیین سطح فصل'
  }
  if (view.name === 'read') {
    const chapter = CHAPTER_BY_ID.get(view.chapterId)
    return chapter ? `خواندن داستان: ${chapter.titleFa}` : 'خواندن داستان'
  }
  if (view.name === 'review') return 'مرور هوشمند'
  if (view.name === 'exam') return examDefinition(view.examId)?.titleFa ?? 'آزمون'
  if (view.name === 'glossary') return 'واژه‌نامه'
  if (view.name === 'flashcards') return 'جعبهٔ لایتنر'
  if (view.name === 'offline-audio') return 'صدای آفلاین'
  if (view.name === 'settings') return 'تنظیمات'
  return 'مسیر یادگیری'
}
