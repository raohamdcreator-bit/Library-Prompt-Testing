// §4.1: Network-first caching strategy
// §4.4: No { type: 'module' } — incompatible with Firefox and Safari ≤ iOS 16

const CACHE_NAME = 'prism-v2.0.0';
const PRECACHE   = ['/', '/index.html', '/logo.png', '/og-image.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/'))  return; // never cache API calls
  if (e.request.url.includes('firestore.googleapis.com')) return;
  if (e.request.url.includes('firebase')) return;

  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
