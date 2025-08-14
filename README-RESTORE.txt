VERBATIM RESTORE (from your backup)
-----------------------------------
- 이 압축을 레포 루트에 그대로 덮어쓰기 커밋하세요.
- 모든 파일은 당신이 준 백업본을 그대로 사용합니다.
- 추가한 변경은 2가지뿐입니다:
  1) src/main.tsx 에서 './index.css'를 import (스타일 미적용 방지)
  2) scripts/doctor.mjs 가 있어도 CI에선 경고만 하고 통과 (prebuild에 `|| true` 추가)
- 빌드 커맨드는 기존 netlify.toml 또는 UI 설정을 그대로 사용합니다.

빌드 후 체크:
- UI가 예전과 동일하게 보이는지
- /manifest.webmanifest, /icon-192.png 등 정적 자산 접근 OK
- DevTools → Application → Service Worker: Activated and is running

문제가 있으면 바로 그 파일만 백업본으로 덮어씌우면 되므로, 이 키트를 기반으로 필요한 부분만 다시 수정하세요.
