from http.server import BaseHTTPRequestHandler
import json
import os
import requests
import traceback
import google.generativeai as genai # Reintroduce Gemini API
import google.ai.generativelanguage as glm # For multimodal parts
import io # For image handling
from PIL import Image # For image handling

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        api_keys = [
            os.environ.get('OPENROUTER_API_KEY_PRIMARY'),
            os.environ.get('OPENROUTER_API_KEY_SECONDARY'),
            os.environ.get('OPENROUTER_API_KEY_TERTIARY'),
            os.environ.get('OPENROUTER_API_KEY_QUATERNARY'),
            os.environ.get('OPENROUTER_API_KEY_QUINARY'),
            os.environ.get('GEMINI_API_KEY_PRIMARY'), # Add Gemini API keys
            os.environ.get('GEMINI_API_KEY_SECONDARY'),
            os.environ.get('GEMINI_API_KEY_TERTIARY'),
            os.environ.get('GEMINI_API_KEY_QUATERNARY')
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
            model_identifier = body.get('model', 'google/gemini-2.5-flash')
            use_gemini_direct = body.get('useGeminiDirect', False) # New flag

            if not history:
                raise ValueError("대화 내용이 비어있습니다.")

            # --- [프롬프트 강화] ---
            system_prompt_text = r"""
            당신은 학생의 학습을 돕는 유능한 AI 튜터입니다. 당신의 답변은 반드시 아래 규칙을 따라야 합니다.

            # 🎨 출력 서식 규칙 (★★★★★ 가장 중요)
            당신이 생성하는 모든 텍스트는 아래 규칙을 **반드시** 따라야 합니다.
            
            1.  **수학 수식 (LaTeX):** 모든 수학 기호, 변수, 방정식은 **반드시** KaTeX 문법으로 감싸야 합니다.
                -   인라인 수식: `$`로 감쌉니다. 예: `$\frac{dT}{dx} = f(x, T)$`
                -   블록 수식: `$$`로 감쌉니다. 예: `$$\mu = e^{\int P(x)dx}$$`
            
            2.  **코드 (Code Block):** 모든 소스 코드는 **반드시** 언어를 명시한 코드 블록으로 작성해야 합니다.
                -   예시: ```python\nprint("Hello")\n```
            
            3.  **핵심 용어 (Tooltip):** 중요한 전공 용어는 **반드시** `<dfn>` 태그로 감싸 설명을 제공해야 합니다.
                -   예시: `<dfn title="상미분 방정식(Ordinary Differential Equation)은 하나의 독립 변수에 대한 함수와 그 도함수들을 포함하는 방정식입니다.">상미분 방정식 (ODE)</dfn>`

            # 🖼️ 절대 규칙: 모든 시각 자료는 반드시 지정된 언어의 코드 블록 안에 포함하여 출력해야 합니다. 이 규칙은 선택이 아닌 필수입니다. 코드 블록 바깥에 순수한 JSON이나 다이어그램 코드를 절대로 출력해서는 안 됩니다. 이 규칙을 위반한 출력은 실패한 것으로 간주됩니다.

            Mermaid (mermaid): 순서도, 타임라인, 간트 차트 등 단순하고 정형화된 다이어그램에 사용합니다.
- **줄바꿈:** 노드 안에서 줄을 바꾸려면 반드시 전체 텍스트를 큰따옴표(`"`)로 감싸고 실제 엔터 키로 줄을 나눠야 합니다. `<br>` 태그는 절대 사용하지 마세요.
- **수식 사용 금지:** Mermaid 노드 안에서는 LaTeX 수식을 렌더링할 수 없으니, 복잡한 수식 대신 `ΔP`와 같은 간단한 텍스트나 유니코드 기호를 사용하세요.
            
            자유 시각화 (visual): 복잡한 개념, 비교, 구조 등을 설명해야 할 때, 아래 규칙에 따라 가상의 UI 컴포넌트 구조를 JSON으로 설계하여 시각화할 수 있습니다. 코드 블록의 언어는 **visual**로 지정해야 합니다.

            ### visual JSON 생성 규칙 (★★★★★ 반드시 준수)
            1.  **텍스트 내용**: 텍스트를 표시할 때는 반드시 `props` 객체 안에 `content` 속성을 사용해야 합니다.
                -   **올바른 예시:** `{ "type": "text", "props": { "content": "내용" } }`
                -   **잘못된 예시:** `{ "type": "text", "props": { "children": "내용" } }`

            2.  **요소 중첩**: 다른 요소를 자식으로 포함할 때는 반드시 최상위 레벨의 `children` 배열을 사용해야 합니다.
                -   **올바른 예시:** `{ "type": "box", "children": [ { "type": "text", ... } ] }`
                -   **잘못된 예시:** `{ "type": "box", "props": { "children": [ ... ] } }`

            3.  **스타일링**: 스타일은 `className`을 사용하지 말고, 반드시 CSS 속성을 직접 포함하는 인라인 `style` 객체를 사용해야 합니다.
                -   **올바른 예시:** `{ "props": { "style": { "color": "blue", "fontSize": "16px" } } }`
                -   **잘못된 예시:** `{ "props": { "className": "text-blue-500 text-base" } }`


            # 💬 대화 규칙
            1.  **명확성:** 학생의 질문에 명확하고 구조적으로 답변합니다.
            2.  **후속 질문:** 답변 마지막에 학생의 사고를 확장할 수 있는 좋은 후속 질문 3개를 제안합니다.
            3.  **JSON 출력:** 최종 결과는 반드시 `{"answer": "...", "followUp": ["...", "...", "..."]}` 형식의 JSON 객체로만 응답해야 합니다.

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
            
                        if use_gemini_direct:
                            gemini_api_keys = [key for key in valid_keys if key and key.startswith('AIza')] # Assuming Gemini keys start with AIza
                            if not gemini_api_keys:
                                raise ValueError("설정된 Gemini API 키가 없습니다.")
                            
                            for i, api_key in enumerate(gemini_api_keys):
                                try:
                                    print(f"INFO: Gemini Direct 모델 '{model_identifier}' / API 키 #{i + 1} (으)로 호출 시도...")
                                    genai.configure(api_key=api_key)
                                    model = genai.GenerativeModel(model_identifier.replace('google/', '')) # Remove 'google/' prefix for direct call
                
                                    # Prepare contents for Gemini API
                                    gemini_messages = []
                                    for msg in messages:
                                        parts = []
                                        if 'parts' in msg and msg['parts']:
                                            for part in msg['parts']:
                                                if 'text' in part:
                                                    parts.append(part['text'])
                                                # Add handling for image/pdf parts if needed for direct Gemini
                                        gemini_messages.append({'role': msg['role'], 'parts': parts})
                                    
                                    # Add system prompt as first user message for Gemini
                                    gemini_messages.insert(0, {'role': 'user', 'parts': [system_prompt_text]})
                                    gemini_messages.insert(1, {'role': 'model', 'parts': ['네, 알겠습니다.']}) # Acknowledge system prompt
                
                                    # Convert history to Gemini format
                                    gemini_history = []
                                    for msg in gemini_messages:
                                        if msg['role'] == 'user':
                                            gemini_history.append({'role': 'user', 'parts': [{'text': p} for p in msg['parts']]})
                                        elif msg['role'] == 'assistant':
                                            gemini_history.append({'role': 'model', 'parts': [{'text': p} for p in msg['parts']]})
                
                                    # Ensure the last message is from the user for generate_content
                                    if gemini_history and gemini_history[-1]['role'] == 'model':
                                        # If the last message is from the model, we need to add a dummy user message
                                        # or re-evaluate the history construction. For now, let's assume
                                        # the frontend always sends the last message as user.
                                        pass # This case should ideally not happen with current frontend logic
                
                                    # Call Gemini API
                                    response = model.generate_content(gemini_history)
                                    full_response_content = response.text
                
                                    # Extract answer and follow-up from Gemini response
                                    try:
                                        parsed_content = json.loads(full_response_content)
                                        answer = parsed_content.get('answer', full_response_content)
                                        follow_up = parsed_content.get('followUp', [])
                                    except json.JSONDecodeError:
                                        answer = full_response_content
                                        follow_up = []
                
                                    self.send_response(200)
                                    self.send_header('Content-type', 'application/json; charset=utf-8')
                                    self.end_headers()
                                    self.wfile.write(json.dumps({'answer': answer, 'followUp': follow_up}, ensure_ascii=False).encode('utf-8'))
                                    return
                
                                except Exception as e:
                                    last_error = e
                                    print(f"WARN: Gemini Direct API 키 #{i + 1} 사용 실패. 다음 키로 폴백합니다. 오류: {e}")
                                    continue
                            raise ConnectionError(f"모든 Gemini API 키로 요청에 실패했습니다. 마지막 오류: {last_error_text}") from last_error
                        else: # Use OpenRouter
                            openrouter_api_keys = [key for key in valid_keys if key and not key.startswith('AIza')] # Assuming OpenRouter keys don't start with AIza
                            if not openrouter_api_keys:
                                raise ValueError("설정된 OpenRouter API 키가 없습니다.")
                
                            for i, api_key in enumerate(openrouter_api_keys):
                                try:
                                    print(f"INFO: OpenRouter 모델 '{model_identifier}' / API 키 #{i + 1} (으)로 호출 시도...")
                                    payload = {
                                        "model": model_identifier,
                                        "messages": [system_prompt] + messages,
                                        "stream": True
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
                                        stream=True
                                    )
                                    response.raise_for_status()
                                    
                                    self.send_response(200)
                                    self.send_header('Content-type', 'text/event-stream; charset=utf-8')
                                    self.end_headers()
                
                                    full_response_content = ""
                                    for line in response.iter_lines():
                                        if line:
                                            decoded_line = line.decode('utf-8')
                                            if decoded_line.startswith('data: '):
                                                json_str = decoded_line[len('data: '):]
                                                if json_str.strip() == '[DONE]':
                                                    break
                                                try:
                                                    data = json.loads(json_str)
                                                    if 'choices' in data and data['choices']:
                                                        delta = data['choices'][0].get('delta', {})
                                                        content = delta.get('content')
                                                        if content:
                                                            full_response_content += content
                                                            self.wfile.write(f"data: {json.dumps({'token': content}, ensure_ascii=False)}\n\n".encode('utf-8'))
                                                            self.wfile.flush()
                                                except json.JSONDecodeError:
                                                    print(f"WARN: 스트림에서 유효하지 않은 JSON 수신: {json_str}")
                                                    continue
                                    
                                    try:
                                        follow_up_prompt = {
                                            "role": "system",
                                            "content": f"사용자의 마지막 질문과 AI의 전체 답변을 바탕으로, 학생의 사고를 확장할 수 있는 좋은 후속 질문 3개를 제안해주세요. 전체 답변: '{full_response_content}'. 반드시 '{{\"followUp\": [\"...\", \"...\", \"...\"]}}' 형식의 JSON 객체로만 응답해야 합니다."
                                        }
                                        
                                        follow_up_payload = {
                                            "model": model_identifier,
                                            "messages": [system_prompt] + messages + [{"role": "assistant", "content": full_response_content}, follow_up_prompt],
                                            "response_format": {"type": "json_object"}
                                        }
                
                                        follow_up_response = requests.post(
                                            url="https://openrouter.ai/api/v1/chat/completions",
                                            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                                            json=follow_up_payload,
                                            timeout=60
                                        )
                                        follow_up_response.raise_for_status()
                                        follow_up_data = follow_up_response.json()
                                        follow_up_content = follow_up_data['choices'][0]['message']['content']
                                        
                                        self.wfile.write(f"data: {follow_up_content}\n\n".encode('utf-8'))
                                        self.wfile.flush()
                
                                    except Exception as fu_e:
                                        print(f"WARN: 후속 질문 생성 실패: {fu_e}")
                
                                    self.wfile.write('data: [DONE]\n\n'.encode('utf-8'))
                                    self.wfile.flush()
                                    return
                
                                except requests.exceptions.RequestException as e:
                                    last_error = e
                                    if e.response is not None:
                                        last_error_text = e.response.text
                                    print(f"WARN: API 키 #{i + 1} 사용 실패. 다음 키로 폴백합니다. 오류: {e}")
                                    continue
                
                            raise ConnectionError(f"모든 OpenRouter API 키로 요청에 실패했습니다. 마지막 오류: {last_error_text}") from last_error        except Exception as e:
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