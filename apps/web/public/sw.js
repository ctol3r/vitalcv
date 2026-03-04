/**
 * sw.js — Wave 52: VitalCV Service Worker
 *
 * Progressive Web App service worker with offline-first caching strategy.
 * Caches critical app shell assets and credential verification pages.
 *
 * Strategy:
 *   - App shell (HTML, CSS, JS): Cache-first, network-fallback
 *   - API calls: Network-first, cache-fallback (stale-while-revalidate)
 *   - Credential data: Encrypted in IndexedDB (handled by app, not SW)
 *
 * PRODUCTION TODO:
 *   - Integrate with next-pwa or workbox for automatic precaching
 *   - Add push notification handling for credential status updates
 *   - Implement background sync for offline verification queue
 */

const CACHE_NAME = 'vitalcv-v1';
const CACHE_VERSION = 1;

/** App shell assets to precache on install */
const APP_SHELL_ASSETS = [
  '/',
  '/manifest.json',
  '/placeholder-logo.png',
];

/** URL patterns to cache with network-first strategy */
const NETWORK_FIRST_PATTERNS = [
  /\/api\/matcha\//,
  /\/api\/oidc\//,
  /\/verify\//,
  /\/clip\//,
];

// ── Install ───────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL_ASSETS);
    }),
  );
  // Activate immediately
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
    }),
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) schemes
  if (!url.protocol.startsWith('http')) return;

  // API calls: network-first with cache fallback
  const isApiCall = NETWORK_FIRST_PATTERNS.some((pattern) =>
    pattern.test(url.pathname),
  );

  if (isApiCall) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Everything else: cache-first with network fallback
  event.respondWith(cacheFirstStrategy(request));
});

// ── Strategies ────────────────────────────────────────────────────────────

async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline fallback — return cached root page
    return caches.match('/') || new Response('Offline', { status: 503 });
  }
}

async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'Offline', cached: false }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

// ── Push Notifications (stub) ─────────────────────────────────────────────

self.addEventListener('push', (event) => {
  // TODO: Handle credential status update push notifications
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'VitalCV Update';
  const options = {
    body: data.body || 'Your credential status has changed.',
    icon: '/placeholder-logo.png',
    badge: '/placeholder-logo.png',
    tag: data.tag || 'vitalcv-update',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
