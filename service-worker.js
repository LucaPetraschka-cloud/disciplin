const CACHE = 'disciplin-v7';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './vendor/chart.umd.min.js',
  './vendor/supabase.min.js',
  './js/app.js',
  './js/router.js',
  './js/store.js',
  './js/quotes.js',
  './js/icons.js',
  './js/charts.js',
  './js/timeseries.js',
  './js/calendarUtils.js',
  './js/home.js',
  './js/tms.js',
  './js/gym.js',
  './js/habits.js',
  './js/calendar.js',
  './js/settings.js',
  './js/googleCalendar.js',
  './js/sync.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first for same-origin app files (so updates land quickly), falling
// back to cache when offline. Cross-origin (Google/Supabase API calls) always
// goes straight to the network — those responses must never be cached.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // 'no-cache' bypasses the HTTP disk cache (revalidates with the server), so
  // deploys show up on next launch instead of after the cache max-age expires.
  // Navigation requests must not get a RequestInit — older WebKit throws
  // "cannot construct a Request with mode 'navigate'" and the app won't load.
  const req = e.request.mode === 'navigate' ? e.request : new Request(e.request, { cache: 'no-cache' });

  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((res) => res || caches.match('./index.html')))
  );
});
