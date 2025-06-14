/**
 * Service Worker for OVERWHELM
 * Handles push notifications without any server storage
 */

// Cache name
const CACHE_NAME = 'overwhelm-v1';

// Files to cache for offline use
const urlsToCache = [
  '/',
  '/favicon.svg',
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch new
        return response || fetch(event.request);
      })
      .catch(() => {
        // Offline fallback for HTML pages
        if (event.request.destination === 'document') {
          return caches.match('/');
        }
      })
  );
});

// Push event - we don't actually receive server pushes
// This is just for future extension if needed
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Check the app for updates',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200],
    tag: 'overwhelm-update',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification('OVERWHELM Update', options)
  );
});

// Notification click - open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});

// Background sync for checking updates (future feature)
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-rotation') {
    // Could check for zone rotations in background
    // But keeping it simple for now
  }
});