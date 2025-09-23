# api/assignment_helper.py

from http.server import BaseHTTPRequestHandler
import json
import os
import google.generativeai as genai
import cgi
from PIL import Image
import io
import traceback
from pdf2image import convert_from_bytes

class handler(BaseHTTPRequestHandler):
    def handle_error(self, e, message="오류 발생", status_code=500):
        print(f"ERROR: {message} - {e}")
        traceback.print_exc()
        if not hasattr(self, '_headers_sent') or not self._headers_sent:
            try:
                self.send_response(status_code)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.end_headers()
                error_details = {"error": message, "details": str(e)}
                self.wfile.write(json.dumps(error_details).encode('utf-8'))
            except Exception as write_error:
                print(f"FATAL: 오류 응답 전송 중 추가 오류 발생: {write_error}")

    def do_POST(self):
        #  erweitertes API-Schlüssel-Fallback
        api_keys = [
            os.environ.get('GEMINI_API_KEY_PRIMARY'),
            os.environ.get('GEMINI_API_KEY_SECONDARY'),
            os.environ.get('GEMINI_API_KEY_TERTIARY'),
            os.environ.get('GEMINI_API_KEY_QUATERNARY'),
            os.environ.get('GEMINI_API_KEY') # Legacy-Kompatibilität
        ]
        valid_keys = [key for key in api_keys if key]

        if not valid_keys:
            return self.handle_error(ValueError("설정된 Gemini API 키가 없습니다."), "API 키 설정 오류", 500)

        last_error = None

        try:
            # --- 1. 데이터 파싱 ---
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': self.headers['Content-Type']}
            )
            
            note_context = form.getvalue('note_context', '')
            reference_files = form.getlist('reference_files')
            problem_files = form.getlist('problem_files')
            answer_files = form.getlist('answer_files')
            subject_id = form.getvalue('subjectId', None)

            # --- 2. 프롬프트 및 요청 데이터 구성 ---
            has_answer = bool(answer_files)
            
            # **Prompt for grading (when answer is provided)**
            prompt_template_grading = f"""
            # 역할
            너는 최고의 대학 교수이자 튜터(Tutor)다. 학생이 제출한 과제물을 채점하고, 상세하고 친절한 피드백을 제공해야 한다.

            # 제공된 자료 (이후에 첨부됨)
            - 참고 자료: (첨부된 파일 및 텍스트)
            - 문제: (첨부된 이미지)
            - 학생 답안: (첨부된 이미지)

            # 수행할 작업
            1. **채점:** '참고 자료'와 너의 지식을 바탕으로 '학생 답안'을 100점 만점으로 채점하고, 각 단계별 부분 점수를 매겨줘.
            2. **총평:** 학생 답안의 잘한 점과 개선할 점을 요약해서 설명해 줘.
            3. **상세 피드백:** 오답 또는 부족한 부분을 명확히 지적하고, 왜 틀렸는지 상세히 설명해 줘.
            4. **모범 풀이:** '참고 자료'를 활용하여, 해당 문제를 가장 이상적으로 해결하는 과정을 단계별로(Step-by-step) 제시해 줘.
            5. **추가 학습 제안:** 학생이 어려워하는 부분을 보충 학습할 수 있는 키워드나 주제를 제안해 줘.

            # 출력 형식
            - 반드시 아래 키를 가진 단일 JSON 객체로만 응답해야 한다.
            - 'content' 필드에는 채점 결과, 총평, 상세 피드백, 모범 풀이, 추가 학습 제안 순서로 명확하게 구분해서 마크다운 형식으로 작성해 줘.
            - 수식은 모두 LaTeX 형식으로 작성해 줘.
            {{
                "title": "AI 채점 결과: [문제의 핵심 내용]",
                "content": "# AI 채점 결과\\n\\n## 총점\\n- .../100\\n\\n## 총평\\n- ...\\n\\n## 상세 피드백\\n- ...\\n\\n## 모범 풀이\\n- ...\\n\\n## 추가 학습 제안\\n- ...",
                "subjectId": "{subject_id}"
            }}
            """

            # **Prompt for solving (when no answer is provided)**
            prompt_template_solving = f"""
            # 역할
            너는 최고의 대학 교수이자 튜터(Tutor)다. 학생이 질문한 문제를 상세하고 이해하기 쉽게 풀어줘야 한다.

            # 제공된 자료 (이후에 첨부됨)
            - 참고 자료: (첨부된 파일 및 텍스트)
            - 문제: (첨부된 이미지)

            # 수행할 작업
            1. **문제 분석:** '문제'의 핵심 요소를 파악하고 어떤 지식이 필요한지 분석해 줘.
            2. **핵심 개념 정리:** 문제를 푸는 데 필요한 주요 이론이나 공식을 '참고 자료'를 바탕으로 먼저 정리해 줘.
            3. **모범 풀이 (가장 중요):** 문제를 해결하는 전체 과정을 단계별로(Step-by-step) 나누어 설명하고, 각 단계마다 어떤 이론이 어떻게 적용되는지 논리적 흐름을 상세히 설명해야 한다.
            
            # 📊 [추가된 규칙] 시각 자료 활용
            - **알고리즘, 시스템 구조, 프로세스 흐름 등 복잡한 관계를 설명해야 할 경우, 반드시 Mermaid.js 문법을 사용하여 다이어그램으로 시각화해줘.**
            - 예시:
              ```mermaid
              graph TD;
                  A[시작] --> B(데이터 입력);
                  B --> C{{조건 확인}};
                  C -->|참| D[처리 1];
                  C -->|거짓| E[처리 2];
              ```

            4. **결론:** 최종 답안을 명확하게 제시하고, 풀이 과정을 요약해 줘.

            # 출력 형식
            - 반드시 아래 키를 가진 단일 JSON 객체로만 응답해야 한다.
            - 'content' 필드에는 문제 분석, 핵심 개념 정리, 모범 풀이, 결론 순서로 명확하게 구분해서 마크다운 형식으로 작성해 줘.
            - 수식은 모두 LaTeX 형식으로 작성해 줘.
            {{
                "title": "AI 문제 풀이: [문제의 핵심 내용]",
                "content": "# AI 문제 풀이\\n\\n## 문제 분석\\n- ...\\n\\n## 핵심 개념 정리\\n- ...\\n\\n## 모범 풀이\\n- ...\\n\\n## 결론\\n- ...",
                "subjectId": "{subject_id}"
            }}
            """
            
            prompt_template = prompt_template_grading if has_answer else prompt_template_solving

            def process_file(file_storage):
                filename = getattr(file_storage, 'filename', 'unknown')
                print(f"INFO: Processing file '{filename}'...")
                content = getattr(file_storage, 'value', file_storage)
                if isinstance(content, bytes):
                    file_type = getattr(file_storage, 'type', 'application/octet-stream')
                    if file_type == 'application/pdf':
                        try:
                            return convert_from_bytes(content)
                        except Exception as pdf_err:
                            print(f"WARN: PDF 처리 중 오류 ('{filename}'): {pdf_err}")
                            return []
                    elif 'image' in file_type:
                        return [Image.open(io.BytesIO(content))]
                print(f"WARN: '{filename}'은(는) 처리할 수 없는 파일 형식입니다.")
                return []

            request_contents = [prompt_template]
            
            if note_context:
                request_contents.append(f"\\n--- 기존 노트 내용 ---\\n{note_context}\\n")

            if reference_files:
                request_contents.append("\\n--- 참고 자료 파일 ---\\n")
                for f in reference_files: request_contents.extend(process_file(f))

            request_contents.append("\\n--- 문제 파일 ---\\n")
            for f in problem_files: request_contents.extend(process_file(f))
            
            if has_answer:
                request_contents.append("\\n--- 학생 답안 파일 ---\\n")
                for f in answer_files: request_contents.extend(process_file(f))

            # --- 4. AI 모델 호출 (폴백 포함) ---
            for i, api_key in enumerate(valid_keys):
                try:
                    print(f"INFO: API 키 #{i + 1} (으)로 Gemini API 호출 시도...")
                    genai.configure(api_key=api_key)
                    model = genai.GenerativeModel('gemini-1.5-pro-latest')
                    response = model.generate_content(request_contents)
                    
                    cleaned_text = response.text.strip().replace('```json', '').replace('```', '')
                    json_response = json.loads(cleaned_text)

                    self.send_response(200)
                    self.send_header('Content-type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(json.dumps(json_response).encode('utf-8'))
                    return # 성공 시 함수 종료

                except Exception as e:
                    last_error = e
                    print(f"WARN: API 키 #{i + 1} 사용 실패. 다음 키로 폴백합니다. 오류: {e}")
                    continue
            
            # 모든 키가 실패한 경우
            raise ConnectionError("모든 Gemini API 키로 요청에 실패했습니다.") from last_error

        except Exception as e:
            self.handle_error(e)
