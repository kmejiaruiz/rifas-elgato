const CACHE_NAME = 'zentric-cache-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/icons.svg',
  '/manifest.json'
];

// Install: pre-cache critical assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-First Strategy for everything except API
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Bypass API requests and non-GET requests entirely
  if (url.pathname.includes('/api/') || e.request.method !== 'GET') {
    return;
  }

  // Network-First logic
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // If valid response, cache it dynamically
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if network is unavailable
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If navigation/page document, fallback to index.html cache
          if (e.request.mode === 'navigate' || 
              (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html'))) {
            return caches.match('/index.html');
          }
        });
      })
  );
});

