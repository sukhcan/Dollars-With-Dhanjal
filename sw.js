// OI PropTrader Pro — Service Worker v3
// Full offline support — app works without internet after first load

const CACHE_NAME = "proptrader-v3";
const OFFLINE_URL = "/index.html";

const PRECACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-72.png",
  "/icons/icon-96.png",
  "/icons/icon-128.png",
  "/icons/icon-144.png",
  "/icons/icon-152.png",
  "/icons/icon-192.png",
  "/icons/icon-384.png",
  "/icons/icon-512.png",
];

// ── INSTALL: Cache everything ──────────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: Clean old caches ──────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Offline-first strategy ──────────────────────────────
self.addEventListener("fetch", event => {
  // Skip non-GET and external API calls
  if (event.request.method !== "GET") return;
  if (event.request.url.includes("localhost:8000")) return;
  if (event.request.url.startsWith("ws://")) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback
        if (event.request.destination === "document") {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});

// ── BACKGROUND SYNC: Queue OI data refresh ──────────────────────
self.addEventListener("sync", event => {
  if (event.tag === "oi-refresh") {
    event.waitUntil(
      // Notify all clients to refresh OI data
      self.clients.matchAll().then(clients =>
        clients.forEach(client => client.postMessage({ type: "OI_REFRESH" }))
      )
    );
  }
});

// ── PUSH: Trade alerts ───────────────────────────────────────────
self.addEventListener("push", event => {
  const data = event.data ? event.data.json() : { title: "PropTrader Alert", body: "Check your signals" };
  event.waitUntil(
    self.registration.showNotification(data.title || "OI PropTrader Pro", {
      body: data.body || "New trading signal available",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-72.png",
      tag: "trade-alert",
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/index.html"));
});
