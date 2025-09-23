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

            ai_conversation_text = form.getvalue('aiConversationText', '')
            learning_material_files = form.getlist('files')
            subjects_list_str = form.getvalue('subjects', '[]')
            subjects_list = json.loads(subjects_list_str)

            prompt_text = f"""
            # 역할: 학습 전문가
            주어진 대화 내용, 학습 자료, 과목 목록을 종합하여 복습 노트와 퀴즈를 생성합니다.

            # 🎨 출력 서식 규칙 (★★★★★ 가장 중요)
            `summary`, `key_insights` 필드의 내용은 아래 규칙을 **반드시** 따라야 합니다.
            
            1.  **수학 수식 (LaTeX):** 모든 수학 기호, 변수, 방정식은 KaTeX 문법으로 감싸야 합니다. (인라인: `$`, 블록: `$$`)
            2.  **다이어그램 (Mermaid):** 복잡한 개념 설명 시 Mermaid.js 문법으로 시각화해야 합니다. (```mermaid...```)
            3.  **코드 (Code Block):** 모든 소스 코드는 언어를 명시한 코드 블록으로 작성해야 합니다. (```python...```)
            4.  **핵심 용어 (Tooltip):** 중요한 전공 용어는 `<dfn title="설명">용어</dfn>` HTML 태그로 감싸 설명을 제공해야 합니다.

            # 📝 JSON 출력 규칙 (★★★★★ 반드시 준수)
            1.  **전체 형식:** 다른 설명 없이, 아래 명시된 키를 가진 단일 JSON 객체로만 응답해야 합니다.
            2.  **`quiz` 객체:**
                -   `questions` 배열은 3개의 객관식 질문 객체를 포함해야 합니다.
                -   각 질문 객체는 `question`(string), `options`(string 배열), `answer`(string) 키를 가져야 합니다.
                -   **매우 중요:** `answer` 값은 반드시 `options` 배열에 포함된 문자열 중 하나와 정확히 일치해야 합니다.

            # 최종 JSON 출력 형식
            {{
                "title": "[핵심 주제] 복습 노트",
                "summary": "AI가 생성한 마크다운 형식의 상세 요약...",
                "key_insights": ["핵심 개념 또는 통찰 1", "핵심 개념 또는 통찰 2"],
                "quiz": {{
                    "questions": [
                        {{"question": "첫 번째 질문 내용", "options": ["A", "B", "C", "D"], "answer": "B"}},
                        {{"question": "두 번째 질문 내용", "options": ["1", "2", "3", "4"], "answer": "1"}},
                        {{"question": "세 번째 질문 내용", "options": ["참", "거짓"], "answer": "참"}}
                    ]
                }},
                "subjectId": "주어진 과목 목록에서 가장 관련 있는 과목의 id"
            }}
            """
            
            request_contents = [prompt_text]
            
            for learning_material_file in learning_material_files:
                file_content = getattr(learning_material_file, 'value', learning_material_file)
                file_type = getattr(learning_material_file, 'type', 'application/octet-stream')
                filename = getattr(learning_material_file, 'filename', 'unknown')

                if not isinstance(file_content, bytes):
                    continue

                if file_type == 'application/pdf':
                    try:
                        images = convert_from_bytes(file_content)
                        if images:
                            request_contents.extend(images)
                    except Exception as e:
                        if "Poppler" in str(e):
                            raise ValueError("PDF 처리를 위해 Poppler를 설치해야 합니다.")
                        else:
                            raise e
                elif 'image' in file_type:
                    try:
                        img = Image.open(io.BytesIO(file_content))
                        request_contents.append(img)
                    except Exception as img_err:
                         print(f"이미지 파일 '{filename}' 처리 중 오류: {img_err}")
                else:
                    try:
                        text_content = file_content.decode('utf-8', errors='ignore')
                        request_contents.append(f"\n--- 텍스트 파일 '{filename}' 내용 ---\n{text_content}")
                    except Exception as txt_err:
                        print(f"텍스트 파일 '{filename}' 처리 중 오류: {txt_err}")

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
            self.handle_error(e, "복습 노트 생성 중 오류 발생")
