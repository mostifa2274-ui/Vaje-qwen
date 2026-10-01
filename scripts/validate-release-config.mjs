import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const directWorkflow = readFileSync(join(root, '.github/workflows/deploy-production.yml'), 'utf8')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(pkg.scripts?.['cloudflare:build'] === 'npm run check', 'Cloudflare build must run quality checks')
assert(pkg.scripts?.check?.includes('npm run build'), 'quality checks must create dist for Wrangler')
assert(pkg.scripts?.deploy?.includes('npm run cloudflare:build'), 'deploy must build before Wrangler')
assert(
  directWorkflow.includes('npm run build') && directWorkflow.includes('npm run validate:bundle-budget') && directWorkflow.includes('npx wrangler@4.135.0 deploy'),
  'the direct workflow must build, enforce bundle budgets, then deploy',
)
assert(!pkg.scripts?.['release:check'], 'obsolete content-rights deployment gate must be removed')

// Hash routing needs no SPA fallback; a missing script or clip must be a real
// 404, never index.html with 200 that a cache could keep in its place.
const wrangler = JSON.parse(readFileSync(join(root, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, ''))
assert(wrangler.assets?.directory === './dist', 'Wrangler must publish dist/')
assert(wrangler.assets?.not_found_handling === '404-page', 'missing assets must return the 404 page, not the app shell')
assert(existsSync(join(root, 'public/404.html')), 'public/404.html must exist for 404-page handling')
const missingPage = readFileSync(join(root, 'public/404.html'), 'utf8')
assert(missingPage.includes('./#/map') && missingPage.includes('background: #040a12'), '404 page must return to the home route with the boot-screen theme color')
const webManifest = JSON.parse(readFileSync(join(root, 'public/manifest.webmanifest'), 'utf8'))
assert(webManifest.id === './', 'PWA manifest must keep a stable app identity')
assert(webManifest.start_url === './#/map', 'installed app must launch on the calm home route')
assert(webManifest.scope === './' && webManifest.display === 'standalone', 'PWA manifest must stay scoped and standalone')
assert(Array.isArray(webManifest.display_override) && webManifest.display_override[0] === 'standalone', 'PWA must declare a current display_override chain that still prefers standalone')
assert(webManifest.launch_handler?.client_mode === 'navigate-existing', 'reopening the installed app must reuse the existing window')
assert(webManifest.lang === 'fa' && webManifest.dir === 'rtl', 'PWA install metadata must remain Persian-first RTL')
assert(
  typeof webManifest.description === 'string'
    && webManifest.description.includes('یادگیری عمیق و ماندگار')
    && !webManifest.description.includes('تسلط بر'),
  'PWA description must stay inside the evidence-bounded learning claim',
)
const shortcutUrls = new Set((webManifest.shortcuts ?? []).map(shortcut => shortcut?.url))
for (const requiredShortcut of ['./#/review', './#/glossary']) {
  assert(shortcutUrls.has(requiredShortcut), `PWA manifest must keep useful shortcut ${requiredShortcut}`)
}
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8')
assert(indexHtml.includes('name="apple-mobile-web-app-capable" content="yes"'), 'iOS installed-app metadata must remain enabled')
assert(indexHtml.includes('background: #040a12') && indexHtml.includes('class="boot-screen"'), 'index.html must paint the boot screen before the app stylesheet loads')
assert(!indexHtml.includes('تسلط بر ۸۹۹ واژه'), 'HTML metadata must not overclaim externally validated mastery')
const appShell = readFileSync(join(root, 'src/App.tsx'), 'utf8')
assert(appShell.includes('aria-label="به‌روزرسانی برنامه"'), 'update banner must have an accessible name')
assert(appShell.includes('aria-label="تازه‌سازی و بارگذاری نسخهٔ جدید"'), 'update action must say it loads the new build')
assert(appShell.includes('aria-label="بعداً این نسخه را تازه کن"'), 'defer action must stay an update choice, not a generic later')
const homeCss = readFileSync(join(root, 'src/index.css'), 'utf8')
assert(homeCss.includes('.next-action-card > .btn-crimson'), 'the home primary must be a full-width thumb target on small screens')

const headers = readFileSync(join(root, 'public/_headers'), 'utf8')
for (const required of [
  "Content-Security-Policy: frame-ancestors 'none'",
  'X-Frame-Options: DENY',
  'X-Content-Type-Options: nosniff',
  'Referrer-Policy: no-referrer',
  'Permissions-Policy:',
  'microphone=(self)',
]) {
  assert(headers.includes(required), `public/_headers must send ${required}`)
}
assert(/\/assets\/\*\s*\n\s*Cache-Control: public, max-age=31536000, immutable/.test(headers), 'hashed assets must be cached as immutable')
const viteConfig = readFileSync(join(root, 'vite.config.ts'), 'utf8')
assert(viteConfig.includes('contentSecurityPolicy()') && viteConfig.includes("script-src 'self'"), 'the build must add the Content-Security-Policy')
assert(viteConfig.includes("media-src 'self' blob:"), 'local pronunciation playback must be allowed without opening media to remote origins')
assert(!/unsafe-(?:inline|eval)/.test(viteConfig), 'the Content-Security-Policy must not allow unsafe-inline or unsafe-eval')
assert(!directWorkflow.includes('GHESSE_RIGHTS_CONFIRMED'), 'direct workflow must not require the old rights flag')

const primaryWaitStart = directWorkflow.indexOf('- name: Wait for Cloudflare Git deployment')
const credentialsStart = directWorkflow.indexOf('- name: Check direct-deploy credentials')
const finalVerifyStart = directWorkflow.indexOf('- name: Verify exact production revision')
assert(primaryWaitStart >= 0 && credentialsStart > primaryWaitStart && finalVerifyStart > credentialsStart, 'production deployment workflow step order is malformed')
const primaryWaitStep = directWorkflow.slice(primaryWaitStart, credentialsStart)
const finalVerifyStep = directWorkflow.slice(finalVerifyStart)
assert(
  !primaryWaitStep.includes('steps.primary.outputs') && !primaryWaitStep.includes('steps.cloudflare.outputs'),
  'primary Cloudflare wait must not read self/future step outputs before they exist',
)
assert(
  finalVerifyStep.includes('steps.primary.outputs.needs_deploy')
    && finalVerifyStep.includes('steps.cloudflare.outputs.configured')
    && finalVerifyStep.includes('max_attempts=96')
    && finalVerifyStep.includes('if [ "$attempt" -lt "$max_attempts" ]; then sleep 5; fi'),
  'final production verification must extend and pace polling when the primary deploy is stale and direct fallback credentials are unavailable',
)
assert(
  finalVerifyStep.includes('Cloudflare Git integration (late convergence)')
    && finalVerifyStep.includes('steps.cloudflare.outputs.configured }}" = "true"'),
  'deployment evidence must distinguish direct Wrangler fallback from late Cloudflare convergence',
)

const serviceWorker = readFileSync(join(root, 'public/sw.js'), 'utf8')
const offlineAudio = readFileSync(join(root, 'src/engine/offlineAudio.ts'), 'utf8')
assert(serviceWorker.includes("const AUDIO_CACHE = 'ghesse-audio-v1'"), 'service worker must keep the dedicated offline-audio cache')
assert(offlineAudio.includes("OFFLINE_AUDIO_CACHE = 'ghesse-audio-v1'"), 'client and service worker must agree on the offline-audio cache name')
assert(
  serviceWorker.includes('offlineAudioResponse(request)')
    && serviceWorker.includes('status: 206')
    && serviceWorker.includes("'Content-Range'"),
  'downloaded MP3s must support byte-range playback from the service worker',
)
console.log('Deployment configuration validated; content-rights product gate is removed and is not a build gate.')
