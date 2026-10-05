// Net Worth Planner service worker: makes the app work offline.
// It only caches the app's own files. Your plan is never sent anywhere.
// When you publish a change, bump VERSION so everyone gets the update.
const VERSION = 'v15';
const CACHE = `net-worth-planner-${VERSION}`;
const APP_FILES = [
  './',
  './index.html',
  './config.js',
  './model.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', event => {
  // Download fresh copies, not the browser's cached ones, so a new version never starts with old files
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_FILES.map(u => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('net-worth-planner-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

// Serve from this version's cache, so the app opens instantly and offline. Each version's files stay
// together: a release arrives as a new service worker (bump VERSION), never one file at a time.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: true }) ||
        (req.mode === 'navigate' ? await cache.match('./index.html') || await cache.match('./') : undefined);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (e) {
        return Response.error();
      }
    })
  );
});
