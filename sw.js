// Shroom Buddies service worker: makes the app work offline.
// Change the number in CACHE every time any file changes, so phones pick up the new version.
const CACHE = 'sb-v29';
const FILES = [
  './', 'index.html', 'style-v3.css', 'style-v5-extra.css', 'app-v5.js', 'forum-v1.js', 'about-v1.js', 'folders-v1.js', 'manifest.json', 'site.json', 'quotes.json', 'reels.json', 'links.json', 'guides/guides.json',
  'img/logo.svg', 'img/icon-192.png', 'img/icon-512.png', 'img/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Network first, so new guides and reels show up; the saved copy is used when offline.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
