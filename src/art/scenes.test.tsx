import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CHAPTERS } from '../data/chapters'
import { CHAPTER_SCENES } from './scenes'
import ChapterIllustration from '../components/ChapterIllustration'
import { GENERATED_CHAPTER_ART } from './generatedChapterArt'

function render(chapterId: string): string {
  const chapter = CHAPTERS.find(item => item.id === chapterId)!
  return renderToStaticMarkup(<ChapterIllustration chapterId={chapter.id} titleFa={chapter.titleFa} />)
}

describe('chapter illustrations', () => {
  it('draws one scene for every chapter and no orphan scenes', () => {
    expect(Object.keys(CHAPTER_SCENES).sort()).toEqual(CHAPTERS.map(chapter => chapter.id).sort())
  })

  it('describes every picture in Persian for screen readers', () => {
    const descriptions = Object.values(CHAPTER_SCENES).map(scene => scene.alt)
    for (const alt of descriptions) {
      expect(alt.length).toBeGreaterThan(40)
      expect(alt).toMatch(/[؀-ۿ]/)
    }
    expect(new Set(descriptions).size).toBe(descriptions.length)
  })

  it('renders reviewed generated images and clean SVG fallbacks', () => {
    for (const chapter of CHAPTERS) {
      const markup = render(chapter.id)
      const generated = GENERATED_CHAPTER_ART[chapter.id]
      if (generated) {
        expect(markup, chapter.id).toContain('<img')
        expect(markup, chapter.id).toContain(generated.src)
        expect(markup, chapter.id).toContain(generated.altFa)
        expect(markup, chapter.id).toContain('width="640"')
        expect(markup, chapter.id).toContain('height="336"')
        continue
      }

      expect(markup, chapter.id).toMatch(/^<svg[^>]*role="img"/)
      expect(markup, chapter.id).toContain(CHAPTER_SCENES[chapter.id].alt)
      expect(markup, chapter.id).not.toMatch(/NaN|undefined|Infinity/)
      const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map(match => match[1])
      expect(new Set(ids).size, `${chapter.id} duplicate ids`).toBe(ids.length)
      for (const [, ref] of markup.matchAll(/url\(#([^)]+)\)/g)) {
        expect(ids, `${chapter.id} references #${ref}`).toContain(ref)
      }
    }
  })

  it('keeps Nino faithful to the story wherever he appears', () => {
    // Nino is a tiny yellow chicken with an orange beak and one white wing feather.
    for (const id of ['b1c1', 'b3c5', 'b4c5', 'b8c6']) {
      if (GENERATED_CHAPTER_ART[id]) continue
      const svg = render(id)
      expect(svg, id).toContain('#f3c84b')
      expect(svg, id).toContain('#e8892f')
      expect(svg, id).toContain('#f7f3e8')
    }
  })
})
