import fs from 'node:fs'
import path from 'node:path'

const root = new URL('..', import.meta.url).pathname
const budget = JSON.parse(fs.readFileSync(path.join(root, 'quality/performance-budget.json'), 'utf8'))
const assets = path.join(root, 'dist/assets')

if (!fs.existsSync(assets)) throw new Error('dist/assets is missing; run the production build first')

const files = fs.readdirSync(assets)
  .filter(file => /\.(?:js|css)$/.test(file))
  .map(file => ({ file, bytes: fs.statSync(path.join(assets, file)).size }))

const js = files.filter(item => item.file.endsWith('.js'))
const largestJs = js.reduce((largest, item) => item.bytes > largest.bytes ? item : largest, { file: '', bytes: 0 })
const total = files.reduce((sum, item) => sum + item.bytes, 0)

if (largestJs.bytes > budget.maxSingleJavaScriptBytes) {
  throw new Error('Largest JS chunk ' + largestJs.file + ' is ' + largestJs.bytes + ' bytes; budget is ' + budget.maxSingleJavaScriptBytes)
}
if (total > budget.maxTotalJavaScriptCssBytes) {
  throw new Error('Total JS+CSS is ' + total + ' bytes; budget is ' + budget.maxTotalJavaScriptCssBytes)
}

console.log('Performance budget passed: largest JS ' + largestJs.bytes + ' B; total JS+CSS ' + total + ' B')
