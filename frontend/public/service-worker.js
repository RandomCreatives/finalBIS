const CACHE_NAME = 'bis-gerji-shell-v7';
const APP_SHELL = [
    '/',
    '/index.html',
    '/manifest.json',
    '/favicon.svg',
    '/favicon.ico',
    '/favicon-32x32.png',
    '/favicon-16x16.png',
    '/bis-logo.png',
    '/pwa-icon-192.png',
    '/pwa-icon-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
                    return response;
                })
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    event.respondWith(
        caches.match(request).then((cached) => cached || fetch(request).then((response) => {
            if (response.ok && url.pathname.startsWith('/static/')) {
                const copy = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
        }))
    );
});

/** A push arrived from the office — show it even if the tab is closed. */
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const options = {
        body: data.body || '',
        icon: data.icon || '/pwa-icon-192.png',
        badge: '/pwa-icon-192.png',
        data: { url: data.url || '/' },
        vibrate: [200, 100, 200],
        renotify: true,
        tag: data.title || 'bis-gerji',
    };
    event.waitUntil(
        self.registration.showNotification(data.title || 'BIS Gerji', options),
    );
});

/** Tap the notification → open (or focus) the app at the linked page. */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const rawUrl = event.notification.data?.url || '/';
    const targetUrl = new URL(rawUrl, self.location.origin).href;
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            const running = clients.find((c) => new URL(c.url).origin === self.location.origin);
            if (running) {
                if ('navigate' in running) running.navigate(targetUrl).catch(() => {});
                return running.focus();
            }
            return self.clients.openWindow(targetUrl);
        }),
    );
});
