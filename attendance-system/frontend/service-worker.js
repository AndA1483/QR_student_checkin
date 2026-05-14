const CACHE_NAME = 'attendance-system-v1';
const OFFLINE_URL = '/index.html';

// Files to cache for offline use
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/login.html',
  '/attendance.html',
  '/report.html',
  '/students.html',
  '/classes.html',
  '/qrcode.html',
  '/profile.html',
  '/users.html',
  '/assets/css/style.css',
  '/assets/js/app.js',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching static assets');
      return cache.addAll(STATIC_CACHE_URLS).catch((err) => {
        console.error('[Service Worker] Cache addAll error:', err);
      });
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached response if found
      if (cachedResponse) {
        // Update cache in background for HTML files
        if (event.request.url.endsWith('.html') || event.request.url.endsWith('/')) {
          fetch(event.request).then((response) => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, response);
              });
            }
          }).catch(() => {
            // Network failed, but we have cache
          });
        }
        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(event.request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        // Cache static assets and HTML pages
        const url = new URL(event.request.url);
        if (
          url.pathname.endsWith('.html') ||
          url.pathname.endsWith('.css') ||
          url.pathname.endsWith('.js') ||
          url.pathname.endsWith('.png') ||
          url.pathname.endsWith('.jpg') ||
          url.pathname.endsWith('.svg') ||
          url.pathname === '/'
        ) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }

        return response;
      }).catch((error) => {
        console.error('[Service Worker] Fetch failed:', error);
        
        // Return offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
        
        // Return a generic offline response for other requests
        return new Response('Offline - content not available', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain'
          })
        });
      });
    })
  );
});

// Background sync for offline attendance submissions (future enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-attendance') {
    console.log('[Service Worker] Background sync: attendance');
    event.waitUntil(syncAttendance());
  }
});

async function syncAttendance() {
  // This would sync any pending attendance records stored in IndexedDB
  // Implementation depends on your offline storage strategy
  console.log('[Service Worker] Syncing attendance data...');
}

// Push notification support (future enhancement)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'มีการอัพเดทใหม่',
    icon: '/assets/icons/icon-192x192.png',
    badge: '/assets/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('ระบบเช็กชื่อนักเรียน', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
