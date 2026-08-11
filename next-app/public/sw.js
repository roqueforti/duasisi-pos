const CACHE_NAME = 'duasisi-pos-v2';
const RUNTIME_CACHE = 'duasisi-runtime-v2';

// Assets untuk di-cache saat install
const PRECACHE_ASSETS = [
  '/duasisi-pos/',
  '/duasisi-pos/index.html',
  '/duasisi-pos/assets/logo-full-white.svg',
  '/duasisi-pos/assets/logo-emblem-teal.svg',
  '/duasisi-pos/assets/icon-192.svg',
  '/duasisi-pos/assets/icon-512.svg',
  '/duasisi-pos/manifest.json',
];

// Install event - cache assets penting
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests (Google Apps Script API)
  if (url.origin !== location.origin) {
    return;
  }

  // Skip API routes - always network first
  if (url.pathname.startsWith('/duasisi-pos/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ error: 'Offline' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    return;
  }

  // Cache first for static assets
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'style' ||
    url.pathname.match(/\.(css|js|png|jpg|jpeg|svg|gif|woff|woff2|ttf|eot)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return caches.open(RUNTIME_CACHE).then((cache) => {
          return fetch(request).then((response) => {
            if (response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          });
        });
      })
    );
    return;
  }

  // Network first for HTML pages
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback to index.html for navigation requests
          if (request.mode === 'navigate') {
            return caches.match('/duasisi-pos/index.html').then((indexResponse) => {
              if (indexResponse) {
                return indexResponse;
              }
              return new Response(
                '<html><body><h1>Offline</h1><p>Aplikasi sedang offline. Silakan periksa koneksi internet Anda.</p></body></html>',
                { headers: { 'Content-Type': 'text/html' } }
              );
            });
          }
          // Fallback offline page for other requests
          return new Response(
            '<html><body><h1>Offline</h1><p>Aplikasi sedang offline. Silakan periksa koneksi internet Anda.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        });
      })
  );
});
