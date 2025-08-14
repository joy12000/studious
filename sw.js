
const VERSION = 'sw-v8';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
// passthrough fetch — no caching to avoid stale assets
self.addEventListener('fetch', () => {});
