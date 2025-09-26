from http.server import BaseHTTPRequestHandler
import json
import os
import requests
import traceback
import google.generativeai as genai

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # API 키 목록을 환경 변수에서 가져옵니다.
        api_keys = [
            os.environ.get('OPENROUTER_API_KEY_PRIMARY'),
            os.environ.get('OPENROUTER_API_KEY_SECONDARY'),
            os.environ.get('OPENROUTER_API_KEY_TERTIARY'),
            os.environ.get('OPENROUTER_API_KEY_QUATERNARY'),
            os.environ.get('OPENROUTER_API_KEY_QUINARY'),
            os.environ.get('GEMINI_API_KEY_PRIMARY'),
            os.environ.get('GEMINI_API_KEY_SECONDARY'),
            os.environ.get('GEMINI_API_KEY_TERTIARY'),
            os.environ.get('GEMINI_API_KEY_QUATERNARY')
        ]
        valid_keys = [key for key in api_keys if key]

        if not valid_keys:
            return self.handle_error(ValueError("설정된 API 키가 없습니다."), "API 키 설정 오류", 500)

        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            body = json.loads(post_data.decode('utf-8'))
            
            history = body.get('history', [])
            note_context = body.get('noteContext', '')
            model_identifier = body.get('model', 'gemini-2.5-flash-lite') # 기본 모델 변경
            use_gemini_direct = body.get('useGeminiDirect', False)

            if not history:
                raise ValueError("대화 내용이 비어있습니다.")

            # --- [프롬프트 강화] ---
            system_prompt_text = self.get_system_prompt(note_context)
            
            messages = self.prepare_messages(history)

            # API 공급자 선택 및 실행
            if use_gemini_direct:
                self.execute_gemini_direct(model_identifier, messages, system_prompt_text, valid_keys)
            else:
                self.execute_openrouter(model_identifier, messages, system_prompt_text, valid_keys)

        except Exception as e:
            self.handle_error(e, "API 요청 처리 중 오류 발생")

    def get_system_prompt(self, note_context):
        prompt = r"""
        당신은 학생의 학습을 돕는 유능한 AI 튜터입니다. 당신의 답변은 반드시 아래 규칙을 따라야 합니다.

        # 🎨 출력 서식 규칙 (★★★★★ 가장 중요)
        당신이 생성하는 모든 텍스트는 아래 규칙을 **반드시** 따라야 합니다.
        1.  **수학 수식 (LaTeX):** 모든 수학 기호, 변수, 방정식은 **반드시** KaTeX 문법으로 감싸야 합니다. (인라인: `$`, 블록: `$$`)
        2.  **코드 (Code Block):** 모든 소스 코드는 **반드시** 언어를 명시한 코드 블록으로 작성해야 합니다. (예: ```python\nprint("Hello")\n```)
        3.  **핵심 용어 (Tooltip):** 중요한 전공 용어는 **반드시** `<dfn>` 태그로 감싸 설명을 제공해야 합니다. (예: `<dfn title="설명">용어</dfn>`)

        # 🖼️ 시각 자료 규칙
        모든 시각 자료(Mermaid, visual JSON)는 반드시 지정된 언어의 코드 블록 안에 포함해야 합니다.
        - **Mermaid:** 순서도, 타임라인 등. 노드 이름이나 링크에 특수문자/공백이 있으면 큰따옴표(`"`)로 감싸세요.
        - **visual JSON:** 복잡한 개념 시각화. `props`에 `content` 사용, 자식은 `children` 배열, 스타일은 인라인 `style` 객체를 사용하세요.

        # 💬 대화 규칙
        1.  **명확성:** 학생의 질문에 명확하고 구조적으로 답변합니다.
        2.  **후속 질문:** 답변 마지막에 학생의 사고를 확장할 수 있는 좋은 후속 질문 3개를 제안합니다.
        3.  **출력 형식:** 당신의 최종 답변은 반드시 다음 형식을 엄격하게 따라야 합니다.
            - 1단계: 사용자의 질문에 대한 답변 전체를 마크다운 형식으로 먼저 출력합니다.
            - 2단계: 답변 출력이 완전히 끝나면, 그 즉시 줄바꿈 없이 특수 구분자인 `|||END_OF_ANSWER|||`를 출력합니다.
            - 3단계: 구분자 바로 뒤에, 줄바꿈 없이 후속 질문 3개가 들어있는 순수 JSON 배열을 출력합니다.
            - 예시: [답변 마크다운]|||END_OF_ANSWER|||["첫 번째 후속 질문", "두 번째 후속 질문", "세 번째 후속 질문"]
        """
        if note_context:
            prompt += f"\n---\n# 참고 자료\n아래는 사용자가 현재 보고 있는 노트의 내용입니다. 이 내용을 바탕으로 답변해주세요.\n\n{note_context}\n---"
        return prompt

    def prepare_messages(self, history):
        messages = []
        for msg in history:
            role = 'user' if msg['role'] == 'user' else 'assistant'
            # 이전 대화에서 봇의 답변에 포함된 후속 질문은 제외하고 순수 텍스트만 사용
            content = msg.get('text', msg.get('parts', [{}])[0].get('text', ''))
            messages.append({"role": role, "content": content})
        return messages

    def execute_gemini_direct(self, model_identifier, messages, system_prompt_text, valid_keys):
        gemini_api_keys = [key for key in valid_keys if key and key.startswith('AIza')]
        if not gemini_api_keys:
            raise ValueError("설정된 Gemini API 키가 없습니다.")

        last_error = None
        for i, api_key in enumerate(gemini_api_keys):
            try:
                print(f"INFO: Gemini Direct 모델 '{model_identifier}' / API 키 #{i + 1} 호출 시도...")
                genai.configure(api_key=api_key)
                
                # 모델 이름에서 'google/' 접두사 제거
                clean_model_id = model_identifier.replace('google/', '')
                model = genai.GenerativeModel(clean_model_id)

                # Gemini API는 별도의 시스템 프롬프트를 지원하지 않으므로 메시지 목록에 추가합니다.
                gemini_messages = [
                    {'role': 'user', 'parts': [system_prompt_text]},
                    {'role': 'model', 'parts': ['네, 알겠습니다. 규칙을 모두 확인했으며, 반드시 JSON 형식으로만 답변하겠습니다.']}
                ] + self.convert_to_gemini_format(messages)

                response = model.generate_content(gemini_messages, stream=True,
                                                  generation_config=genai.types.GenerationConfig(response_mime_type="application/json"))
                
                self.stream_json_response(response)
                return
            except Exception as e:
                last_error = e
                print(f"WARN: Gemini Direct API 키 #{i + 1} 사용 실패. 다음 키로 폴백합니다. 오류: {e}")
        raise ConnectionError(f"모든 Gemini API 키로 요청에 실패했습니다.") from last_error

    def convert_to_gemini_format(self, messages):
        gemini_history = []
        for msg in messages:
            role = 'model' if msg['role'] == 'assistant' else 'user'
            gemini_history.append({'role': role, 'parts': [{'text': msg['content']}]})
        return gemini_history

    def execute_openrouter(self, model_identifier, messages, system_prompt_text, valid_keys):
        openrouter_api_keys = [key for key in valid_keys if not (key and key.startswith('AIza'))]
        if not openrouter_api_keys:
            raise ValueError("설정된 OpenRouter API 키가 없습니다.")

        last_error = None
        for i, api_key in enumerate(openrouter_api_keys):
            try:
                print(f"INFO: OpenRouter 모델 '{model_identifier}' / API 키 #{i + 1} 호출 시도...")
                payload = {
                    "model": model_identifier,
                    "messages": [{"role": "system", "content": system_prompt_text}] + messages,
                    "stream": True,
                    "response_format": {"type": "json_object"}
                }

                response = requests.post(
                    url="https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://studious.app",
                        "X-Title": "Studious"
                    },
                    json=payload,
                    stream=True
                )
                response.raise_for_status()
                
                self.stream_openrouter_response(response)
                return
            except requests.exceptions.RequestException as e:
                last_error = e
                print(f"WARN: API 키 #{i + 1} 사용 실패. 다음 키로 폴백합니다. 오류: {e}")
        raise ConnectionError(f"모든 OpenRouter API 키로 요청에 실패했습니다.") from last_error

    def stream_json_response(self, response_iterator):
        self.send_response(200)
        self.send_header('Content-type', 'text/event-stream; charset=utf-8')
        self.end_headers()
        
        separator = "|||END_OF_ANSWER|||"
        buffer = ""
        separator_found = False

        try:
            for chunk in response_iterator:
                if not chunk.text:
                    continue
                
                buffer += chunk.text

                if separator_found:
                    continue

                while separator in buffer:
                    answer_part, rest = buffer.split(separator, 1)
                    
                    if answer_part:
                        token_json = json.dumps({"token": answer_part})
                        self.wfile.write(f"data: {token_json}\n\n".encode('utf-8'))
                        self.wfile.flush()
                    
                    separator_found = True
                    buffer = rest
                    break
            
            if not separator_found and buffer:
                token_json = json.dumps({"token": buffer})
                self.wfile.write(f"data: {token_json}\n\n".encode('utf-8'))
                self.wfile.flush()

        except Exception as e:
            print(f"ERROR: Gemini 스트리밍 중 오류 발생: {e}")
            error_json = json.dumps({"error": "스트리밍 중 오류 발생", "details": str(e)})
            self.wfile.write(f"data: {error_json}\n\n".encode('utf-8'))
            self.wfile.flush()

        if separator_found and buffer:
            try:
                follow_up_data = json.loads(buffer)
                final_payload = json.dumps({"followUp": follow_up_data})
                self.wfile.write(f"data: {final_payload}\n\n".encode('utf-8'))
                self.wfile.flush()
            except json.JSONDecodeError:
                print(f"ERROR: Gemini 후속 질문 JSON 파싱 실패: {buffer}")

        self.wfile.write('data: [DONE]\n\n'.encode('utf-8'))
        self.wfile.flush()

    def stream_openrouter_response(self, response):
        self.send_response(200)
        self.send_header('Content-type', 'text/event-stream; charset=utf-8')
        self.end_headers()

        separator = "|||END_OF_ANSWER|||"
        buffer = ""
        separator_found = False

        try:
            for line in response.iter_lines():
                if not line:
                    continue
                
                decoded_line = line.decode('utf-8')
                if not decoded_line.startswith('data: '):
                    continue

                json_str = decoded_line[len('data: '):].strip()
                if json_str == '[DONE]':
                    break
                if not json_str:
                    continue
                
                try:
                    data = json.loads(json_str)
                    content = data.get('choices', [{}])[0].get('delta', {}).get('content')
                    if not content:
                        continue

                    buffer += content

                    if separator_found:
                        continue

                    while separator in buffer:
                        answer_part, rest = buffer.split(separator, 1)
                        if answer_part:
                            token_json = json.dumps({"token": answer_part})
                            self.wfile.write(f"data: {token_json}\n\n".encode('utf-8'))
                            self.wfile.flush()
                        
                        separator_found = True
                        buffer = rest
                        break
                
                except json.JSONDecodeError:
                    continue # Ignore parsing errors for individual delta chunks

            if not separator_found and buffer:
                token_json = json.dumps({"token": buffer})
                self.wfile.write(f"data: {token_json}\n\n".encode('utf-8'))
                self.wfile.flush()

        except Exception as e:
            print(f"ERROR: OpenRouter 스트리밍 중 오류 발생: {e}")
            error_json = json.dumps({"error": "스트리밍 중 오류 발생", "details": str(e)})
            self.wfile.write(f"data: {error_json}\n\n".encode('utf-8'))
            self.wfile.flush()

        if separator_found and buffer:
            try:
                follow_up_data = json.loads(buffer)
                final_payload = json.dumps({"followUp": follow_up_data})
                self.wfile.write(f"data: {final_payload}\n\n".encode('utf-8'))
                self.wfile.flush()
            except json.JSONDecodeError:
                print(f"ERROR: OpenRouter 후속 질문 JSON 파싱 실패: {buffer}")

        self.wfile.write('data: [DONE]\n\n'.encode('utf-8'))
        self.wfile.flush()

    def handle_error(self, e, message="오류 발생", status_code=500):
        print(f"ERROR: {message}: {e}")
        traceback.print_exc()
        if not getattr(self, '_headers_sent', False):
            self.send_response(status_code)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
        error_details = {"error": message, "details": str(e)}
        self.wfile.write(json.dumps(error_details).encode('utf-8'))
