# 모바일-PC 이미지 동기화 기능 구현 계획

이 문서는 모바일 기기에서 촬영한 사진을 PC 채팅창에서 실시간으로 받아보고 첨부하는 기능의 구현 계획을 설명합니다.

---

### ✅ 1단계: Supabase 프로젝트 설정 및 환경 변수 연결

**목표:** Supabase 프로젝트를 생성하고, 웹 애플리케이션이 Supabase와 통신하는 데 필요한 기본 정보를 연결합니다.

**상태:** 이 단계는 사용자가 **완료**한 것으로 확인되었습니다.

**수행 내용:**
1.  Supabase 공식 홈페이지에서 새 프로젝트를 생성합니다.
2.  프로젝트 대시보드의 **Settings -> API** 메뉴로 이동합니다.
3.  **Project URL**과 **Project API Keys** 섹션에 있는 `anon` `public` 키를 복사합니다.
4.  프로젝트의 `.env` 파일에 아래와 같이 환경 변수를 추가하고, 복사한 값을 붙여넣습니다.

    ```
    VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
    VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
    ```

---

### ❓ 2단계: 스토리지 버킷 생성 및 정책 설정

**목표:** 업로드된 이미지 파일을 실제로 저장할 클라우드 저장 공간('버킷')을 만듭니다.

**수행 방법:**
1.  Supabase 대시보드 왼쪽 메뉴에서 **Storage** 아이콘(원통 모양)을 클릭합니다.
2.  **'+ New bucket'** 버튼을 클릭합니다.
3.  버킷 이름으로 `synced_media` 를 입력하고, **'Public'** 옵션은 체크 해제된 상태로 둡니다.
4.  **'Create bucket'** 버튼을 눌러 버킷을 생성합니다.
5.  `synced_media` 버킷 위에 마우스를 올리면 나타나는 점 3개(...) 메뉴를 클릭하고 **'Policies'**를 선택합니다.
6.  이전에 추가한 정책이 있다면 모두 삭제하고, **'+ New Policy'** 버튼을 누른 뒤 **'From scratch'** 옵션을 선택합니다.
7.  **첫 번째 정책 (읽기 권한)** 을 위해 아래와 같이 입력하고 저장합니다:
    *   **Policy name**: `Public Read Access`
    *   **Allowed operation**: `SELECT` 에 체크
    *   **Policy definition (USING expression)**: `true`
8.  다시 **'+ New Policy'** -> **'From scratch'** 를 선택합니다.
9.  **두 번째 정책 (쓰기 권한)** 을 위해 아래와 같이 입력하고 저장합니다:
    *   **Policy name**: `Public Write Access`
    *   **Allowed operation**: `INSERT` 에 체크
    *   **Policy definition (WITH CHECK expression)**: `true`

---

### ❓ 3단계: 데이터베이스 테이블 생성 및 실시간 설정

**목표:** 업로드된 이미지의 URL과 메타데이터를 저장할 '장부'(데이터베이스 테이블)를 만들고, 이 테이블의 변경사항을 실시간으로 감지하도록 설정합니다.

**수행 방법:**
1.  왼쪽 메뉴에서 **'SQL Editor'**(<> 모양 아이콘)를 선택합니다.
2.  **'+ New query'** 버튼을 클릭합니다.
3.  아래의 SQL 코드를 복사하여 붙여넣고, **'RUN'** 버튼을 누릅니다.

    ```sql
    -- 1. 'synced_media' 테이블 생성
    CREATE TABLE public.synced_media (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
      url TEXT NOT NULL,
      user_id TEXT -- 향후 사용자별 구분을 위해 예약된 필드
    );

    -- 2. 테이블에 대한 설명 추가
    COMMENT ON TABLE public.synced_media IS 'Stores URLs of media synced from mobile devices.';

    -- 3. Row Level Security (RLS) 활성화
    ALTER TABLE public.synced_media ENABLE ROW LEVEL SECURITY;

    -- 4. 모든 사용자가 미디어를 볼 수 있는 정책 생성
    CREATE POLICY "Allow all users to view media"
    ON public.synced_media FOR SELECT
    USING (true);

    -- 5. 모든 사용자가 새 미디어를 추가할 수 있는 정책 생성
    CREATE POLICY "Allow all users to insert media"
    ON public.synced_media FOR INSERT
    WITH CHECK (true);
    ```

4.  테이블 생성이 완료되면, 왼쪽 메뉴에서 **'Database'** -> **'Replication'**으로 이동합니다.
5.  'Source' 섹션에서 **'n tables'** 라고 표시된 링크를 클릭합니다.
6.  `public` 스키마에서 방금 생성한 `synced_media` 테이블을 찾아 체크박스를 선택하고 **'Save'** 버튼을 누릅니다.

---

### 🚀 4단계: 기능 구현 (AI 에이전트 수행)

**목표:** 위에서 준비된 Supabase 인프라를 사용하여 실제 기능을 코드로 구현합니다.

**수행 내용:**
1.  **API 엔드포인트 생성 (`api/add-synced-media.py`):**
    -   모바일 기기에서 이미지 파일을 받아 Supabase Storage에 업로드합니다.
    -   업로드 성공 시 반환된 공개 URL을 `synced_media` 데이터베이스 테이블에 저장합니다.
2.  **모바일 업로드 페이지 생성 (`/m/upload`):**
    -   사용자가 사진을 찍거나 앨범에서 선택할 수 있는 간단한 UI를 제공합니다.
    -   선택된 이미지를 위 API로 전송합니다.
3.  **PC 채팅 UI 연동 (`ChatUI.tsx`):**
    -   '모바일에서 가져오기' 버튼 및 팝업 UI를 구현합니다.
    -   Supabase의 실시간 구독 기능을 사용하여 `synced_media` 테이블에 새 이미지가 추가되는 것을 감지하고 팝업 목록을 자동으로 업데이트합니다.
    -   팝업에서 이미지를 클릭하면, 해당 이미지를 채팅창에 첨부 파일로 추가하는 로직을 구현합니다.
