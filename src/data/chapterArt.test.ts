import { describe, expect, it } from 'vitest'
import { CHAPTERS } from './chapters'
import { CHAPTER_ART } from './chapterArt'

describe('chapter artwork registry', () => {
  it('covers every chapter exactly once with no stale scene ids', () => {
    const chapterIds = CHAPTERS.map(chapter => chapter.id).sort()
    const artIds = Object.keys(CHAPTER_ART).sort()

    expect(chapterIds).toHaveLength(40)
    expect(artIds).toEqual(chapterIds)
  })

  it('uses complete scene definitions for every chapter', () => {
    for (const chapter of CHAPTERS) {
      const scene = CHAPTER_ART[chapter.id]
      expect(scene, chapter.id).toBeDefined()
      expect(scene.primary, `${chapter.id}: primary motif`).toBeTruthy()
      expect(scene.detail, `${chapter.id}: detail motif`).toBeTruthy()

      for (const [field, value] of Object.entries({
        sky: scene.sky,
        ground: scene.ground,
        accent: scene.accent,
        secondary: scene.secondary,
      })) {
        expect(value, `${chapter.id}: ${field}`).toMatch(/^#[0-9a-f]{6}$/i)
      }
    }
  })
})
