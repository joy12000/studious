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
    def do_POST(self):
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

            api_key = os.environ.get('GEMINI_API_KEY')
            if not api_key:
                raise ValueError("GEMINI_API_KEY environment variable not set.")

            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-1.5-pro-latest')

            prompt_text = f"""
            # 역할: 학습 전문가
            주어진 대화 내용, 학습 자료, 과목 목록을 종합하여 복습 노트와 퀴즈를 생성합니다.

            # 제공 자료
            - AI 대화 내용: {ai_conversation_text}
            - 과목 목록 (JSON): {subjects_list}
            - 학습 자료 파일 (첨부됨)

            # 출력 규칙 (★★★★★ 반드시 완벽하게 준수)
            1.  **전체 형식:** 다른 설명 없이, 아래 명시된 키를 가진 단일 JSON 객체로만 응답해야 합니다.
            2.  **`summary`, `key_insights`:** 내용은 마크다운 형식으로 작성합니다.
                -   **코드:** ` ```python ... ``` ` 처럼 언어를 명시해야 합니다.
                -   **핵심 용어:** `<dfn title="설명">용어</dfn>` 태그를 사용합니다.
            3.  **`quiz` 객체:**
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
                        {{
                            "question": "첫 번째 질문 내용",
                            "options": ["선택지 A", "선택지 B", "선택지 C", "선택지 D"],
                            "answer": "선택지 B"
                        }},
                        {{
                            "question": "두 번째 질문 내용",
                            "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
                            "answer": "Option 1"
                        }},
                        {{
                            "question": "세 번째 질문 내용",
                            "options": ["1", "2", "3", "4"],
                            "answer": "3"
                        }}
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

            response = model.generate_content(request_contents)

            cleaned_text = response.text.strip().replace('```json', '').replace('```', '')
            json_response = json.loads(cleaned_text)

            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(json_response).encode('utf-8'))

        except Exception as e:
            print(f"Error processing request: {e}")
            traceback.print_exc()
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            error_details = {
                "error": str(e),
                "traceback": traceback.format_exc()
            }
            self.wfile.write(json.dumps(error_details).encode('utf-8'))