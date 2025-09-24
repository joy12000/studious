--- /dev/null
+++ b/api/create_review_note.py
@@ -0,0 +1,141 @@
+from http.server import BaseHTTPRequestHandler
+import json
+import os
+import google.generativeai as genai
+import tempfile
+import shutil
+from PIL import Image
+import traceback
+
+class handler(BaseHTTPRequestHandler):
+
+    def do_POST(self):
+        api_keys = [
+            os.environ.get('GEMINI_API_KEY_PRIMARY'),
+            os.environ.get('GEMINI_API_KEY_SECONDARY'),
+            os.environ.get('GEMINI_API_KEY_TERTIARY'),
+            os.environ.get('GEMINI_API_KEY_QUATERNARY'),
+            os.environ.get('GEMINI_API_KEY')
+        ]
+        valid_keys = [key for key in api_keys if key]
+
+        if not valid_keys:
+            return self.handle_error(ValueError("설정된 Gemini API 키가 없습니다."), "API 키 설정 오류", 500)
+
+        last_error = None
+        job_id = None
+        job_dir = None
+
+        try:
+            content_length = int(self.headers['Content-Length'])
+            post_data = self.rfile.read(content_length)
+            data = json.loads(post_data)
+
+            job_id = data.get('jobId')
+            ai_conversation_text = data.get('aiConversationText', '')
+            subjects = data.get('subjects', [])
+            note_date = data.get('noteDate')
+
+            if job_id and (not isinstance(job_id, str) or '/' in job_id or '..' in job_id):
+                return self.handle_error(ValueError("유효하지 않은 jobId 입니다."), status_code=400)
+
+            if job_id:
+                job_dir = os.path.join(tempfile.gettempdir(), job_id)
+                if not os.path.isdir(job_dir):
+                    return self.handle_error(FileNotFoundError(f"작업 디렉토리를 찾을 수 없습니다: {job_dir}"), status_code=404)
+
+            prompt = f"""
+            당신은 인지과학과 교육심리학에 기반한 학습 전문가입니다. 제공된 학습 자료(텍스트, 이미지)와 기존 노트 내용을 종합하여, 학생의 메타인지를 자극하고 지식의 구조화를 돕는 '복습 노트'와 '확인 퀴즈'를 생성해야 합니다.
+
+            # 1. 복습 노트 생성 규칙
+            - **핵심 요약 (summary):** 모든 자료의 핵심 내용을 응축하여, 학생들이 전체 내용을 빠르게 파악할 수 있는 1~3문단의 요약문을 생성합니다. 중요한 키워드는 **굵은 글씨**로 강조하세요.
+            - **주요 개념 (key_insights):** 학습 내용에서 가장 중요한 개념, 원리, 또는 공식 3~5가지를 목록 형태로 추출합니다.
+            - **과목 분류 (subjectId):** 제공된 과목 목록(subjects)을 참고하여, 내용과 가장 관련성이 높은 과목의 `id`를 정확히 선택합니다.
+
+            # 2. 확인 퀴즈 생성 규칙 (quiz)
+            - **목표:** 핵심 요약과 주요 개념을 잘 이해했는지 확인할 수 있는 5지선다형 객관식 문제 5개를 생성합니다.
+            - **구조:** `questions` 배열 안에 각 문제가 `question`, `options` (5개 선택지 배열), `answer` (정답 텍스트) 형식으로 포함되어야 합니다.
+
+            # 3. 입력 데이터
+            - **기존 노트 내용:** {ai_conversation_text}
+            - **과목 목록:** {json.dumps(subjects, ensure_ascii=False)}
+
+            # 4. 최종 출력 형식 (JSON)
+            - 반드시 아래와 같은 키를 가진 단일 JSON 객체로만 응답해야 합니다. 다른 설명은 절대 추가하지 마세요.
+            {{
+              "title": "AI가 생성한 복습 노트의 제목",
+              "summary": "마크다운 서식이 적용된 핵심 요약문입니다.",
+              "key_insights": ["핵심 개념 1", "핵심 개념 2", "핵심 개념 3"],
+              "subjectId": "선택된 과목의 ID",
+              "quiz": {{
+                "questions": [
+                  {{
+                    "question": "첫 번째 퀴즈 질문입니다.",
+                    "options": ["선택지 1", "선택지 2", "선택지 3", "선택지 4", "선택지 5"],
+                    "answer": "정답 선택지"
+                  }}
+                ]
+              }}
+            }}
+            """
+            
+            request_contents = [prompt]
+            if job_dir:
+                for filename in sorted(os.listdir(job_dir)):
+                    file_path = os.path.join(job_dir, filename)
+                    try:
+                        if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
+                            request_contents.append(Image.open(file_path))
+                    except Exception as file_err:
+                        print(f"WARN: 이미지 파일 처리 실패 ('{filename}'): {file_err}")
+
+            for i, api_key in enumerate(valid_keys):
+                try:
+                    print(f"INFO: API 키 #{i + 1} (으)로 복습 노트 생성 시도...")
+                    genai.configure(api_key=api_key)
+                    model = genai.GenerativeModel('gemini-1.5-flash-latest')
+                    
+                    response = model.generate_content(request_contents, request_options={'timeout': 120})
+                    
+                    raw_text = response.text.replace('```json', '').replace('```', '').strip()
+                    json_response = json.loads(raw_text)
+
+                    self.send_response(200)
+                    self.send_header('Content-type', 'application/json; charset=utf-8')
+                    self.end_headers()
+                    self.wfile.write(json.dumps(json_response, ensure_ascii=False).encode('utf-8'))
+                    return
+
+                except Exception as e:
+                    last_error = e
+                    print(f"WARN: API 키 #{i + 1} 사용 실패. 다음 키로 폴백합니다. 오류: {e}")
+                    continue
+
+            raise ConnectionError("모든 Gemini API 키로 요청에 실패했습니다.") from last_error
+
+        except Exception as e:
+            self.handle_error(e, "복습 노트 생성 중 오류 발생")
+        finally:
+            if job_dir and os.path.exists(job_dir):
+                try:
+                    shutil.rmtree(job_dir)
+                    print(f"INFO: 임시 디렉토리 삭제 완료: {job_dir}")
+                except Exception as cleanup_error:
+                    print(f"ERROR: 임시 디렉토리 삭제 실패 ('{job_dir}'): {cleanup_error}")
+
+    def handle_error(self, e, message="오류 발생", status_code=500):
+        print(f"ERROR: {message} - {e}")
+        traceback.print_exc()
+        if not hasattr(self, '_headers_sent') or not self._headers_sent:
+            try:
+                self.send_response(status_code)
+                self.send_header('Content-type', 'application/json; charset=utf-8')
+                self.end_headers()
+                error_details = {"error": message, "details": str(e)}
+                self.wfile.write(json.dumps(error_details, ensure_ascii=False).encode('utf-8'))
+            except Exception as write_error:
+                print(f"FATAL: 오류 응답 전송 중 추가 오류 발생: {write_error}")
+
+```

이 변경 사항들을 적용하고 다시 시도해보시면, 파일과 텍스트 데이터가 각각 올바른 API로 전송되어 오류 없이 복습 노트가 생성될 것입니다.

<!--
[PROMPT_SUGGESTION]AI 복습 노트 생성 시, 생성된 퀴즈를 자동으로 복습 덱에 추가하는 기능을 구현해줘.[/PROMPT_SUGGESTION]
[PROMPT_SUGGESTION]노트 목록 페이지에서 과목별로 노트를 필터링하는 UI를 추가해줘.[/PROMPT_SUGGESTION]
-->
