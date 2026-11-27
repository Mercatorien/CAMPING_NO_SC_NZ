// Service worker : appli utilisable hors ligne (données et tuiles déjà consultées).
const VERSION = 'v9';
const SHELL = `shell-${VERSION}`, DATA = 'data-v1', TILES = 'tiles-v1';
const SHELL_FILES = ['./', 'index.html', 'style.css?v=7', 'app.js?v=9', 'data.js?v=7', 'ta.js?v=7', 'leaflet.js?v=7', 'leaflet.css?v=7',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png'];
const MAX_TILES = 4000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('shell-') && k !== SHELL).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const isTile = u => /tile\.openstreetmap\.org|server\.arcgisonline\.com/.test(u.host);
const isData = u => /services1\.arcgis\.com|overpass-api\.de/.test(u.host);

async function trimTiles() {
  const c = await caches.open(TILES), keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);

  // Tuiles de fond de carte : cache d'abord (consultation hors ligne des zones déjà vues)
  if (isTile(u)) {
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') { c.put(req, res.clone()); trimTiles(); }
      return res;
    }));
    return;
  }

  // Données en direct (DOC, OpenStreetMap) : réseau d'abord, cache si hors ligne
  if (isData(u)) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(DATA).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || Response.error())));
    return;
  }

  // Fichiers de l'appli : cache d'abord, mis à jour en arrière-plan
  if (u.origin === self.location.origin) {
    e.respondWith(caches.match(req, { ignoreSearch: false }).then(hit => {
      const net = fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); } return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
