# Studious 프로젝트 인수인계 문서

## 1. 프로젝트 개요

**Studious**는 학생들의 학습 효율성을 극대화하기 위해 설계된 AI 기반 노트 필기 및 학습 보조 PWA(Progressive Web App)입니다. 사용자는 강의 자료(PDF, 이미지, 텍스트)를 업로드하여 AI가 생성하는 맞춤형 복습 노트, 참고서, 문제 풀이 등을 제공받을 수 있습니다. 또한, 유튜브 영상 요약, AI 튜터와의 대화, 일정 관리 등 다양한 부가 기능을 통해 통합적인 학습 경험을 지원합니다.

-   **Repository:** (Git 저장소 URL을 여기에 추가하세요)
-   **Live URL:** (배포된 서비스 URL을 여기에 추가하세요)

## 2. 기술 스택

### 2.1. 프론트엔드

-   **Core:** React 18, TypeScript
-   **Build Tool:** Vite
-   **Routing:** React Router
-   **Styling:** Tailwind CSS
-   **UI Components:**
    -   shadcn/ui (Radix UI 기반)
    -   `lucide-react` (아이콘)
-   **State Management:** Dexie.js (IndexedDB 기반 로컬 데이터베이스), React Hooks/Context
-   **PWA:** `vite-plugin-pwa`를 사용하여 PWA 기능 구현 (오프라인 지원, 홈 화면 설치 등)
-   **Rich Text & Rendering:**
    -   `@tiptap/react`: 텍스트 에디터
    -   `marked`: Markdown 렌더링
    -   `mermaid`: 다이어그램 시각화
    -   `katex`: LaTeX 수학 수식 렌더링
    -   `highlight.js`: 코드 블록 하이라이팅

### 2.2. 백엔드 (Serverless Functions)

-   **Platform:** Vercel Serverless Functions
-   **Language:** Python 3.x
-   **Framework:** Flask (Vercel 환경에서 서버리스 함수로 자동 변환)
-   **Core Libraries:**
    -   `google-generativeai`: Google Gemini API 연동
    -   `requests`: 외부 API 호출
    -   `Pillow`, `pdf2image`: 이미지 및 PDF 처리
    -   `youtube-transcript`: 유튜브 영상 스크립트 추출

### 2.3. 주요 외부 서비스

-   **Google Gemini API:** AI 기반 콘텐츠 생성 (요약, 문제 풀이, 채팅 등)
-   **OpenRouter API:** 다양한 LLM 모델을 활용한 AI 채팅 기능
-   **Vercel Blob:** 파일 업로드 및 임시 저장
-   **Apify:** 유튜브 영상 스크립트 추출

## 3. 프로젝트 구조

```
studious/
├── api/                  # Vercel 서버리스 함수 (Python/Flask)
│   ├── assignment_helper.py  # 과제 채점 및 풀이
│   ├── chat.py               # AI 튜터 채팅
│   ├── create_review_note.py # 복습 노트 생성
│   ├── create_textbook.py    # 참고서 생성
│   ├── process_calendar.py   # 시간표 이미지 분석
│   └── summarize_youtube.py  # 유튜브 영상 요약
├── public/               # 정적 에셋 (아이콘, PWA 매니페스트 등)
├── src/                  # React 애플리케이션 소스 코드
│   ├── components/         # 재사용 가능한 UI 컴포넌트
│   ├── lib/                # 데이터베이스, 유틸리티, 커스텀 훅
│   ├── pages/              # 페이지 단위 컴포넌트
│   ├── App.tsx             # 메인 애플리케이션 컴포넌트
│   └── main.tsx            # 애플리케이션 진입점
├── package.json          # 프론트엔드 의존성 및 스크립트
├── requirements.txt      # 백엔드(Python) 의존성
├── vite.config.ts        # Vite 설정 (PWA, 빌드 최적화 등)
└── tailwind.config.js    # Tailwind CSS 설정
```

## 4. 주요 기능 및 API 엔드포인트

### 4.1. AI 기반 콘텐츠 생성

-   **복습 노트 생성 (`/api/create_review_note`)**
    -   **입력:** 강의 자료(PDF, 이미지, 텍스트), 과목 정보
    -   **처리:** Gemini API를 호출하여 코넬 노트 형식의 복습 노트(핵심 질문, 노트, 요약)를 생성합니다.
    -   **출력:** Markdown 형식의 노트 본문, 핵심 인사이트, 퀴즈 등이 포함된 JSON 데이터

-   **참고서 생성 (`/api/create_textbook`)**
    -   **입력:** 강의 자료, 과목 정보
    -   **처리:** Gagne의 9단계 수업 이론과 백워드 설계를 접목한 프롬프트를 사용하여 심층 참고서를 생성합니다.
    -   **출력:** Markdown 형식의 참고서 본문

-   **과제 도우미 (`/api/assignment_helper`)**
    -   **입력:** 문제 파일, (선택적) 학생 답안 파일, 참고 자료
    -   **처리:** 답안 유무에 따라 문제 풀이 또는 채점 및 피드백을 제공합니다.
    -   **출력:** 풀이 과정, 채점 결과, 모범 답안 등이 포함된 JSON 데이터

### 4.2. AI 튜터 채팅

-   **AI 채팅 (`/api/chat`)**
    -   **입력:** 대화 기록, 현재 노트 내용(컨텍스트), 모델 선택
    -   **처리:** OpenRouter 또는 Gemini API를 통해 스트리밍 방식으로 답변을 생성합니다. 현재 보고 있는 노트 내용을 참고하여 맥락에 맞는 답변을 제공합니다.
    -   **출력:** Server-Sent Events (SSE) 스트림

### 4.3. 유틸리티 기능

-   **유튜브 영상 요약 (`/api/summarize_youtube`)**
    -   **입력:** 유튜브 영상 URL
    -   **처리:** Apify로 영상 스크립트를 추출한 후, Gemini API를 통해 요약, 제목, 태그, 핵심 인사이트를 생성합니다.
    -   **출력:** 요약 정보가 담긴 JSON 데이터

-   **시간표 처리 (`/api/process_calendar`)**
    -   **입력:** 시간표 이미지 또는 PDF 파일
    -   **처리:** Gemini (Vision) API를 사용하여 이미지 내의 텍스트를 분석하고, 과목명, 시간, 요일을 추출합니다.
    -   **출력:** 일정 정보가 담긴 JSON 배열

## 5. 로컬 개발 환경 설정

### 5.1. 사전 준비

-   Node.js (v18 이상) 및 npm
-   Python (v3.9 이상) 및 pip
-   Git

### 5.2. 설치 및 실행

1.  **저장소 클론:**
    ```bash
    git clone <repository_url>
    cd studious
    ```

2.  **환경 변수 설정:**
    -   프로젝트 루트에 `.env` 파일을 생성합니다.
    -   아래 내용을 참고하여 API 키를 입력합니다. Vercel 배포 시에는 Vercel 프로젝트의 환경 변수로 등록해야 합니다.
    ```
    # Google Gemini API Keys (여러 개 설정하여 순차적으로 사용)
    GEMINI_API_KEY_PRIMARY=...
    GEMINI_API_KEY_SECONDARY=...
    GEMINI_API_KEY_TERTIARY=...
    GEMINI_API_KEY_QUATERNARY=...

    # OpenRouter API Keys
    OPENROUTER_API_KEY_PRIMARY=...
    # ... (추가 키)

    # Vercel Blob Token
    BLOB_READ_WRITE_TOKEN=...

    # Apify (for YouTube Summarizer)
    APIFY_ENDPOINT=...
    APIFY_TOKEN=...
    ```

3.  **프론트엔드 의존성 설치:**
    ```bash
    npm install
    ```

4.  **백엔드 의존성 설치:**
    -   가상 환경 생성을 권장합니다.
    ```bash
    python -m venv venv
    source venv/bin/activate  # macOS/Linux
    # venv\Scripts\activate    # Windows

    pip install -r requirements.txt
    ```

5.  **개발 서버 실행:**
    -   프론트엔드와 백엔드(서버리스 함수)를 동시에 실행하기 위해 Vercel CLI를 사용합니다.
    ```bash
    npm install -g vercel
    vercel dev
    ```
    -   `vercel dev` 명령어는 `vite` 개발 서버와 Python 서버리스 함수를 함께 실행하여 로컬 환경에서 전체 기능을 테스트할 수 있게 해줍니다.

## 6. 주요 로직 및 아키텍처

### 6.1. API 키 폴백(Fallback) 메커니즘

-   대부분의 Python API( `chat.py`, `assignment_helper.py` 등)는 여러 개의 API 키를 환경 변수에서 로드하도록 설계되었습니다.
-   API 요청 실패 시, 다음 순서의 키로 자동 전환하여 재시도합니다. 이를 통해 특정 키의 사용량 제한이나 일시적인 오류에 대한 안정성을 높였습니다.

### 6.2. 데이터 관리 (Dexie.js)

-   애플리케이션의 모든 데이터(노트, 과목, 설정 등)는 브라우저의 IndexedDB에 저장됩니다.
-   `src/lib/db.ts` 파일에 데이터베이스 스키마와 관련 로직이 정의되어 있습니다.
-   `dexie-react-hooks`를 사용하여 React 컴포넌트에서 쉽게 데이터를 조회하고 업데이트할 수 있습니다.

### 6.3. 동적 콘텐츠 렌더링

-   `MarkdownRenderer.tsx` 컴포넌트는 AI가 생성한 Markdown 콘텐츠를 React 컴포넌트로 변환하는 역할을 합니다.
-   `marked`로 기본 Markdown을 파싱하고, `mermaid`, `katex`, `highlight.js`를 이용해 다이어그램, 수학 수식, 코드 블록을 렌더링합니다.
-   `<dfn>` 태그는 툴팁으로, `visual` 코드 블록은 `VisualRenderer.tsx`를 통해 커스텀 JSON 기반 UI로 렌더링됩니다.

## 7. 배포

-   이 프로젝트는 Vercel에 최적화되어 있습니다.
-   Git 저장소를 Vercel에 연결하고, 프레임워크 프리셋을 "Vite"로 설정하면 자동으로 빌드 및 배포가 진행됩니다.
-   `api` 디렉토리의 Python 파일들은 자동으로 서버리스 함수로 배포됩니다.
-   **중요:** 배포 전 Vercel 프로젝트 설정에서 모든 환경 변수(`GEMINI_API_KEY_*`, `OPENROUTER_API_KEY_*` 등)를 반드시 등록해야 합니다.
