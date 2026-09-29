import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const headers = readFileSync(join(root, 'public/_headers'), 'utf8')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const requiredHeaders = [
  'X-Content-Type-Options: nosniff',
  'Referrer-Policy: no-referrer',
  'X-Frame-Options: DENY',
  'Cross-Origin-Opener-Policy: same-origin',
  'Cross-Origin-Resource-Policy: same-origin',
  'Permissions-Policy:',
  'Content-Security-Policy:',
]
for (const header of requiredHeaders) {
  assert(headers.includes(header), `missing production security header: ${header}`)
}

const cspLine = headers.split(/\r?\n/).find(line => line.trim().startsWith('Content-Security-Policy:'))
assert(cspLine, 'Content-Security-Policy header is missing')
const csp = cspLine.slice(cspLine.indexOf(':') + 1).trim()

const requiredDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "font-src 'self' data:",
  "manifest-src 'self'",
  "worker-src 'self'",
  'upgrade-insecure-requests',
]
for (const directive of requiredDirectives) {
  assert(csp.includes(directive), `CSP is missing required directive: ${directive}`)
}

assert(!/script-src[^;]*['"]unsafe-inline['"]/.test(csp), 'scripts must never allow unsafe-inline')
assert(!/script-src[^;]*['"]unsafe-eval['"]/.test(csp), 'scripts must never allow unsafe-eval')
assert(!/(?:default|script|connect|media|img|worker)-src[^;]*\*/.test(csp), 'security-sensitive CSP sources must not use a wildcard')
assert(/microphone=\(self\)/.test(headers), 'microphone permission must remain same-origin for optional local pronunciation practice')
assert(!/camera=\(self\)/.test(headers), 'camera permission must remain disabled')

console.log('Production static-asset security headers validated.')
