const CACHE = 'ghesse-shell-__GHESSE_BUILD_CACHE__'
const BUILD_ASSETS = __GHESSE_BUILD_ASSETS__
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './art/book1.svg',
  './art/book2.svg',
  './art/book3.svg',
  './art/book4.svg',
  './art/book5.svg',
  './art/book6.svg',
  './art/book7.svg',
  './art/book8.svg'
]

async function precacheShell() {
  const cache = await caches.open(CACHE)
  // BUILD_ASSETS is stamped from the exact Vite output after build. This keeps
  // route-level lazy chunks and fonts available on a first-install offline run.
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

  if (url.pathname.endsWith('/release.json')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .catch(() => new Response('', { status: 503, statusText: 'Offline' }))
    )
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone()
          void caches.open(CACHE).then(cache => cache.put(request, copy))
          return response
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('./index.html')) || (await caches.match('./')))
    )
    return
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone()
          void caches.open(CACHE).then(cache => cache.put(request, copy))
        }
        return response
      })
    })
  )
})
