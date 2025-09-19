import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

// PWA 빌드 시 VitePWA 플러그인이 이 부분을 앱의 모든 애셋 목록으로 교체합니다.
// 이를 통해 앱의 모든 파일이 오프라인 캐싱됩니다.
precacheAndRoute(self.__WB_MANIFEST || []);

self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

// Fetch 이벤트 리스너
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. 파일 공유 요청 처리 (가장 먼저 체크)
  if (event.request.method === 'POST' && url.pathname === '/handle-shared-note') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const file = formData.get('shared_file'); // manifest에서 지정한 'name'

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
    return; // 공유 요청은 여기서 처리를 끝냅니다.
  }

  // 2. API 요청 처리 (네트워크 우선)
  if (url.pathname.startsWith('/api/')) {
    registerRoute(
      ({ url }) => url.pathname.startsWith('/api/'),
      new NetworkFirst()
    );
    return; // API 요청은 아래의 일반 캐싱 로직을 타지 않도록 합니다.
  }

  // 3. 그 외 모든 요청은 기본 핸들러에 맡깁니다. (precacheAndRoute가 처리)
});