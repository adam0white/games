// Rope's service worker never claims another game's paths or caches.
const CACHE_PREFIX = 'games-rope-';
const CACHE = `${CACHE_PREFIX}v1`;
const ROOT = '/rope/';
const SHELL = [ROOT, `${ROOT}manifest.webmanifest`, `${ROOT}icon.svg`, `${ROOT}icon-192.png`];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(ROOT) ||
    url.pathname === `${ROOT}release.json` ||
    url.pathname.startsWith(`${ROOT}api/`)
  )
    return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put(url.pathname, copy)));
          }
          return response;
        })
        .catch(() => caches.open(CACHE).then((cache) => cache.match(url.pathname))),
    );
    return;
  }
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) event.waitUntil(cache.put(request, response.clone()));
            return response;
          }),
      ),
    ),
  );
});
