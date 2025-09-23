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
        api_keys = [
            os.environ.get('GEMINI_API_KEY_PRIMARY'),
            os.environ.get('GEMINI_API_KEY_SECONDARY'),
            os.environ.get('GEMINI_API_KEY_TERTIARY'),
            os.environ.get('GEMINI_API_KEY_QUATERNARY'),
            os.environ.get('GEMINI_API_KEY')
        ]
        valid_keys = [key for key in api_keys if key]

        if not valid_keys:
            return self.handle_error(ValueError("설정된 Gemini API 키가 없습니다."), "API 키 설정 오류", 500)

        last_error = None

        try:
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

            has_answer = bool(answer_files)
            
            prompt_template_grading = f"""
            # 역할: 최고의 대학 교수 및 튜터
            학생의 과제물을 채점하고 상세한 피드백을 제공합니다.

            # 제공 자료
            - 참고 자료, 문제, 학생 답안 (첨부됨)

            # 작업 순서
            1. **채점:** 100점 만점으로 채점하고 단계별 부분 점수를 매깁니다.
            2. **총평:** 잘한 점과 개선점을 요약합니다.
            3. **상세 피드백:** 오답과 부족한 부분을 상세히 설명합니다.
            4. **모범 풀이:** 이상적인 문제 해결 과정을 단계별로 제시합니다.
            5. **추가 학습 제안:** 관련 키워드나 주제를 제안합니다.

            # 출력 형식 (반드시 준수)
            - 단일 JSON 객체로만 응답해야 합니다.
            - `content` 필드는 마크다운 형식입니다.
            - **수식:** 모두 LaTeX 형식으로 작성합니다. (예: `$$E = mc^2$$`)
            - **코드:** 반드시 언어를 명시한 코드 블록을 사용합니다. (예: ```python\nprint("hello")\n```)
            - **핵심 용어:** `<dfn title="용어에 대한 간단한 설명">핵심 용어</dfn>` HTML 태그로 감싸서 툴팁을 제공합니다.
            
            {{
                "title": "AI 채점 결과: [문제의 핵심 내용]",
                "content": "# AI 채점 결과\\n\\n## 총점\\n- .../100\\n\\n## 총평\\n- ...\\n\\n## 상세 피드백\\n- ...\\n\\n## 모범 풀이\\n- ...\\n\\n## 추가 학습 제안\\n- ...",
                "subjectId": "{subject_id}"
            }}
            """

            prompt_template_solving = f"""
            # 역할: 최고의 대학 교수 및 튜터
            학생의 문제를 상세하고 이해하기 쉽게 풀어줍니다.

            # 제공 자료
            - 참고 자료, 문제 (첨부됨)

            # 작업 순서
            1. **문제 분석:** 문제의 핵심 요소를 파악합니다.
            2. **핵심 개념 정리:** 문제 해결에 필요한 이론과 공식을 정리합니다.
            3. **모범 풀이:** 아래 '시각 자료 및 서식 규칙'을 적극적으로 사용하여 단계별로 상세히 설명합니다.
            4. **결론:** 최종 답안을 명확하게 제시하고 풀이 과정을 요약합니다.

            # 시각 자료 및 서식 규칙 (Mermaid.js, LaTeX, 코드 강조 등)
            - **Mermaid 다이어그램:** 알고리즘, 시스템 구조, 상태 변화 등 복잡한 관계 설명 시 반드시 Mermaid.js 문법(순서도, 클래스 다이어그램 등)을 사용하여 시각화합니다. 다이어그램 코드는 ```mermaid ... ``` 코드 블록으로 감싸야 합니다.
            - **수식:** 모두 LaTeX 형식으로 작성합니다. (예: `$$E = mc^2$$`)
            - **코드:** 반드시 언어를 명시한 코드 블록을 사용합니다. (예: ```python\nprint("hello")\n```)
            - **핵심 용어:** `<dfn title="용어에 대한 간단한 설명">핵심 용어</dfn>` HTML 태그로 감싸서 툴팁을 제공합니다.

            # 출력 형식 (반드시 준수)
            - 단일 JSON 객체로만 응답합니다.
            - `content` 필드는 위의 규칙들을 모두 반영한 마크다운 형식입니다.
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
                request_contents.append(f"\n--- 기존 노트 내용 ---\n{note_context}\n")
            if reference_files:
                request_contents.append("\n--- 참고 자료 파일 ---\n")
                for f in reference_files: request_contents.extend(process_file(f))
            request_contents.append("\n--- 문제 파일 ---\n")
            for f in problem_files: request_contents.extend(process_file(f))
            if has_answer:
                request_contents.append("\n--- 학생 답안 파일 ---\n")
                for f in answer_files: request_contents.extend(process_file(f))

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
                    return
                except Exception as e:
                    last_error = e
                    print(f"WARN: API 키 #{i + 1} 사용 실패. 다음 키로 폴백합니다. 오류: {e}")
                    continue
            
            raise ConnectionError("모든 Gemini API 키로 요청에 실패했습니다.") from last_error

        except Exception as e:
            self.handle_error(e)