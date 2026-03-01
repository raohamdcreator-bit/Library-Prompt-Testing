// §4.1: Network-first caching strategy
// §4.4: No { type: 'module' } — incompatible with Firefox and Safari ≤ iOS 16

const CACHE_NAME = 'prism-v2.1.0'; // bumped: force SW replacement to apply new CSP/frame-src fixes
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
  if (e.request.url.includes('/api/'))                    return;
  if (e.request.url.includes('firestore.googleapis.com')) return;
  if (e.request.url.includes('firebase'))                 return;
  if (e.request.url.includes('googletagmanager'))         return;
  if (e.request.url.includes('google-analytics'))         return;
  // Bypass Google APIs required for Firebase Auth (Google sign-in).
  // The SW's connect-src does not cover apis.google.com; intercepting these
  // requests causes a CSP violation and breaks auth/internal-error flow.
  if (e.request.url.includes('apis.google.com'))          return;
  // Bypass font requests: the SW's connect-src does not cover fonts.gstatic.com
  // so intercepting and re-fetching fonts causes a CSP violation. Let the browser
  // handle font requests natively using the page-level CSP (font-src is allowed).
  if (e.request.url.includes('fonts.googleapis.com'))     return;
  if (e.request.url.includes('fonts.gstatic.com'))        return;

  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match(e.request).then(cached => cached || Response.error())
    )
  );
});
