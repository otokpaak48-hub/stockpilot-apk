/**
 * StockPilot — Service Worker v48
 * ------------------------------------------------------------------
 * PWA-only (Android APK uses Capacitor's WebView).
 *
 * Strategies:
 *   - Navigation:    network-first, fallback to cache
 *   - Static assets: stale-while-revalidate
 *   - Background sync: 'stockpilot-sync' tag flushes sync queue when online
 */

const VERSION = 'v48';
const STATIC_CACHE = `sp-static-${VERSION}`;
const RUNTIME_CACHE = `sp-runtime-${VERSION}`;
const OFFLINE_URL = '/offline.html';

const PRECACHE = ['/', '/manifest.json', '/icons/icon-192.png', OFFLINE_URL];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(PRECACHE).catch(() => {});
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => !k.endsWith(VERSION))
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Navigation — network-first
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(request);
        return cached ?? (await caches.match(OFFLINE_URL)) ?? Response.error();
      }
    })());
    return;
  }

  // Static assets — stale-while-revalidate
  event.respondWith((async () => {
    const cached = await caches.match(request);
    const fetchPromise = fetch(request).then((fresh) => {
      if (fresh && fresh.status === 200) {
        const cache = caches.open(RUNTIME_CACHE);
        cache.then((c) => c.put(request, fresh.clone()));
      }
      return fresh;
    }).catch(() => cached);
    return cached || fetchPromise;
  })());
});

// Background sync — flush StockPilot sync queue when connectivity returns
self.addEventListener('sync', (event) => {
  if (event.tag === 'stockpilot-sync') {
    event.waitUntil(flushSyncQueueFromSW());
  }
});

async function flushSyncQueueFromSW() {
  // The actual queue flush runs in the page context via useSync hook
  // (page has access to IndexedDB + JWT). Just notify clients.
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach((c) => c.postMessage({ type: 'SYNC_NOW' }));
}

// Push notifications (Business+ tier)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { payload = { title: 'StockPilot', body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'StockPilot', {
      body: payload.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-32.png',
      tag: payload.tag ?? 'sp-default',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => {
    if (cs[0]) return cs[0].focus();
    return self.clients.openWindow('/');
  }));
});
