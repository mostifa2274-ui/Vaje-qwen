const CACHE = 'ghesse-5.0.0-vector'
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg'
]

async function precacheShell() {
  const cache = await caches.open(CACHE)
  await cache.addAll(CORE)
  // Vite fingerprints JS/CSS/font assets. Discover the generated shell assets
  // from the built HTML so a freshly installed PWA can open offline without
  // requiring a second online reload.
  try {
    const response = await fetch('./index.html', { cache: 'no-store' })
    if (!response.ok) return
    const html = await response.text()
    const urls = new Set()
    for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
      const value = match[1]
      if (!value || value.startsWith('data:') || value.startsWith('http:') || value.startsWith('https:')) continue
      urls.add(new URL(value, self.registration.scope).href)
    }
    await Promise.all([...urls].map(async url => {
      try { await cache.add(url) } catch { /* optional asset; runtime caching remains available */ }
    }))
  } catch {
    // CORE still provides the offline document and brand assets.
  }
}

self.addEventListener('install', event => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

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
