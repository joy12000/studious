const CACHE_NAME = 'aibrary-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  // 빌드 후 실제 생성되는 JS/CSS 파일 경로를 포함해야 할 수 있습니다.
  // 하지만 우선 가장 기본적인 파일들만 캐싱하여 설치 문제를 해결합니다.
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. 파일 공유 POST 요청을 가장 먼저 처리합니다.
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const file = formData.get('shared_file');
        if (file instanceof File) {
          const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          if (clients.length > 0) {
            clients[0].postMessage({ file, type: 'shared-file' });
            await clients[0].focus();
          } else {
            self.clients.openWindow('/');
          }
        }
        return Response.redirect('/', 303);
      } catch (error) {
        console.error('Share target fetch failed:', error);
        return Response.redirect('/', 303);
      }
    })());
    return; // 여기서 처리를 종료합니다.
  }

  // 2. API 요청은 캐시하지 않고 항상 네트워크로 보냅니다.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 3. 그 외의 모든 요청은 네트워크 우선, 실패 시 캐시 전략을 사용합니다.
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // 네트워크 요청이 성공하면 캐시에 저장하고 결과를 반환합니다.
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      })
      .catch(() => {
        // 네트워크 요청이 실패하면 캐시에서 찾습니다.
        return caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || caches.match('/'); // 캐시에도 없으면 기본 페이지로
        });
      })
  );
});