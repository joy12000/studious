from http.server import BaseHTTPRequestHandler
import json
import os
import requests
import traceback

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        api_keys = [
            os.environ.get('OPENROUTER_API_KEY_PRIMARY'),
            os.environ.get('OPENROUTER_API_KEY_SECONDARY')
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
            note_context = body.get('noteContext', '') # Get the note context
            
            # ✨ 수정: 프론트엔드에서 보낸 모델 이름을 사용하고, 없으면 기본 모델 사용
            model_identifier = body.get('model', 'google/gemini-1.5-flash')

            if not history:
                raise ValueError("대화 내용이 비어있습니다.")

            # New system prompt construction
            system_prompt_text = """
            당신은 학습을 돕는 유능한 AI 어시스턴트입니다. 
            1. 사용자의 요청에 명확하고 구조적으로 답변해주세요.
            2. 수학 수식이나 과학 기호는 KaTeX 문법을 사용해주세요 (인라인: $, 블록: $).
            3. 답변이 끝난 후, 사용자가 더 깊이 탐색해볼 만한 흥미로운 후속 질문 3개를 한국어로 제안해주세요.
            4. 최종 결과는 반드시 {"answer": "...", "followUp": ["...", "...", "..."]} 형식의 JSON 객체로만 응답해야 합니다. 다른 말은 절대 추가하지 마세요.
            """

            if note_context:
                system_prompt_text += f"""

                ---
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
                    # Google 모델에 대해서만 JSON 모드를 활성화합니다.
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
                    
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json; charset=utf-8')
                    self.end_headers()
                    self.wfile.write(content_str.encode('utf-8'))
                    return

                except requests.exceptions.RequestException as e:
                    last_error = e
                    # ✨ 개선: 오류 발생 시 OpenRouter가 보낸 상세 메시지 기록
                    if e.response is not None:
                        last_error_text = e.response.text
                    print(f"WARN: API 키 #{i + 1} 사용 실패. 다음 키로 폴백합니다. 오류: {e}")
                    continue

            # 모든 키가 실패했을 때의 오류 메시지에 상세 내용을 포함
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