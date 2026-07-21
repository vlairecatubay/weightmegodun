// WeightMeGodun service worker
// Caches the app shell so the app still opens (with whatever was last logged)
// even without a network connection. Your data itself lives in localStorage,
// not here — this only caches the files needed to load the app.

const CACHE_VERSION = 'weightmegodun-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(err => console.warn('Service worker: app shell caching failed', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  // Page navigations: try the network first (so you always get the latest
  // version when online), falling back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Same-origin static assets: cache-first, refresh the cache in the background.
  if (isSameOrigin) {
    event.respondWith(
      caches.match(request).then(cached => {
        const networkFetch = fetch(request)
          .then(res => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Cross-origin (fonts, the Anthropic API, etc.): always go to the network.
  // Never cache API responses.
});
