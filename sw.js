const CACHE = 'aviary-v16';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './sounds/manifest.json', './vendor/three.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(CORE);
    try { const m = await (await fetch('./sounds/manifest.json')).json(); await c.addAll(Object.values(m).flat().map(x => './' + x.file)); } catch (err) {}
  }));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const old = (await caches.keys()).filter(k => k.startsWith('aviary-') && k !== CACHE);
    await Promise.all(old.map(k => caches.delete(k)));
    await self.clients.claim();
    // Versions up to v5 served a stale page from cache; reload those windows once so the update shows now.
    // Newer versions already load the fresh page on open, so they are never interrupted mid-play.
    // Not awaited on purpose: page loads wait for activation to finish, so awaiting here would deadlock.
    if (old.some(k => k === 'aviary-v4' || k === 'aviary-v5')) self.clients.matchAll({type: 'window'}).then(cs => cs.forEach(c => { if (c.navigate) c.navigate(c.url).catch(() => {}); }));
  })().catch(() => {}));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const ok = url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!ok) return;
  if (e.request.mode === 'navigate') {
    // newest page when the network answers quickly; the saved copy after 3 s (weak car or hotel wifi) or offline
    e.respondWith((async () => {
      const cached = (await caches.match(e.request, {ignoreSearch: true})) || (await caches.match('./index.html'));
      const net = fetch(e.request).then(res => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return res; });
      if (!cached) return net;
      return Promise.race([net.catch(() => cached), new Promise(r => setTimeout(() => r(cached), 3000))]);
    })());
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => {
    const net = fetch(e.request).then(res => { if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
