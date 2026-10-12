const CACHE_NAME = 'pirataflix-v3';
const ASSETS = [
  './', './index.html', './filmes.html', './series.html', './novelas.html',
  './animes.html', './infantil.html', './tv.html',
  './style.css', './tv-player.css', './shared.js', './tv-player.js',
  './novo-player.js', './data.json', './channels.json',
  './favicon.png', './manifest.json'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS).catch(() => {})));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Só cuida do próprio site: vídeos, Blogger, CDNs e APIs de terceiros passam direto
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request.clone()).then(r => {
      if (r && r.status === 200 && r.type !== 'opaque') {
        const rc = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, rc));
      }
      return r;
    }).catch(() =>
      caches.match(e.request).then(hit => hit || Response.error())
    )
  );
});
