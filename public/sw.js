// Minimal SW for PWA installability - does NOT cache anything
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  // Clear all old caches
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  );
  self.clients.claim();
});
self.addEventListener('fetch', () => {
  // No-op: let browser handle all requests normally
});
