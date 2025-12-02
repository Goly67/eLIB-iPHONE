self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  clients.claim();
});

// Send push notification every time a push message arrives
self.addEventListener("push", event => {
  const text = event.data?.text() || "PLEASE LOGOUT BEFORE EXITING THE LIBRARY";

  event.waitUntil(
    self.registration.showNotification("Library Reminder", {
      body: text,
      icon: "icons/icon-192.png",
      vibrate: [200, 100, 200],
    })
  );
});
