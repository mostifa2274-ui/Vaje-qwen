const CACHE = 'ghesse-shell-__GHESSE_BUILD_CACHE__'
const BUILD_ASSETS = __GHESSE_BUILD_ASSETS__
// The shell is cached under './' only: Cloudflare redirects /index.html to /,
// and a redirected response cannot answer a navigation.
const CORE = [
  './',
  './manifest.webmanifest',
  './icons/icon.svg'
]

/**
 * Whether a network response may be stored for offline use. Error pages, and
 * an HTML page answering a request for a script, style, image or clip, must
 * never be served from the cache in place of the real file.
 */
function cacheable(request, response) {
  if (!response.ok || response.type === 'opaque') return false
  const html = (response.headers.get('content-type') || '').includes('text/html')
  return request.mode === 'navigate' || !html
}

/** A copy of a cached response that can answer a navigation. */
function navigable(response) {
  if (!response || !response.redirected) return response
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers })
}

async function precacheShell() {
  const cache = await caches.open(CACHE)
  // BUILD_ASSETS is stamped from the exact production output after build. It
  // includes lazy Vite chunks and every reviewed chapter illustration, so a
  // first-install offline session never falls back to obsolete artwork.
  await cache.addAll([...CORE, ...BUILD_ASSETS])
}

self.addEventListener('install', event => {
  // Let an existing worker keep controlling its open tabs. Their entry bundle
  // may still request lazy chunks from the old cache after a new deploy.
  // The installed update activates once those tabs close or reload.
  event.waitUntil(precacheShell())
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('ghesse-shell-') && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // Media elements fetch narration clips with Range requests, which a cached
  // full response cannot answer reliably (notably on Safari). The browser's
  // own HTTP cache handles them, and offline the app falls back to the
  // device's English voice.
  if (url.pathname.includes('/audio/') && url.pathname.endsWith('.mp3')) return

  if (url.pathname.endsWith('/release.json')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .catch(() => new Response('', { status: 503, statusText: 'Offline' }))
    )
    return
  }

  // Reviewed artwork and the narration catalogue keep stable public URLs
  // across releases. Revalidate them online so an older controlling worker
  // cannot pin stale content after a deploy, while keeping a cached copy for
  // offline use.
  if (url.pathname.includes('/art/chapters/') || url.pathname.endsWith('/audio/index.json')) {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then(response => {
          if (cacheable(request, response)) {
            const copy = response.clone()
            void caches.open(CACHE).then(cache => cache.put(request, copy))
          }
          return response
        })
        .catch(async () => (await caches.match(request)) || new Response('', { status: 503, statusText: 'Offline' }))
    )
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Never let an error page (a 404 or a transient 5xx) replace the
          // cached shell that offline launches fall back to.
          if (cacheable(request, response)) {
            const copy = response.clone()
            void caches.open(CACHE).then(cache => cache.put(request, copy))
          }
          return response
        })
        // Any launch URL (a query string, an old /index.html bookmark) falls
        // back to the one cached shell.
        .catch(async () => navigable((await caches.match(request, { ignoreSearch: true })) || (await caches.match('./'))))
    )
    return
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(response => {
        if (cacheable(request, response)) {
          const copy = response.clone()
          void caches.open(CACHE).then(cache => cache.put(request, copy))
        }
        return response
      })
    })
  )
})
