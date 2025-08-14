APPLY GUIDE
============
1) 이 zip을 레포 루트에 그대로 덮어쓰기 커밋합니다.
2) GitHub에서 DELETE_THESE.txt를 열어, 표기된 루트 중복 파일들을 삭제하고 커밋합니다.
3) Netlify 빌드가 자동으로 시작됩니다.

Doctor 실행을 보장하는 방법은 2가지입니다.
- (기본) package.json에 prebuild가 포함되어 있어, 어디서든 `npm run build` 전에 doctor가 실행됩니다.
- (추가옵션) netlify.toml도 포함되어 있으니 사용하려면 레포 루트에 넣으세요.
  둘 다 적용해도 문제는 없지만, 그러면 doctor가 2번 실행될 수 있습니다(무해).

검증 체크:
- 빌드 로그에 [doctor] 메시지가 보이면 정상 실행.
- 배포 후 /favicon.ico, /favicon-32.png, /apple-touch-icon.png 가 열리면 OK.
- Service Worker: DevTools → Application → Service Workers → "Activated and is running".
