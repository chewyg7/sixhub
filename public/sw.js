/*
 * GTA 6 Hub service worker. Deliberately small: it makes the site installable
 * and shows a friendly offline page when a page can't load. It never caches
 * the site itself, so an update is live the moment it's deployed.
 */
const OFFLINE = "/offline.html";
const CACHE = "gh-offline-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll([OFFLINE, "/pwa/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Only page loads on this site; everything else goes straight to the network.
  if (req.mode !== "navigate") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/chewy")) return;
  event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
});
