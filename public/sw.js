// Offline support. Pages: network first, the cached app shell when offline. Hashed build assets: cache first (their names change
// with their content). Other origins (the sync API) are never cached.
const CACHE = 'gre-trainer-v1';
const scope = new URL(self.registration.scope);
const SHELL = new URL('./', scope).href;

/** The hashed files the current index.html loads, so the first offline visit has the whole app. */
async function shellAssets(html) {
  const urls = new Set();
  for (const m of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|webmanifest|png|svg))"/g)) urls.add(new URL(m[1], SHELL).href);
  return [...urls];
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const res = await fetch(SHELL, { cache: 'no-cache' });
      if (!res.ok) return;
      const html = await res.clone().text();
      await cache.put(SHELL, res);
      const assets = await shellAssets(html);
      await Promise.all(assets.map((u) => cache.add(u).catch(() => {})));
      // The math fonts the stylesheets point to (woff2 only: every browser that runs a service worker reads it).
      for (const css of assets.filter((u) => u.endsWith('.css'))) {
        const text = await (await cache.match(css))?.text();
        const fonts = [...(text ?? '').matchAll(/url\(([^)]+\.woff2)\)/g)].map((m) => new URL(m[1].replace(/["']/g, ''), css).href);
        await Promise.all(fonts.map((u) => cache.add(u).catch(() => {})));
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
      // Drop hashed assets the current shell no longer loads (lazy chunks come back on demand).
      const cache = await caches.open(CACHE);
      const shell = await cache.match(SHELL);
      if (shell) {
        const keep = new Set([SHELL, ...(await shellAssets(await shell.text()))]);
        const assets = (await cache.keys()).filter((r) => r.url.includes('/assets/') && !keep.has(r.url));
        // Keep lazy chunks of the current build: only prune when the cache grew past a few builds' worth.
        if (assets.length > 60) await Promise.all(assets.map((r) => cache.delete(r)));
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok && url.pathname === scope.pathname) (await caches.open(CACHE)).put(SHELL, res.clone());
          return res;
        } catch {
          return (await caches.match(SHELL)) ?? Response.error();
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && url.pathname.includes('/assets/')) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })(),
  );
});
