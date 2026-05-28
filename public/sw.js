const CACHE_NAME    = 'fittrack-v1';
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/auth/login',
  '/auth/register',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/apple-touch-icon.png',
];

// ── Install: pre-cache the shell ─────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: remove old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: routing strategy ───────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API routes → Network first, fall back to offline JSON
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Cache successful API responses for offline reads (clone before consuming)
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) =>
              cached ||
              new Response(JSON.stringify({ error: 'You are offline' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
              })
          )
        )
    );
    return;
  }

  // Next.js _next/static assets → Cache first (immutable hashed files)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached || fetch(request).then((res) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, res.clone()));
          return res;
        })
      )
    );
    return;
  }

  // Navigation (HTML pages) → Network first, fall back to cached shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Everything else (images, fonts) → Cache first
  event.respondWith(
    caches.match(request).then(
      (cached) => cached || fetch(request).then((res) => {
        if (res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, res.clone()));
        return res;
      })
    )
  );
});

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const { title = 'FitTrack', body = '', icon = '/icon-192x192.png' } = event.data.json();
  event.waitUntil(
    self.registration.showNotification(title, { body, icon, badge: '/icon-192x192.png', vibrate: [100, 50, 100] })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/dashboard'));
});
