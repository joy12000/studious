const VERSION = 'sw-v11'; // Version updated to ensure SW update
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

// Listen for fetch events
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 💡 [수정] 공유된 파일을 처리하는 로직 추가
  if (event.request.method === 'POST' && url.pathname === '/handle-shared-note') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const file = formData.get('shared_file'); // manifest에서 지정한 'name'

        if (file instanceof File) {
          // 열려있는 모든 클라이언트(탭)를 찾습니다.
          const clients = await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true
          });

          if (clients.length > 0) {
            // 첫 번째 클라이언트를 포커스하고 파일 데이터를 메시지로 보냅니다.
            await clients[0].focus();
            clients[0].postMessage({ file: file, type: 'shared-file' });
          } else {
            // 열려있는 클라이언트가 없으면 앱을 새로 엽니다.
            // (이 경우, App.tsx의 launchQueue가 처리하게 됩니다)
            self.clients.openWindow('/');
          }
        }
        
        // 처리 후 메인 페이지로 리디렉션합니다.
        return Response.redirect('/', 303);
      } catch (error) {
        console.error('Share target fetch handler failed:', error);
        // 오류 발생 시에도 메인 페이지로 이동
        return Response.redirect('/', 303);
      }
    })());
    return; // respondWith가 처리하므로 여기서 종료
  }

  // ... (기존의 네트워크 우선 캐싱 로직은 그대로 유지)
  const req = event.request;
  event.respondWith(
    fetch(req)
      .then((res) => {
        const resClone = res.clone();
        caches.open('selfdev-cache-v1').then((cache) => cache.put(req, resClone));
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('/index.html')))
  );
});
