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

  it('never uses text-bearing data in the scene definition', () => {
    for (const scene of Object.values(CHAPTER_ART)) {
      expect(Object.keys(scene).sort()).toEqual(
        ['accent', 'detail', 'ground', 'night', 'primary', 'secondary', 'sky'].filter(key => key !== 'night' || scene.night !== undefined).sort(),
      )
    }
  })
})
