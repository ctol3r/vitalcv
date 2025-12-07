/**
 * PWA Service Worker Configuration
 * Implements custom service worker for caching strategies (stale-while-revalidate)
 * Handles dynamic caching of API data and static assets
 * Includes logic for offline fallback pages
 */

export interface ServiceWorkerConfig {
  cacheName: string;
  staticCacheName: string;
  apiCacheName: string;
  offlineFallbackPage?: string;
  maxCacheAge?: number; // milliseconds
  maxCacheSize?: number; // number of entries
}

export const DEFAULT_CONFIG: ServiceWorkerConfig = {
  cacheName: 'vitalcv-cache-v1',
  staticCacheName: 'vitalcv-static-v1',
  apiCacheName: 'vitalcv-api-v1',
  offlineFallbackPage: '/offline.html',
  maxCacheAge: 24 * 60 * 60 * 1000, // 24 hours
  maxCacheSize: 100,
};

/**
 * Generate service worker script
 */
export function generateServiceWorkerScript(config: ServiceWorkerConfig = DEFAULT_CONFIG): string {
  return `
// Service Worker for VitalCV Platform
// Generated service worker with stale-while-revalidate strategy

const CACHE_NAME = '${config.cacheName}';
const STATIC_CACHE = '${config.staticCacheName}';
const API_CACHE = '${config.apiCacheName}';
const OFFLINE_PAGE = '${config.offlineFallbackPage || '/offline.html'}';
const MAX_CACHE_AGE = ${config.maxCacheAge || 24 * 60 * 60 * 1000};
const MAX_CACHE_SIZE = ${config.maxCacheSize || 100};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install event');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[ServiceWorker] Caching static assets');
      // Add static assets to cache during install
      return cache.addAll([
        '/',
        '/offline.html',
        // Add other static assets here
      ]);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate event');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME &&
              cacheName !== STATIC_CACHE &&
              cacheName !== API_CACHE) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - implement stale-while-revalidate
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets
  if (isStaticAsset(url.pathname)) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Default: network first
  event.respondWith(handleDefaultRequest(request));
});

/**
 * Handle API requests with stale-while-revalidate
 */
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE);
  const cachedResponse = await cache.match(request);

  // Return cached response immediately (stale)
  const fetchPromise = fetch(request)
    .then((response) => {
      // Update cache with fresh response
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => {
      // Network failed, return cached if available
      return cachedResponse || new Response(JSON.stringify({ error: 'Offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    });

  // Return cached response immediately, update in background
  return cachedResponse || fetchPromise;
}

/**
 * Handle static asset requests (cache first)
 */
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    // Check if cache is still valid
    const cacheDate = cachedResponse.headers.get('sw-cache-date');
    if (cacheDate) {
      const age = Date.now() - parseInt(cacheDate);
      if (age < MAX_CACHE_AGE) {
        return cachedResponse;
      }
    } else {
      return cachedResponse;
    }
  }

  // Fetch from network and cache
  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseToCache = response.clone();
      responseToCache.headers.set('sw-cache-date', Date.now().toString());
      cache.put(request, responseToCache);
    }
    return response;
  } catch (error) {
    // Return cached if available, otherwise offline page
    return cachedResponse || caches.match(OFFLINE_PAGE);
  }
}

/**
 * Handle navigation requests
 */
async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    // Return offline page for navigation failures
    const offlinePage = await caches.match(OFFLINE_PAGE);
    return offlinePage || new Response('Offline', { status: 503 });
  }
}

/**
 * Handle default requests (network first)
 */
async function handleDefaultRequest(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    return cachedResponse || new Response('Offline', { status: 503 });
  }
}

/**
 * Check if path is a static asset
 */
function isStaticAsset(pathname) {
  return (
    pathname.match(/\\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/) ||
    pathname.startsWith('/static/') ||
    pathname.startsWith('/assets/')
  );
}

/**
 * Clean up old cache entries
 */
async function cleanupCache(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length > maxSize) {
    // Sort by date and remove oldest
    const entries = await Promise.all(
      keys.map(async (key) => {
        const response = await cache.match(key);
        const date = response?.headers.get('sw-cache-date') || '0';
        return { key, date: parseInt(date) };
      })
    );

    entries.sort((a, b) => a.date - b.date);
    const toDelete = entries.slice(0, entries.length - maxSize);

    await Promise.all(toDelete.map((entry) => cache.delete(entry.key)));
  }
}

// Periodic cache cleanup
setInterval(() => {
  cleanupCache(API_CACHE, MAX_CACHE_SIZE);
  cleanupCache(CACHE_NAME, MAX_CACHE_SIZE);
}, 60 * 60 * 1000); // Every hour
`.trim();
}

/**
 * Register service worker
 */
export function registerServiceWorker(scriptPath: string = '/sw.js'): Promise<ServiceWorkerRegistration> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.reject(new Error('Service workers are not supported'));
  }

  return navigator.serviceWorker
    .register(scriptPath)
    .then((registration) => {
      console.log('[ServiceWorker] Registered:', registration.scope);
      return registration;
    })
    .catch((error) => {
      console.error('[ServiceWorker] Registration failed:', error);
      throw error;
    });
}

/**
 * Unregister service worker
 */
export function unregisterServiceWorker(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(false);
  }

  return navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      return Promise.all(registrations.map((reg) => reg.unregister()));
    })
    .then((results) => {
      return results.every((result) => result);
    });
}

/**
 * Service worker registration helper for app bootstrap
 */
export class PWAServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;

  constructor(private config: ServiceWorkerConfig = DEFAULT_CONFIG) {}

  /**
   * Initialize and register service worker
   */
  async initialize(): Promise<void> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.warn('[PWA] Service workers not supported');
      return;
    }

    try {
      this.registration = await registerServiceWorker('/sw.js');
      this.setupUpdateHandlers();
    } catch (error) {
      console.error('[PWA] Failed to initialize service worker:', error);
    }
  }

  /**
   * Setup handlers for service worker updates
   */
  private setupUpdateHandlers(): void {
    if (!this.registration) {
      return;
    }

    // Check for updates periodically
    setInterval(() => {
      this.registration?.update();
    }, 60 * 60 * 1000); // Every hour

    // Handle update found
    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration?.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker available, prompt user to reload
            console.log('[PWA] New service worker available');
            // You can dispatch a custom event here to notify the app
          }
        });
      }
    });
  }

  /**
   * Get service worker registration
   */
  getRegistration(): ServiceWorkerRegistration | null {
    return this.registration;
  }

  /**
   * Unregister service worker
   */
  async unregister(): Promise<boolean> {
    if (this.registration) {
      const result = await this.registration.unregister();
      this.registration = null;
      return result;
    }
    return false;
  }
}

