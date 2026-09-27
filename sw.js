const CACHE = 'aviary-v7';
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
    const old = (await caches.keys()).filter(k => k !== CACHE);
    await Promise.all(old.map(k => caches.delete(k)));
    await self.clients.claim();
    // an update replaced an older version: reload open windows once so it shows without reopening the app.
    // Not awaited on purpose: page loads wait for activation to finish, so awaiting here would deadlock.
    if (old.length) self.clients.matchAll({type: 'window'}).then(cs => cs.forEach(c => { if (c.navigate) c.navigate(c.url).catch(() => {}); }));
  })().catch(() => {}));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const ok = url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!ok) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(res => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return res; }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => {
    const net = fetch(e.request).then(res => { if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
