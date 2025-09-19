import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

// --- Lifecycle Events ---
// 서비스 워커가 설치될 때 즉시 활성화되도록 합니다.
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// --- Precaching & Cleanup ---
// 이전 버전의 캐시를 정리하고, VitePWA가 주입한 모든 앱 애셋을 미리 캐싱합니다.
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
  if (event.request.method === 'POST' && url.pathname === '/handle-shared-note') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const file = formData.get('shared_file');

        if (file instanceof File) {
          const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          if (clients.length > 0) {
            await clients[0].focus();
            clients[0].postMessage({ file: file, type: 'shared-file' });
          } else {
            // 열린 앱이 없으면 새로 엽니다.
            self.clients.openWindow('/');
          }
        }
        // 처리 후에는 항상 메인 페이지로 리디렉션합니다.
        return Response.redirect('/', 303);
      } catch (error) {
        console.error('Share target fetch handler failed:', error);
        return Response.redirect('/', 303);
      }
    })());
    // 이 요청은 여기서 처리가 끝나므로, 즉시 return 합니다.
    return;
  }

  // 그 외의 모든 GET 요청은 위에서 선언된 precacheAndRoute 및 registerRoute 규칙이 자동으로 처리합니다.
});
