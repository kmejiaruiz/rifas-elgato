const CACHE_NAME = 'rifas-cache-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/icons.svg',
  '/manifest.json'
];

// Install: pre-cache critical shell assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches (this clears out the old rifas-cache-v1)
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

// Fetch: Smart Caching
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Bypass API requests and non-GET requests entirely
  if (url.pathname.includes('/api/') || e.request.method !== 'GET') {
    return;
  }

  // Strategy for static assets (pre-cached)
  const isStaticAsset = STATIC_ASSETS.some(asset => 
    url.pathname === asset || 
    (asset === '/' && url.pathname === '') ||
    (asset === '/index.html' && url.pathname.endsWith('/index.html'))
  );

  if (isStaticAsset) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Strategy for Vite hashed assets (under /assets/)
  if (url.pathname.includes('/assets/')) {
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(e.request).then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // SPA client-side routing fallback: if offline, return cached /index.html
  // Only intercept page navigation requests (mode: navigate or accept HTML)
  const isNav = e.request.mode === 'navigate' || 
                (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html'));
                
  if (isNav) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/index.html'))
    );
  }
});
