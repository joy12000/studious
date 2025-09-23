from http.server import BaseHTTPRequestHandler
import json
import os
import google.generativeai as genai
import requests
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
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data)

            note_context = data.get('note_context', '')
            reference_file_urls = data.get('reference_file_urls', [])
            problem_file_urls = data.get('problem_file_urls', [])
            answer_file_urls = data.get('answer_file_urls', [])
            subject_id = data.get('subjectId')

            has_answer = bool(answer_file_urls)
            
            shared_formatting_rules = """
            # 🎨 출력 서식 규칙 (★★★★★ 가장 중요)
            당신이 생성하는 모든 텍스트는 아래 규칙을 **반드시** 따라야 합니다.
            
            1.  **수학 수식 (LaTeX):** 모든 수학 기호, 변수, 방정식은 **반드시** KaTeX 문법으로 감싸야 합니다. (인라인: `$`, 블록: `$$`)
            2.  **다이어그램 (Mermaid):** 복잡한 시스템, 알고리즘, 상태 변화는 **반드시** Mermaid.js 문법으로 시각화해야 합니다. (```mermaid...```)
            3.  **코드 (Code Block):** 모든 소스 코드는 **반드시** 언어를 명시한 코드 블록으로 작성해야 합니다. (```python...```)
            4.  **핵심 용어 (Tooltip):** 중요한 전공 용어는 **반드시** `<dfn title="설명">용어</dfn>` HTML 태그로 감싸 설명을 제공해야 합니다.
            """

            prompt_template_grading = f"""
            # 역할: 최고의 대학 교수 및 튜터
            학생의 과제물을 채점하고 상세한 피드백을 제공합니다.
            {shared_formatting_rules}

            # 작업 순서
            1. **채점:** 100점 만점으로 채점하고 단계별 부분 점수를 매깁니다.
            2. **총평:** 잘한 점과 개선점을 요약합니다.
            3. **상세 피드백:** 오답과 부족한 부분을 상세히 설명합니다.
            4. **모범 풀이:** 이상적인 문제 해결 과정을 단계별로 제시합니다.
            5. **추가 학습 제안:** 관련 키워드나 주제를 제안합니다.

            # JSON 출력 형식 (반드시 준수)
            - 단일 JSON 객체로만 응답합니다.
            {{
                "title": "AI 채점 결과: [문제의 핵심 내용]",
                "content": "# AI 채점 결과\n\n## 총점\n- .../100\n\n## 총평\n- ...\n\n## 상세 피드백\n- ...\n\n## 모범 풀이\n- ...\n\n## 추가 학습 제안\n- ...",
                "subjectId": "{subject_id}"
            }}
            """

            prompt_template_solving = f"""
            # 역할: 최고의 대학 교수 및 튜터
            학생의 문제를 상세하고 이해하기 쉽게 풀어줍니다.
            {shared_formatting_rules}

            # 작업 순서
            1. **문제 분석:** 문제의 핵심 요소를 파악합니다.
            2. **핵심 개념 정리:** 문제 해결에 필요한 이론과 공식을 정리합니다.
            3. **모범 풀이:** 위의 '출력 서식 규칙'을 적극적으로 사용하여 단계별로 상세히 설명합니다.
            4. **결론:** 최종 답안을 명확하게 제시하고 풀이 과정을 요약합니다.

            # JSON 출력 형식 (반드시 준수)
            - 단일 JSON 객체로만 응답합니다.
            {{
                "title": "AI 문제 풀이: [문제의 핵심 내용]",
                "content": "# AI 문제 풀이\n\n## 문제 분석\n- ...\n\n## 핵심 개념 정리\n- ...\n\n## 모범 풀이\n- ...\n\n## 결론\n- ...",
                "subjectId": "{subject_id}"
            }}
            """
            
            prompt_template = prompt_template_grading if has_answer else prompt_template_solving

            def process_url(url):
                try:
                    response = requests.get(url, stream=True)
                    response.raise_for_status() 
                    content_type = response.headers.get('content-type', '')
                    file_content = response.content

                    if 'application/pdf' in content_type:
                        return convert_from_bytes(file_content)
                    elif 'image' in content_type:
                        return [Image.open(io.BytesIO(file_content))]
                    else:
                        # Try to decode as text as a fallback
                        return [file_content.decode('utf-8')]
                except Exception as e:
                    print(f"Error processing URL {url}: {e}")
                    return []

            request_contents = [prompt_template]
            
            if note_context:
                request_contents.append(f"\n--- 기존 노트 내용 ---\n{note_context}\n")
            if reference_file_urls:
                request_contents.append("\n--- 참고 자료 파일 ---\n")
                for url in reference_file_urls: request_contents.extend(process_url(url))
            request_contents.append("\n--- 문제 파일 ---\n")
            for url in problem_file_urls: request_contents.extend(process_url(url))
            if has_answer:
                request_contents.append("\n--- 학생 답안 파일 ---\n")
                for url in answer_file_urls: request_contents.extend(process_url(url))

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
