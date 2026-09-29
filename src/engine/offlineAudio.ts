import { BOOK_TEST_CONTENT } from '../data/bookTests'
import { CHAPTER_LISTENING } from '../data/chapterListening'
import { CHAPTERS, WORD_BY_ID } from '../data/chapters'
import { EXAM_TEST_CONTENT } from '../data/examTests'
import { clipUrl } from './audioClips'

export const OFFLINE_AUDIO_CACHE = 'ghesse-audio-v1'

export interface OfflineAudioProgress {
  done: number
  total: number
  failed: number
}

export interface OfflineBookStatus extends OfflineAudioProgress {
  book: number
  supported: boolean
  ready: boolean
}

function absoluteUrl(url: string): string {
  const base = typeof document !== 'undefined'
    ? document.baseURI
    : typeof location !== 'undefined'
      ? location.href
      : 'https://ghesse.invalid/'
  return new URL(url, base).href
}

function addSentenceAudio(target: Set<string>, sentences: readonly { en: string }[]): void {
  for (const sentence of sentences) target.add(absoluteUrl(clipUrl('s', sentence.en)))
}

/**
 * Recorded audio needed to learn and assess one book offline. Reading-test
 * passages are intentionally omitted because they are read, not played.
 */
export function bookAudioUrls(book: number): string[] {
  const urls = new Set<string>()
  const chapters = CHAPTERS.filter(chapter => chapter.book === book)

  for (const chapter of chapters) {
    for (const id of chapter.new) {
      const word = WORD_BY_ID.get(id)
      if (!word) continue
      urls.add(absoluteUrl(clipUrl('w', word.word)))
      urls.add(absoluteUrl(clipUrl('s', word.ex)))
    }
    addSentenceAudio(urls, chapter.sentences)
    const listening = CHAPTER_LISTENING.get(chapter.id)
    if (listening) addSentenceAudio(urls, listening.sentences)
  }

  const bookTest = BOOK_TEST_CONTENT.get(book)
  if (bookTest) {
    for (const text of bookTest.listening) addSentenceAudio(urls, text.sentences)
  }

  if (book === 4) {
    const midpoint = EXAM_TEST_CONTENT.get('midpoint')
    if (midpoint) for (const text of midpoint.listening) addSentenceAudio(urls, text.sentences)
  }
  if (book === 8) {
    const final = EXAM_TEST_CONTENT.get('final')
    if (final) for (const text of final.listening) addSentenceAudio(urls, text.sentences)
  }

  return [...urls]
}

export function offlineAudioSupported(): boolean {
  return typeof caches !== 'undefined' && typeof fetch !== 'undefined'
}

async function cachedUrlSet(): Promise<Set<string>> {
  if (!offlineAudioSupported()) return new Set()
  const cache = await caches.open(OFFLINE_AUDIO_CACHE)
  return new Set((await cache.keys()).map(request => request.url))
}

export async function offlineBookStatus(book: number): Promise<OfflineBookStatus> {
  const urls = bookAudioUrls(book)
  if (!offlineAudioSupported()) {
    return { book, supported: false, ready: false, done: 0, total: urls.length, failed: 0 }
  }
  const cached = await cachedUrlSet()
  const done = urls.filter(url => cached.has(url)).length
  return {
    book,
    supported: true,
    ready: urls.length > 0 && done === urls.length,
    done,
    total: urls.length,
    failed: 0,
  }
}

function responseIsFullAudio(response: Response): boolean {
  if (!response.ok || response.status !== 200 || response.headers.has('content-range')) return false
  return !(response.headers.get('content-type') || '').includes('text/html')
}

export async function cacheBookAudio(
  book: number,
  onProgress?: (progress: OfflineAudioProgress) => void,
  signal?: AbortSignal,
): Promise<OfflineBookStatus> {
  const urls = bookAudioUrls(book)
  if (!offlineAudioSupported()) {
    return { book, supported: false, ready: false, done: 0, total: urls.length, failed: urls.length }
  }

  const cache = await caches.open(OFFLINE_AUDIO_CACHE)
  const existing = new Set((await cache.keys()).map(request => request.url))
  let done = urls.filter(url => existing.has(url)).length
  let failed = 0
  let cursor = 0

  onProgress?.({ done, total: urls.length, failed })

  async function worker() {
    while (cursor < urls.length) {
      if (signal?.aborted) return
      const index = cursor++
      const url = urls[index]
      if (existing.has(url)) continue

      try {
        const response = await fetch(url, {
          cache: 'no-cache',
          credentials: 'same-origin',
          signal,
        })
        if (!responseIsFullAudio(response)) {
          failed++
        } else {
          await cache.put(url, response.clone())
          existing.add(url)
          done++
        }
      } catch {
        if (!signal?.aborted) failed++
      }
      onProgress?.({ done, total: urls.length, failed })
    }
  }

  await Promise.all(Array.from({ length: Math.min(4, Math.max(1, urls.length)) }, () => worker()))

  return {
    book,
    supported: true,
    ready: urls.length > 0 && done === urls.length,
    done,
    total: urls.length,
    failed,
  }
}

export async function clearOfflineAudio(): Promise<void> {
  if (!offlineAudioSupported()) return
  await caches.delete(OFFLINE_AUDIO_CACHE)
}

export async function offlineAudioStorageEstimate(): Promise<{ usage?: number; quota?: number }> {
  try {
    return await navigator.storage?.estimate?.() ?? {}
  } catch {
    return {}
  }
}
