// Minimal service worker: makes FaceTwin installable and caches the heavy AI files after first load.
const CACHE = "facetwin-v1";
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  const heavy = /\/(vendor|models|assets\/routine)\//.test(url.pathname) || url.hostname === "storage.googleapis.com";
  if (e.request.method !== "GET" || !heavy) return; // app files always fresh from the network
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request);
    if (hit) return hit;
    const res = await fetch(e.request);
    if (res.ok) c.put(e.request, res.clone());
    return res;
  }));
});
