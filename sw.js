/* ============================================================
   Service Worker — COLOR LED Almacén
   Estrategia: Cache-first para el shell de la app,
               Network-only para el Worker (API de Odoo/Telegram)
   ============================================================ */

const CACHE = 'color-led-almacen-v10';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

/* cache.addAll() usa fetch() normal, que puede devolver una copia vieja desde
   la caché HTTP del navegador aunque el archivo ya haya cambiado en el
   servidor. Se fuerza { cache: 'reload' } para que la instalación del SW
   siempre traiga los archivos frescos de la red, nunca de la caché HTTP. */
self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE).then(async c => {
      await Promise.all(ASSETS.map(async url => {
        const res = await fetch(url, { cache: 'reload' });
        if (res && res.ok) await c.put(url, res);
      }));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', evt => {
  const url = new URL(evt.request.url);

  /* Cualquier llamada al Worker (Odoo/Telegram) → siempre red, nunca cache */
  if (url.origin !== location.origin) return;

  evt.respondWith(
    caches.match(evt.request).then(cached => {
      if (cached) return cached;
      return fetch(evt.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(evt.request, clone));
        }
        return res;
      });
    }).catch(() => caches.match('./index.html'))
  );
});
