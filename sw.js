self.addEventListener('install', (event) => {
  // This forces the waiting service worker to become the active service worker.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // This allows the service worker to claim control of the page immediately.
  event.waitUntil(clients.claim());
});

// Handle messages (like SKIP_WAITING)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});