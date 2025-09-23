from http.server import BaseHTTPRequestHandler
import json
import os
import requests
import traceback

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        api_keys = [
            os.environ.get('OPENROUTER_API_KEY_PRIMARY'),
            os.environ.get('OPENROUTER_API_KEY_SECONDARY'),
            os.environ.get('OPENROUTER_API_KEY_TERTIARY'),
            os.environ.get('OPENROUTER_API_KEY_QUATERNARY'),
            os.environ.get('OPENROUTER_API_KEY_QUINARY')
        ]
        valid_keys = [key for key in api_keys if key]

        if not valid_keys:
            return self.handle_error(ValueError("설정된 OpenRouter API 키가 없습니다."), "API 키 설정 오류", 500)

        last_error = None
        last_error_text = ""

        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            body = json.loads(post_data.decode('utf-8'))
            history = body.get('history', [])
            note_context = body.get('noteContext', '')
            model_identifier = body.get('model', 'google/gemini-1.5-flash')

            if not history:
                raise ValueError("대화 내용이 비어있습니다.")

            system_prompt_text = """
            당신은 학습을 돕는 유능한 AI 어시스턴트입니다. 
            # 답변 규칙
            1.  **명확성:** 사용자의 요청에 명확하고 구조적으로 답변해주세요.
            2.  **서식 활용:**
                -   **수식:** KaTeX 문법을 사용해주세요 (인라인: $, 블록: $$).
                -   **코드:** 언어를 명시한 코드 블록(```python)을 사용해주세요.
                -   **다이어그램:** 복잡한 개념 설명 시 Mermaid.js 문법을 사용해주세요.
                -   **핵심 용어:** `<dfn title="설명">용어</dfn>` 태그로 툴팁을 제공해주세요.
            3.  **후속 질문:** 답변이 끝난 후, 더 깊이 탐색해볼 만한 흥미로운 후속 질문 3개를 제안해주세요.
            4.  **출력 형식:** 최종 결과는 반드시 {"answer": "...", "followUp": ["...", "...", "..."]} 형식의 JSON 객체로만 응답해야 합니다. 다른 말은 절대 추가하지 마세요.
            """

            if note_context:
                system_prompt_text += f"""
                ---
                # 참고 자료
                아래는 사용자가 현재 보고 있는 노트의 내용입니다. 이 내용을 바탕으로 답변해주세요.

                {note_context}
                ---
                """
            
            system_prompt = { "role": "system", "content": system_prompt_text}
            messages = [{"role": "user" if msg['role'] == 'user' else "assistant", "content": msg['parts'][0]['text']} for msg in history]

            for i, api_key in enumerate(valid_keys):
                try:
                    print(f"INFO: 모델 '{model_identifier}' / API 키 #{i + 1} (으)로 호출 시도...")
                    payload = {
                        "model": model_identifier,
                        "messages": [system_prompt] + messages,
                    }
                    if model_identifier.startswith('google/'):
                        payload["response_format"] = {"type": "json_object"}

                    response = requests.post(
                        url="https://openrouter.ai/api/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json",
                            "HTTP-Referer": "https://studious.app",
                            "X-Title": "Studious"
                        },
                        json=payload,
                        timeout=180
                    )
                    response.raise_for_status()
                    
                    api_response_data = response.json()
                    content_str = api_response_data['choices'][0]['message']['content']
                    
                    try:
                        parsed_content = json.loads(content_str)
                    except json.JSONDecodeError:
                        print("WARN: AI 응답이 유효한 JSON이 아니므로 래핑합니다.")
                        parsed_content = {"answer": content_str, "followUp": []}

                    final_json_output = json.dumps(parsed_content, ensure_ascii=False)

                    self.send_response(200)
                    self.send_header('Content-type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(final_json_output.encode('utf-8'))
                    return

                except requests.exceptions.RequestException as e:
                    last_error = e
                    if e.response is not None:
                        last_error_text = e.response.text
                    print(f"WARN: API 키 #{i + 1} 사용 실패. 다음 키로 폴백합니다. 오류: {e}")
                    continue

            raise ConnectionError(f"모든 OpenRouter API 키로 요청에 실패했습니다. 마지막 오류: {last_error_text}") from last_error

        except Exception as e:
            self.handle_error(e, "API 요청 처리 중 오류 발생")

    def handle_error(self, e, message="오류 발생", status_code=500):
        print(f"ERROR: {message}: {e}")
        traceback.print_exc()
        if not hasattr(self, '_headers_sent') or not self._headers_sent:
            try:
                self.send_response(status_code)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                error_details = {"error": message, "details": str(e)}
                self.wfile.write(json.dumps(error_details).encode('utf-8'))
            except Exception as write_error:
                print(f"FATAL: 오류 응답을 보내는 중 추가 오류 발생: {write_error}")