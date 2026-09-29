import fs from 'node:fs'
import path from 'node:path'

const root = new URL('..', import.meta.url).pathname
const status = JSON.parse(fs.readFileSync(path.join(root, 'quality/best-in-class-status.json'), 'utf8'))
const reportOnly = process.argv.includes('--report')
const incomplete = Object.entries(status.gates).filter(([, gate]) => gate.status !== 'complete')

for (const [name, gate] of Object.entries(status.gates)) {
  console.log((gate.status === 'complete' ? 'PASS' : gate.status.toUpperCase()) + ': ' + name + ' — ' + gate.note)
}

if (!reportOnly && incomplete.length) {
  throw new Error('Best-in-class claim is not yet evidence-complete: ' + incomplete.map(([name]) => name).join(', '))
}
