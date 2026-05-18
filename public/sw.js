// Minimal service worker – required for PWA installability criteria
// No caching strategy: all requests pass through to the network normally.

const CACHE_NAME = "banaoo-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// No fetch handler — avoids "Failed to fetch" on navigations when offline.
// The app requires network; install/activate hooks are enough for PWA installability.
