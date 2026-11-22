/* Scubook offline support: keeps a copy of the CRM page so it opens without internet.
   The page is always fetched fresh when online (network first); the copy is only used offline. */
const V = 'scubook-app-v1';
const SHELL = ['app.html', 'fonts/inter-latin.woff2', 'fonts/fredoka-latin.woff2', 'favicon.svg', 'icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(V)
      .then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('scubook-app-') && k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) return;

  if (u.pathname === '/app.html' || u.pathname === '/app') {
    e.respondWith(
      fetch(r)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(V).then((c) => c.put('app.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('app.html'))
    );
    return;
  }

  if (u.pathname.startsWith('/fonts/') || u.pathname === '/favicon.svg' || u.pathname === '/icon-192.png') {
    e.respondWith(caches.match(r, { ignoreSearch: true }).then((m) => m || fetch(r)));
  }
});

/* Team chat notifications: shown even when the app is closed. */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Scubook', body: e.data ? e.data.text() : '' }; }
  const title = d.title || 'Scubook';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || 'New message in the team chat',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.tag || 'chat',
    renotify: true,
    data: { url: d.url || '/app.html#chat' }
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/app.html#chat', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (c.url.indexOf('/app') !== -1 && 'focus' in c) { c.navigate ? c.navigate(url).catch(() => {}) : 0; return c.focus(); }
    }
    return self.clients.openWindow ? self.clients.openWindow(url) : null;
  }));
});
