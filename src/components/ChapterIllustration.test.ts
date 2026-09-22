import { describe, expect, it } from 'vitest'
import { CHAPTERS } from '../data/chapters'
import { CHAPTER_ART } from '../data/chapterArt'

describe('chapter-specific reader artwork', () => {
  it('covers every chapter and contains no orphan scene', () => {
    const chapterIds = CHAPTERS.map(chapter => chapter.id).sort()
    const artIds = Object.keys(CHAPTER_ART).sort()
    expect(artIds).toEqual(chapterIds)
  })

  it('gives every chapter a distinct visual signature', () => {
    const signatures = CHAPTERS.map(chapter => {
      const scene = CHAPTER_ART[chapter.id]
      return [
        scene.primary,
        scene.detail,
        scene.sky,
        scene.ground,
        scene.accent,
        scene.secondary,
        scene.night === true ? 'night' : 'day',
      ].join('|')
    })
    expect(new Set(signatures).size).toBe(CHAPTERS.length)
  })

  it('keeps illustrations free of chapter text and overlay labels', () => {
    for (const scene of Object.values(CHAPTER_ART)) {
      const keys = Object.keys(scene)
      expect(keys).not.toContain('title')
      expect(keys).not.toContain('label')
      expect(keys).not.toContain('text')
      expect(scene.primary).toBeTruthy()
      expect(scene.detail).toBeTruthy()
    }
  })
})
