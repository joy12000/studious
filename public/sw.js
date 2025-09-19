import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// 서비스 워커의 생명주기 이벤트를 제어합니다.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// VitePWA가 주입할 매니페스트를 사용하여 앱의 핵심 자산을 미리 캐싱합니다.
// 이것이 PWA 설치와 오프라인 실행의 핵심입니다.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// 구글 폰트와 같은 외부 리소스에 대한 캐싱 규칙 (CacheFirst 전략)
registerRoute(
  ({url}) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [
      new ExpirationPlugin({ maxEntries: 20 }),
    ],
  })
);

// API 요청에 대한 캐싱 규칙 (NetworkFirst 전략)
registerRoute(
  ({url}) => url.pathname.startsWith('/api/'),
  new NetworkFirst({ cacheName: 'api-cache' })
);

// 파일 공유를 위한 특별 Fetch 이벤트 리스너
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Web Share Target API를 통해 들어온 POST 요청을 처리합니다.
  if (event.request.method === 'POST' && url.pathname === '/index.html') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const file = formData.get('shared_file');

        if (file instanceof File) {
          const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          if (clients.length > 0) {
            await clients[0].focus();
            clients[0].postMessage({ file, type: 'shared-file' });
          } else {
            self.clients.openWindow('/');
          }
        }
        return Response.redirect('/', 303);
      } catch (error) {
        console.error('Share target fetch handler failed:', error);
        return Response.redirect('/', 303);
      }
    })());
    return; // 이 요청은 여기서 처리를 종료합니다.
  }

  // 그 외의 모든 GET 요청은 위에서 선언된 라우팅 규칙들이 처리합니다.
});
