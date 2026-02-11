const CACHE_NAME = 'brojekt-v2';
const PRECACHE_URLS = ['/pwa-start'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept: Supabase auth, API routes, non-GET requests
  if (
    url.hostname.includes('supabase') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    event.request.method !== 'GET'
  ) {
    return; // Let the browser handle it normally
  }

  // For navigation requests (HTML pages): always go to network
  if (event.request.mode === 'navigate') {
    return; // Don't intercept page navigations
  }

  // For static assets only: network first, cache fallback
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
