import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

// --- Lifecycle Events ---
// 서비스 워커가 설치될 때 즉시 활성화되도록 합니다.
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// --- Precaching & Cleanup ---
// 이 부분은 VitePWA 플러그인에 의해 앱의 모든 필수 애셋 목록으로 자동 교체됩니다.
// 이를 통해 PWA가 오프라인에서도 동작할 수 있습니다.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// --- Routing Rules ---
// API 요청(/api/)은 항상 네트워크를 먼저 시도하고, 실패 시 캐시된 응답을 사용합니다.
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
  })
);

// --- Custom Fetch Listener for Special Cases ---
// 이 리스너는 표준 라우팅 규칙으로 처리할 수 없는 특별한 요청만 처리합니다.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Web Share Target API를 통해 들어온 POST 요청을 처리합니다.
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const file = formData.get('shared_file'); // manifest에 정의된 이름

        if (file instanceof File) {
          const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          if (clients.length > 0) {
            await clients[0].focus();
            clients[0].postMessage({ file: file, type: 'shared-file' });
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

  // 그 외의 모든 GET 요청은 위에서 선언된 precacheAndRoute 및 registerRoute 규칙이 자동으로 처리합니다.
});
