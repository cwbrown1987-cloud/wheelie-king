const CACHE = "wk-v18-controls-2";
const SHELL = ["./ride-tricks.js", "./category-icons.js", "./ride-controls.js", "./icons/outback-background.svg", "./builder-mode.js", "./", "./index.html", "./app.js", "./stickers-dd.js", "./parts3d.js", "./fitment.js", "./partmodels.js", "./thumbs.js", "./ride.js", "./ride-physics.js", "./detail.js", "./frame-geometry.js", "./trax-bike.js", "./trax-suspension.js", "./bike-motion.js", "./modular-catalogue.js", "./modular-render.js", "./vendor/DecalGeometry.js", "./manifest.webmanifest", "./vendor/three.module.js", "./vendor/OrbitControls.js", "./vendor/RoomEnvironment.js", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./icons/apple-touch-icon-180.png", "./stickers/wombat-scooter.png", "./stickers/wombat-emoto.png", "./stickers/wombat-footpath.png", "./stickers/holo-badge.png", "./stickers/eshay.png", "./stickers/baked-wombat.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
    if (res.ok && (new URL(e.request.url).origin === location.origin || e.request.url.includes("fonts.g"))) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); }
    return res;
  }).catch(() => caches.match("./index.html"))));
});
