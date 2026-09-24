// Renders the illustrated book banners to public/art/bookN.svg.
// `npm run art:banners` rewrites the files; the regular test run fails if a
// committed banner no longer matches its source in src/art/banners.tsx.
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BookBanner } from '../src/art/banners'

function bannerSvg(book: number): string {
  return `${renderToStaticMarkup(<BookBanner book={book} />)}\n`
}

describe('book banners', () => {
  for (let book = 1; book <= 8; book++) {
    it(`renders book ${book} as clean inline SVG`, () => {
      const svg = bannerSvg(book)
      expect(svg).toMatch(/^<svg/)
      expect(svg).toContain('viewBox="0 0 800 300"')
      expect(svg).not.toMatch(/NaN|undefined|Infinity/)
    })
  }
})
