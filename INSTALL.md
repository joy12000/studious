# 설치 안내 (캡처 페이지 고정: v5.1)

이 zip을 **레포 루트**에 그대로 덮어쓰면 끝입니다.
GitHub > Add file > **Upload files** 로 업로드하고 Commit 하세요.

## 포함 내용
- src/pages/CapturePage.tsx  → 우하단 파란 FAB에 강화 붙여넣기 바인딩 + 저장 실패 메시지 + dataset 하이픈 에러 수정
- src/lib/clipboard.ts        → 안전한 클립보드 읽기 헬퍼
- src/lib/createNoteAdapter.ts→ 다양한 safeCreateNote 시그니처/반환값 지원
- src/lib/topicSuggest.ts     → 라이트 버전 AI 주제 추천
- src/components/TemplatePicker.tsx → 팝업 대비(가독성) 향상
- CHANGELOG.md, UPDATED_FILES.txt

## 빌드/배포
- 추가 의존성 없음
- Netlify: `npm ci && npm run build` 그대로

## 테스트
1) 홈 → CAPTURE 진입 시 오류 없어야 함
2) 우하단 파란 **붙여넣기** 클릭 → 텍스트 영역에 붙음
3) **이 내용으로 저장** → `/note/:id` 이동
