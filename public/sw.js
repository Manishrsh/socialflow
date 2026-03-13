self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('warechat-shell-v1').then((cache) =>
      cache.addAll([
        '/',
        '/dashboard',
        '/offline',
        '/manifest.webmanifest',
        '/icon-light-32x32.png',
        '/apple-icon.png',
      ])
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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
    requestUrl.pathname.startsWith('/apple-icon') ||
    requestUrl.pathname === '/manifest.webmanifest';

  if (isNavigation) {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open('warechat-shell-v1');
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
          void caches.open('warechat-shell-v1').then((cache) => cache.put(event.request, cloned));
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
    icon: payload.icon || '/icon-light-32x32.png',
    badge: payload.badge || '/icon-light-32x32.png',
    data: {
      url: payload.url || '/dashboard/messages',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
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
