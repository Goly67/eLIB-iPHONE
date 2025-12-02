self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  clients.claim();
});

// Send push notification every time a push message arrives
self.addEventListener("push", event => {
  // If no data is sent, default to the library reminder
  const text = event.data?.text() || "PLEASE LOGOUT BEFORE EXITING THE LIBRARY";

  event.waitUntil(
    self.registration.showNotification("Library Reminder", {
      body: text,
      icon: "images/icons/icon-192x192.png",
      vibrate: [200, 100, 200],
    })
  );
});
