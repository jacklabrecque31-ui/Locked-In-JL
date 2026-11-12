// Hors ligne : les fichiers chiffrés (versionnés par ?v=) sont mis en cache ; le reste passe d'abord par le réseau.
const C = "li-v2";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== "GET") return;
  if (/\/(data\/s|img|aud)\/[^/]+\.bin$/.test(u.pathname)) {
    e.respondWith(caches.open(C).then(async (c) => {
      const hit = await c.match(e.request); if (hit) return hit;
      const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r;
    }));
    return;
  }
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const cl = r.clone(); const key = u.pathname.endsWith("index.json") ? new Request(u.origin + u.pathname) : e.request; caches.open(C).then((c) => c.put(key, cl)); }
    return r;
  }).catch(() => caches.match(u.pathname.endsWith("index.json") ? new Request(u.origin + u.pathname) : e.request)));
});
