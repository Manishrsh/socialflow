const CACHE_NAME = 'warechat-shell-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        '/',
        '/dashboard',
        '/offline',
        '/manifest.webmanifest',
        '/icon-192x192.png',
        '/icon-512x512.png',
        '/icon-maskable-512x512.png',
        '/badge-72x72.png',
        '/apple-icon.png',
      ])
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);
  const isNavigation = event.request.mode === 'navigate';
  const isStaticAsset =
    requestUrl.pathname.startsWith('/_next/') ||
    requestUrl.pathname.startsWith('/icon') ||
    requestUrl.pathname.startsWith('/badge') ||
    requestUrl.pathname.startsWith('/apple-icon') ||
    requestUrl.pathname === '/manifest.webmanifest';

  if (isNavigation) {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match('/offline')) || Response.error();
      })
    );
    return;
  }

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const cloned = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          return response;
        });
      })
    );
  }
});

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: 'New message',
      body: event.data ? event.data.text() : 'You received a new message',
    };
  }

  const title = payload.title || 'New message';
  const options = {
    body: payload.body || 'You received a new message',
    tag: payload.tag || 'warechat-message',
    icon: payload.icon || '/icon-192x192.png',
    badge: payload.badge || '/badge-72x72.png',
    data: {
      url: payload.url || '/dashboard/messages',
    },
  };

  event.waitUntil((async () => {
    await self.registration.showNotification(title, options);

    if (typeof payload.unreadCount === 'number' && 'setAppBadge' in self.registration) {
      if (payload.unreadCount > 0) {
        await self.registration.setAppBadge(payload.unreadCount);
      } else if ('clearAppBadge' in self.registration) {
        await self.registration.clearAppBadge();
      }
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/dashboard/messages';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
