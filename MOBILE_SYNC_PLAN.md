# 모바일 동기화 RLS 적용 계획

Clerk 인증과 연동하여 `synced_media` 테이블에 RLS(Row-Level Security)를 적용하기 위한 SQL 정책입니다.

아래 4개의 SQL 쿼리를 순서대로 **Supabase 대시보드의 SQL Editor**에서 실행해주세요.

---

### 1. `user_id` 컬럼 추가

`synced_media` 테이블에 Clerk 사용자의 ID를 저장할 `user_id` 텍스트 컬럼을 추가합니다. (이미 컬럼이 있다면 이 명령은 무시됩니다.)

```sql
ALTER TABLE public.synced_media ADD COLUMN IF NOT EXISTS user_id TEXT;
```

### 2. RLS (행 수준 보안) 활성화

`synced_media` 테이블에 RLS를 활성화하여, 앞으로 정의될 정책에 따라 접근을 제어합니다.

```sql
ALTER TABLE public.synced_media ENABLE ROW LEVEL SECURITY;
```

### 3. SELECT (조회) 정책 생성

사용자가 자신의 `user_id`와 일치하는 미디어만 조회할 수 있도록 허용하는 정책입니다. `auth.jwt()->>'sub'`는 요청에 포함된 Clerk 인증 토큰에서 사용자 ID(subject)를 추출하는 Supabase 함수입니다.

```sql
CREATE POLICY "Users can view their own media"
ON public.synced_media FOR SELECT
TO authenticated
USING ( (select auth.jwt()->>'sub') = user_id );
```

### 4. INSERT (삽입) 정책 생성

사용자가 자신의 `user_id`를 사용하여 새로운 미디어를 삽입하는 것만 허용하는 정책입니다. 다른 사용자의 ID로 데이터를 추가하려는 시도를 막습니다.

```sql
CREATE POLICY "Users can insert their own media"
ON public.synced_media FOR INSERT
TO authenticated
WITH CHECK ( (select auth.jwt()->>'sub') = user_id );
```