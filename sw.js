// sw.js (put at root /sw.js)
self.addEventListener('install', event => {
  // activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // take control of all pages under scope immediately
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', event => {
  // Example push handler — customize payload parsing
  const payload = event.data ? event.data.text() : 'Library reminder';
  const opts = {
    body: payload,
    icon: '/images/icons/icon-192x192.png',
    tag: 'logout-reminder',
    renotify: true,
    vibrate: [200, 100, 200]
  };
  event.waitUntil(self.registration.showNotification('LIBRARY REMINDER ⚠️', opts));
});

self.addEventListener('notificationclick', evt => {
  evt.notification.close();
  evt.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow('/');
    })
  );
});
