// VitalCV Service Worker — PWA Shell Foundation
// Strategy:
//   - Network-First for /api/* (credentials and verification data must be live)
//   - Cache-First for static assets (fonts, images, icons)
//   - Network-First for navigation requests (HTML pages stay fresh)
//
// Truth contract:
//   - /api/* routes are NEVER served from cache; network failure surfaces as error
//   - Cache stores only public static assets; no authenticated API responses cached
//   - This SW does not claim to verify credentials or perform any PSV operations

const CACHE_NAME = 'vitalcv-static-v1';

const STATIC_EXTENSIONS = ['.woff', '.woff2', '.ttf', '.ico', '.png', '.jpg', '.svg', '.webp'];

function isStaticAsset(url) {
  const { pathname } = new URL(url);
  return STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}

function isApiRoute(url) {
  const { pathname } = new URL(url);
  return pathname.startsWith('/api/');
}

self.addEventListener('install', (event) => {
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
  const { request } = event;
  const { url, method } = request;

  // Only handle GET requests
  if (method !== 'GET') return;

  // Network-First: /api/* — never cache, always fetch live
  if (isApiRoute(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // Cache-First: static assets (fonts, images, icons)
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // Network-First: all other requests (HTML pages, navigation)
  // Falls back to cache only if network fails and a cached copy exists
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
