// Minimal service worker – required for PWA installability criteria
// No caching strategy: all requests pass through to the network normally.

const CACHE_NAME = "banaoo-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Pass-through fetch – no offline caching (keeps things simple)
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
