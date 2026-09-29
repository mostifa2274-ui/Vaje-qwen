import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const dist = join(root, 'dist')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) out.push(...walk(full))
    else out.push({ path: relative(dist, full).replaceAll('\\', '/'), bytes: stat.size })
  }
  return out
}

function kib(bytes) {
  return (bytes / 1024).toFixed(1)
}

assert(existsSync(dist), 'dist/ must exist before bundle-budget validation')
const files = walk(dist)
const js = files.filter(file => file.path.endsWith('.js'))
const css = files.filter(file => file.path.endsWith('.css'))
const chapterArt = files.filter(file => /^art\/chapters\/.+\.(?:avif|webp|png|jpg|jpeg)$/i.test(file.path))

assert(js.length > 0, 'production build must contain JavaScript assets')
assert(css.length > 0, 'production build must contain CSS assets')
assert(chapterArt.length >= 40, 'production build must contain all reviewed chapter artwork')

const totalJs = js.reduce((sum, file) => sum + file.bytes, 0)
const largestJs = Math.max(...js.map(file => file.bytes))
const totalCss = css.reduce((sum, file) => sum + file.bytes, 0)
const totalChapterArt = chapterArt.reduce((sum, file) => sum + file.bytes, 0)

const budgets = {
  largestJs: 700 * 1024,
  totalJs: 1_800 * 1024,
  totalCss: 180 * 1024,
  chapterArt: 3_750 * 1024,
}

assert(largestJs <= budgets.largestJs, `largest JS chunk is ${kib(largestJs)} KiB; budget is ${kib(budgets.largestJs)} KiB`)
assert(totalJs <= budgets.totalJs, `total JS is ${kib(totalJs)} KiB; budget is ${kib(budgets.totalJs)} KiB`)
assert(totalCss <= budgets.totalCss, `total CSS is ${kib(totalCss)} KiB; budget is ${kib(budgets.totalCss)} KiB`)
assert(totalChapterArt <= budgets.chapterArt, `chapter artwork is ${kib(totalChapterArt)} KiB; budget is ${kib(budgets.chapterArt)} KiB`)

const largest = [...js].sort((a, b) => b.bytes - a.bytes)[0]
console.log([
  'Production size budgets passed.',
  `largest JS: ${largest.path} ${kib(largest.bytes)} KiB`,
  `all JS: ${kib(totalJs)} KiB`,
  `all CSS: ${kib(totalCss)} KiB`,
  `chapter artwork: ${kib(totalChapterArt)} KiB across ${chapterArt.length} files`,
].join('\n'))
