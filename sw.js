// Media Vault service worker
// Strategy: cache the app shell (HTML/manifest/icons) so the vault opens offline.
// External API calls (OMDb, iTunes) and CDN scripts always go to the network first,
// since the whole point of those is fresh data / library correctness.

const CACHE_NAME = 'media-vault-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;

  // Only manage GET requests for our own shell files; let everything else
  // (API calls, CDN libraries, cover art) go straight to the network.
  if (event.request.method !== 'GET' || !isSameOrigin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      // Serve cached shell instantly if we have it, refresh in background.
      return cached || networkFetch;
    })
  );
});
