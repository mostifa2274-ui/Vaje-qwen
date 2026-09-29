import { readFileSync } from 'node:fs'

const status = JSON.parse(readFileSync(new URL('../quality/best-in-class-status.json', import.meta.url), 'utf8'))
const reportOnly = process.argv.includes('--report')
const incomplete = Object.entries(status.gates).filter(([, gate]) => gate.status !== 'complete')

for (const [name, gate] of Object.entries(status.gates)) {
  console.log(`${gate.status === 'complete' ? 'PASS' : gate.status.toUpperCase()}: ${name} — ${gate.evidence}`)
}

if (!reportOnly && incomplete.length > 0) {
  throw new Error(`Best-in-class evidence is incomplete: ${incomplete.map(([name]) => name).join(', ')}`)
}
