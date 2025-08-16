# Design Refresh Kit v1 — 설치
1) **index.html**의 `<head>`에 `ADD_TO_index.html.txt` 내용을 붙여 넣습니다.
2) `src/styles/design-tokens.css`와 `src/styles/global.css`를 레포에 그대로 추가합니다.
3) 다크모드를 쓰려면 루트 요소(html 또는 body)에 `class="dark"` 토글만 하면 됩니다.

## 권장 Tailwind 설정
- 타이포그래피 플러그인 설치: `npm i -D @tailwindcss/typography`
- tailwind.config.js:
  ```js
  module.exports = { darkMode: 'class', plugins: [require('@tailwindcss/typography')] }
  ```

## 적용 팁
- 읽기 레이아웃: 본문 래퍼에 `container-readable` 클래스를 추가합니다.
- 카드: 섹션 래퍼에 `card p-4`를 사용하세요.
- 버튼: `btn` 또는 `btn btn-primary` 사용.
- 배너: 상태 메시지에 `banner` 클래스 사용.

## 출처(요약)
- 라인 길이 50–75자 권장 (Baymard, Smashing Magazine)
- 명암비 AA 4.5:1 이상 (WCAG)
- PWA safe-area: `env(safe-area-inset-*)` (MDN)
