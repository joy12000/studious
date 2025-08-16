PATCH: Robust capture paste (GitHub 덮어쓰기용)
----------------------------------------------
- 붙여넣기 중 예외가 React까지 전파되어 ErrorBoundary가 뜨던 문제 해결.
- 권한 거부/빈 클립보드/예외 모두 try/catch로 안전 처리.
- 저장은 안전 헬퍼를 통해 수행하고, 완료 후 하드 네비게이션 /note/:id 로 이동.

파일
- src/lib/safeCreateNote.ts  (신규)
- src/pages/CapturePage.tsx  (교체)

적용법
1) 이 zip을 레포 루트에 그대로 덮어쓰기
2) git add -A && git commit -m "fix(capture): robust paste" && git push
3) 배포 후 /capture 에서 정상 동작 확인