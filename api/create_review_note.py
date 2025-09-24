from http.server import BaseHTTPRequestHandler
import json
import os
import google.generativeai as genai
import requests
import io
from PIL import Image
import traceback
import shutil
import re # re 모듈 추가

# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

def extract_first_json(text: str):
    """Finds and decodes the first valid JSON object or array block in a string."""
    if not text:
        raise ValueError("Empty response from model.")

    # First, try to find a JSON object or array within a markdown code block
    match = re.search(r"```json\s*([{\[].*?[}\]])\s*```", text, re.DOTALL)
    if match:
        json_str = match.group(1)
    else:
        # If not found, try to find the first JSON object or array
        match_obj = re.search(r"{[\s\S]*?}", text, re.DOTALL)
        match_arr = re.search(r"[\s\S]*?", text, re.DOTALL)

        if match_obj and (not match_arr or match_obj.start() < match_arr.start()):
            json_str = match_obj.group(0)
        elif match_arr:
            json_str = match_arr.group(0)
        else:
            raise ValueError("No JSON object or array found in the model's response.")

    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to decode JSON: {e} - Response text was: '{text}'")

class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        api_keys = [
            os.environ.get('GEMINI_API_KEY_PRIMARY'),
            os.environ.get('GEMINI_API_KEY_SECONDARY'),
            os.environ.get('GEMINI_API_KEY_TERTIARY'),
            os.environ.get('GEMINI_API_KEY_QUATERNARY')
        ]
        valid_keys = [key for key in api_keys if key]

        if not valid_keys:
            return self.handle_error(ValueError("설정된 Gemini API 키가 없습니다."), "API 키 설정 오류", 500)

        last_error = None
        blob_urls_to_delete = [] # To store URLs for cleanup

        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data)

            blob_urls = data.get('blobUrls', [])
            if 'blobUrls' not in data or not isinstance(data['blobUrls'], list):
                return self.handle_error(ValueError("유효하지 않은 blobUrls 입니다."), status_code=400)

            blob_urls_to_delete.extend(blob_urls) # Add to cleanup list

            subject_name = data.get('subject', '[과목명]')
            week_info = data.get('week', '[N주차/18주차]')
            material_types = data.get('materialTypes', '[PPT/PDF/텍스트 등]')

            prompt = f"""
              당신은 인지과학과 교육심리학 전문가입니다. 첨부된 강의 자료를 분석하여, 학생이 스스로 깊이 있게 학습할 수 있는 최고의 복습 노트를 제작해야 합니다.

              # 📖 노트 정보
              - 과목: {subject_name}
              - 주차: {week_info}
              - 자료 형태: {material_types}

              # 🎨 출력 서식 규칙 (★★★★★ 가장 중요)
              당신이 생성하는 모든 텍스트는 아래 규칙을 반드시 따라야 합니다.

              1.  **수학 수식 (LaTeX):** 모든 수학 기호, 변수, 방정식은 반드시 KaTeX 문법으로 감싸야 합니다. 
                  -   인라인 수식: $로 감쌉니다. 예: $q''_x = -k \frac{{dT}}{{dx}}$
                  -   블록 수식: $$로 감쌉니다. 예: $$T(x) = T_s + \frac{{q'''}}{{2k}}(Lx - x^2)$$

              2.  **다이어그램 (Mermaid):** 복잡한 시스템, 알고리즘, 상태 변화는 반드시 Mermaid.js 문법으로 시각화해야 합니다.
                  -   예시: ```mermaid\ngraph TD; A[열원] --> B(표면);\n```

              3.  **코드 (Code Block):** 모든 소스 코드는 반드시 언어를 명시한 코드 블록으로 작성해야 합니다.
                  -   예시: ```python\nprint("Hello")\n```

              4.  **핵심 용어 (Tooltip):** 중요한 전공 용어는 반드시 <dfn title="용어에 대한 간단한 설명">핵심 용어</dfn> HTML 태그로 감싸 설명을 제공해야 합니다.
                  -   예시: <dfn title="매질 없이 열이 직접 전달되는 현상">복사</dfn>

              # 📚 결과물 구조 (코넬 노트 + SQ3R 변형)
              1.  **Cues (단서 영역):** 학습 내용을 대표하는 핵심 질문, 키워드, 용어를 5~7개 제시하세요.
              2.  **Notes (노트 영역):** 
                  -   Cues 영역의 각 항목에 대해 상세하고 깊이 있는 설명을 제공합니다.
                  -   반드시 위에서 설명한 '출력 서식 규칙'을 준수하여(수식, 다이어그램, 코드, 툴팁) 내용을 풍부하게 만드세요.
                  -   단순 요약을 넘어, 개념 간의 연결, 실제 적용 사례, 잠재적인 질문을 포함하여 "살아있는 지식"을 전달해야 합니다.
              3.  **Summary (요약 영역):** 
                  -   강의 자료 전체의 핵심 내용을 3~5문장으로 압축하여 요약합니다.
                  -   이 요약은 학생이 30초 안에 해당 강의의 정수를 파악할 수 있도록 도와야 합니다.

              # ✅ 최종 품질 체크리스트
              -   Cues, Notes, Summary 구조가 명확하게 구분되었는가?
              -   Notes 영역이 '출력 서식 규칙'을 완벽하게 준수하여 작성되었는가?
              -   단순 정보 나열이 아닌, 깊이 있는 학습을 유도하는 내용인가?

              결과물은 다른 설명 없이, 다음 JSON 형식으로만 생성해야 합니다.
              ```json
              {{
                "title": "생성된 노트의 제목",
                "content": "위 규칙들을 모두 준수한 복습 노트 본문(마크다운)",
                "key_insights": ["핵심 인사이트 1", "핵심 인사이트 2"],
                "quiz": {{
                  "questions": [
                    {{
                      "question": "질문 1",
                      "options": ["옵션 1", "옵션 2", "옵션 3", "옵션 4"],
                      "answer": "정답 옵션"
                    }}
                  ]
                }},
                "subjectName": "추론된 과목명 (예: 인지과학 개론)"
              }}
              ```
              """

            request_contents = [prompt]
            text_materials = []

            for url in blob_urls:
                try:
                    response = requests.get(url, stream=True)
                    response.raise_for_status()
                    file_content = response.content
                    content_type = response.headers.get('content-type', 'application/octet-stream')

                    if 'image/' in content_type:
                        request_contents.append(Image.open(io.BytesIO(file_content)))
                    else:
                        text_materials.append(file_content.decode('utf-8', errors='ignore'))
                except Exception as e:
                    print(f"WARN: Blob URL에서 파일 다운로드 또는 처리 실패 ('{url}'): {e}")

            if text_materials:
                request_contents.append("\n--- 학습 자료 (텍스트) ---" + "\n\n".join(text_materials))

            for i, api_key in enumerate(valid_keys):
                try:
                    print(f"INFO: API 키 #{i + 1} (으)로 참고서 생성 시도...")
                    genai.configure(api_key=api_key)
                    model = genai.GenerativeModel('gemini-2.5-flash')

                    response = model.generate_content(request_contents)

                    # The model is expected to return a JSON string.
                    # We need to parse it to extract the data.
                    generated_data = extract_first_json(response.text)

                    json_response = {
                        "title": generated_data.get("title", f"{subject_name} - {week_info} 복습노트"),
                        "content": generated_data.get("content", ""), # Changed from summary to content
                        "key_insights": generated_data.get("key_insights", []),
                        "quiz": generated_data.get("quiz", {}),
                        "subjectId": data.get("subjectId"), # This will still be null
                        "subjectName": generated_data.get("subjectName", subject_name) # Add subjectName from Gemini
                    }

                    self.send_response(200)
                    self.send_header('Content-type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(json.dumps(json_response, ensure_ascii=False).encode('utf-8'))
                    return

                except Exception as e:
                    last_error = e
                    print(f"WARN: API 키 #{i + 1} 사용 실패. 다음 키로 폴백합니다. 오류: {e}")
                    continue

            raise ConnectionError("모든 Gemini API 키로 요청에 실패했습니다.") from last_error

        except Exception as e:
            self.handle_error(e, "참고서 생성 중 오류 발생")
        finally:
            # Clean up Vercel Blobs
            blob_read_write_token = os.environ.get('BLOB_READ_WRITE_TOKEN')
            if blob_read_write_token:
                for url in blob_urls_to_delete:
                    try:
                        delete_response = requests.delete(url, headers={'Authorization': f'Bearer {blob_read_write_token}'})
                        delete_response.raise_for_status()
                        print(f"INFO: Blob 삭제 완료: {url}")
                    except Exception as delete_error:
                        print(f"ERROR: Blob 삭제 실패 ('{url}'): {delete_error}")
            else:
                print("WARN: BLOB_READ_WRITE_TOKEN이 설정되지 않아 Blob을 삭제할 수 없습니다.")

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
