// The Warren service worker: offline play. The page is network-first (so a new build arrives), everything else
// (hashed assets, fonts) is cache-first and stored as it is fetched.
const CACHE = 'warren-v1';
const PREFIX = '/warren/';
const SHELL = [PREFIX, `${PREFIX}manifest.webmanifest`, `${PREFIX}icon.svg`, `${PREFIX}icon-192.png`];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('warren-') && k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(PREFIX)) return;
  // Mutable release identity and explicit fresh reads must reach the network, including on an old cache.
  if (url.pathname === `${PREFIX}release.json` || req.cache === 'no-store') return;
  const isPage = req.mode === 'navigate';
  if (isPage) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(PREFIX, copy));
          }
          return res;
        })
        .catch(() => caches.open(CACHE).then((c) => c.match(PREFIX))),
    );
    return;
  }
  e.respondWith(
    caches
      .open(CACHE)
      .then((c) => c.match(req))
      .then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok || res.type === 'opaque') {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
  );
});
