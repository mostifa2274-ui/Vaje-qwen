import { describe, expect, it } from 'vitest'
import { CHAPTERS, WORD_BY_ID } from '../data/chapters'
import { CHAPTER_LISTENING } from '../data/chapterListening'
import { EXAM_TEST_CONTENT } from '../data/examTests'
import { clipId } from './audioClips'
import { bookAudioUrls } from './offlineAudio'

function hasClip(urls: readonly string[], kind: 'w' | 's', text: string): boolean {
  return urls.some(url => url.endsWith('/audio/' + clipId(kind, text) + '.mp3'))
}

describe('offline recorded-audio packs', () => {
  it('covers each book with unique content-addressed audio URLs', () => {
    for (let book = 1; book <= 8; book++) {
      const urls = bookAudioUrls(book)
      expect(urls.length).toBeGreaterThan(0)
      expect(new Set(urls).size).toBe(urls.length)
      expect(urls.every(url => url.endsWith('.mp3'))).toBe(true)
    }
  })

  it('includes teaching, story and chapter-listening audio', () => {
    const chapter = CHAPTERS.find(item => item.book === 1)!
    const word = WORD_BY_ID.get(chapter.new[0])!
    const listening = CHAPTER_LISTENING.get(chapter.id)!
    const urls = bookAudioUrls(1)

    expect(hasClip(urls, 'w', word.word)).toBe(true)
    expect(hasClip(urls, 's', word.ex)).toBe(true)
    expect(hasClip(urls, 's', chapter.sentences[0].en)).toBe(true)
    expect(hasClip(urls, 's', listening.sentences[0].en)).toBe(true)
  })

  it('adds the cumulative listening exam only at its gate book', () => {
    const midpointSentence = EXAM_TEST_CONTENT.get('midpoint')!.listening[0].sentences[0].en
    const finalSentence = EXAM_TEST_CONTENT.get('final')!.listening[0].sentences[0].en

    expect(hasClip(bookAudioUrls(3), 's', midpointSentence)).toBe(false)
    expect(hasClip(bookAudioUrls(4), 's', midpointSentence)).toBe(true)
    expect(hasClip(bookAudioUrls(7), 's', finalSentence)).toBe(false)
    expect(hasClip(bookAudioUrls(8), 's', finalSentence)).toBe(true)
  })
})
