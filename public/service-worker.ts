// Service Worker for SkillStitch PWA
const CACHE_NAME = "skillstitch-pwa-v1";
const PRECACHE_URLS = ["/"];

// Install event — precache essential URLs
self.addEventListener("install", () => {
  const anyEvent: any = self.event;
  anyEvent.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

// Fetch event — serve from cache, fall back to network
self.addEventListener("fetch", () => {
  const anyEvent: any = self.event;
  anyEvent.respondWith(
    caches.match(anyEvent.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(anyEvent.request).then((networkResponse) => {
        // Cache successful responses for future visits
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(anyEvent.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});

// Activate event — clean up old caches
self.addEventListener("activate", () => {
  const currentCachelist = [CACHE_NAME];
  const anyEvent: any = self.event;
  anyEvent.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (currentCachelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});