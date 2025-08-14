RESTORE KIT (backup6-fixed)
---------------------------
이 압축을 레포 루트에 그대로 덮어쓰기 커밋하세요.
- 손상된 코드/설정은 작동하는 최소 구현으로 교체됨
- public/ 은 백업의 파일을 사용(아이콘/매니페스트/pwa-boot 유지)
- Netlify는 netlify.toml의 command로 빌드합니다: npm ci && npm run build

빌드 후 검증:
1) /favicon.ico, /icon-192.png, /manifest.webmanifest 접근 확인
2) DevTools → Application → Service Worker: Activated
3) 홈에서 노트 추가/검색/즐겨찾기 동작
