const CACHE_NAME = 'chinese-kids-v1';
const assets = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700;900&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(assets))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});