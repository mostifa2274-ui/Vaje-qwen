// Renders the illustrated book banners to public/art/bookN.svg.
// `npm run art:banners` rewrites the files; the regular test run fails if a
// committed banner no longer matches its source in src/art/banners.tsx.
import { describe, expect, it } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { BookBanner } from '../src/art/banners'

const write = process.env.GHESSE_WRITE_ART === '1'

function bannerSvg(book: number): string {
  return `${renderToStaticMarkup(<BookBanner book={book} />)}\n`
}

describe('book banners', () => {
  for (let book = 1; book <= 8; book++) {
    it(`public/art/book${book}.svg matches its drawing`, () => {
      const target = new URL(`../public/art/book${book}.svg`, import.meta.url)
      const svg = bannerSvg(book)
      expect(svg).not.toMatch(/NaN|undefined|Infinity/)
      if (write) writeFileSync(target, svg)
      expect(readFileSync(target, 'utf8')).toBe(svg)
    })
  }
})
