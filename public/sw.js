import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Dexie.js 임포트
importScripts('https://unpkg.com/dexie@4.0.11/dist/dexie.js');

// Dexie DB 인스턴스 생성
const db = new Dexie('selfdev-db');
db.version(6).stores({
  notes: 'id, createdAt, noteType, subjectId, favorite, sourceType, attachments',
  subjects: '&id, name, color',
  schedule: '&id, date, startTime, endTime, subjectId, dayOfWeek',
  quizzes: '&id, noteId',
  reviewItems: '&id, noteId, nextReviewDate',
  settings: 'id',
  topicRules: '++id, &topic, *keywords',
});


async function showSafeNotification(title, options) {
  if (self.Notification && self.Notification.permission === 'granted') {
    try {
      await self.registration.showNotification(title, options);
    } catch (e) {
      console.error('Error showing notification:', e);
    }
  } else {
    console.log('Notification permission not granted. Skipping notification.');
  }
}

// 서비스 워커의 생명주기 이벤트를 제어합니다.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GENERATE_TEXTBOOK') {
    const { payload } = event.data;
    event.waitUntil((async () => {
      try {
        const response = await fetch('/api/create_textbook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload.body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API request failed with status ${response.status}: ${errorText}`);
        }

        const result = await response.json();

        await db.notes.update(payload.noteId, {
          title: result.title,
          content: result.content,
          subjectId: result.subjectId,
          updatedAt: Date.now(),
        });

        await showSafeNotification('참고서 생성 완료!', {
          body: `\'${result.title}\' 생성이 완료되었습니다.`,
          icon: '/icon-192.png',
          data: { url: `/note/${payload.noteId}` }
        });

      } catch (error) {
        console.error('Textbook generation failed in service worker:', error);
        await db.notes.update(payload.noteId, {
            title: '[생성 실패] 참고서',
            content: `오류가 발생하여 참고서 생성을 완료하지 못했습니다.\n\n${error.message}`
        });
        await showSafeNotification('참고서 생성 실패', {
          body: '오류가 발생하여 참고서를 생성하지 못했습니다.',
          icon: '/icon-192.png',
        });
      }
    })());
  } else if (event.data && event.data.type === 'GENERATE_REVIEW_NOTE') {
    const { payload } = event.data;
    event.waitUntil((async () => {
      try {
        const response = await fetch('/api/create_review_note', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload.body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API request failed with status ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        const { title, content, key_insights, quiz, subjectId } = result;

        await db.notes.update(payload.noteId, {
          title,
          content,
          key_insights,
          subjectId,
          updatedAt: Date.now(),
        });

        if (quiz && Array.isArray(quiz.questions)) {
            const newQuiz = {
                id: self.crypto.randomUUID(),
                noteId: payload.noteId,
                questions: quiz.questions,
            };
            await db.quizzes.add(newQuiz);
        }

        await showSafeNotification('복습 노트 생성 완료!', {
          body: `\'${title}\' 생성이 완료되었습니다.`,
          icon: '/icon-192.png',
          data: { url: `/note/${payload.noteId}` }
        });

      } catch (error) {
        console.error('Review note generation failed in service worker:', error);
        await db.notes.update(payload.noteId, {
            title: '[생성 실패] 복습 노트',
            content: `오류가 발생하여 복습 노트 생성을 완료하지 못했습니다.\n\n${error.message}`
        });
        await showSafeNotification('복습 노트 생성 실패', {
          body: '오류가 발생하여 복습 노트를 생성하지 못했습니다.',
          icon: '/icon-192.png',
        });
      }
    })());
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow(event.notification.data.url || '/')
  );
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
