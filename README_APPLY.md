
덮어쓰기 위치(레포 루트 기준)
- manifest.webmanifest
- sw.js
- icon-192.png / icon-512.png / apple-touch-icon.png / favicon-32.png
- public/_redirects
- src/lib/install.ts
- src/pages/SettingsPage.tsx

라우터에 경로 추가(App.tsx):
  import SettingsPage from './pages/SettingsPage';
  // ...
  <Routes>
    {/* ... */}
    <Route path="/settings" element={<SettingsPage />} />
  </Routes>

index.html 확인(없으면 추가):
  <link rel="manifest" href="/manifest.webmanifest" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js');
      });
    }
  </script>

Netlify:
  Build: npm ci && npm run build
  Publish: dist
  Base directory: (빈칸)
  Deploys → Clear cache and deploy site

브라우저:
  배포 후 하드 새로고침(Ctrl/Cmd+Shift+R)
  PWA 설치된 경우 DevTools→Application→Service Workers→Update 또는 Unregister→새로고침
