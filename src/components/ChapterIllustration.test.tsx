import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CHAPTERS } from '../data/chapters'
import { GENERATED_CHAPTER_ART } from '../art/generatedChapterArt'
import ChapterIllustration from './ChapterIllustration'

function render(chapterId: string, titleFa = 'عنوان'): string {
  return renderToStaticMarkup(<ChapterIllustration chapterId={chapterId} titleFa={titleFa} />)
}

describe('chapter illustrations', () => {
  it('has one reviewed image for every chapter and no orphan images', () => {
    expect(Object.keys(GENERATED_CHAPTER_ART).sort()).toEqual(CHAPTERS.map(chapter => chapter.id).sort())
  })

  it('describes every picture in Persian for screen readers', () => {
    const descriptions = Object.values(GENERATED_CHAPTER_ART).map(art => art.altFa)
    for (const alt of descriptions) {
      expect(alt.length).toBeGreaterThan(40)
      expect(alt).toMatch(/[؀-ۿ]/)
    }
    expect(new Set(descriptions).size).toBe(descriptions.length)
  })

  it('renders each reviewed image at the 40:21 production size', () => {
    for (const chapter of CHAPTERS) {
      const art = GENERATED_CHAPTER_ART[chapter.id]
      const markup = render(chapter.id, chapter.titleFa)
      expect(markup, chapter.id).toContain('<img')
      expect(markup, chapter.id).toContain(`src="${art.src}"`)
      expect(markup, chapter.id).toContain(art.altFa)
      expect(markup, chapter.id).toContain('width="640"')
      expect(markup, chapter.id).toContain('height="336"')
      expect(art.src, chapter.id).toMatch(new RegExp(`art/chapters/${chapter.id}\\.(?:avif|webp)$`))
    }
  })

  it('falls back to a labelled chick, never a cat, for an unknown chapter', () => {
    const markup = render('missing', 'فصل گم‌شده')
    expect(markup).toContain('role="img"')
    expect(markup).toContain('فصل گم‌شده')
    expect(markup).toContain('🐥')
  })
})
