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
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();

        // 1) 파일 경로
        const file = formData.get('shared_file');
        let payloadText = null;

        if (file && typeof file.text === 'function') {
          try { payloadText = await file.text(); } catch {}
        }

        // 2) 텍스트/URL 백업 경로
        if (!payloadText) {
          const text = formData.get('text') || formData.get('title') || '';
          const urlStr = formData.get('url') || '';
          payloadText = text || urlStr || '';
        }

        // 클라이언트로 전달
        const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        if (clientsList.length) {
          clientsList[0].postMessage({ type: 'shared-payload', payloadText });
          await clientsList[0].focus();
        } else {
          // 앱이 닫혀있을 경우, 쿼리 파라미터로 데이터를 전달하는 것은 복잡하므로,
          // 우선 앱을 여는 것까지만 처리합니다. 사용자가 다시 공유를 시도할 수 있습니다.
          await self.clients.openWindow('/');
        }

        return Response.redirect('/', 303);
      } catch (e) {
        console.error('Share target fetch failed:', e);
        return Response.redirect('/', 303);
      }
    })());
    return; // 이 요청은 여기서 처리를 종료합니다.
  }

  // 그 외의 모든 GET 요청은 위에서 선언된 라우팅 규칙들이 처리합니다.
});
