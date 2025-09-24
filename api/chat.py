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

            # --- [프롬프트 강화] ---
            system_prompt_text = """
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

            # 🖼️ 시각화 규칙: 설명에 필요한 시각 자료는 아래 두 가지 방법 중 가장 적절한 것을 선택하여 생성해야 합니다.

            Mermaid (mermaid): 순서도, 타임라인, 간트 차트 등 단순하고 정형화된 다이어그램에 사용합니다. 마크다운과 유사한 간결한 문법을 사용하세요.
            JointJS (jointjs): 회로도, 시스템 아키텍처, 복잡한 개념도 등 정교하고 비정형적인 다이어그램에 사용합니다. 아래의 JSON 구조를 따르세요.
            cells: 모든 요소를 담는 배열.
            각 요소는 type, position, size, 고유 id, attrs (스타일) 등을 포함합니다.
            연결선(standard.Link)은 source와 target에 연결할 요소의 id를 명시합니다.
            회로도 기호는 SVG 이미지를 데이터 URI로 직접 생성하여 standard.Image 타입의 xlink:href 속성에 포함시킬 수 있습니다.
            JointJS 예시 (회로도):
            ```jointjs
            {
            "cells": [
            {
            "type": "standard.Image",
            "id": "resistor",
            "position": { "x": 100, "y": 80 },
            "size": { "width": 100, "height": 40 },
            "attrs": { "image": { "xlink:href": "data:image/svg+xml;utf8,<svg>...</svg>" } }
            }
            ]
            }
            ```

            자유 시각화 (JSON Component): 복잡한 개념, 비교, 구조 등을 설명해야 할 때, 아래 규칙에 따라 가상의 UI 컴포넌트 구조를 JSON으로 설계하여 시각화할 수 있습니다. 코드 블록의 언어는 **visual**로 지정해야 합니다.

            type: 렌더링할 요소의 종류 (box, text, svg, rect, circle, path 등).
            props: 해당 요소의 속성 (스타일, 내용 등). className을 통해 Tailwind CSS 클래스를 사용하여 디자인합니다. SVG 요소의 경우 x, y, d 등 모든 SVG 속성을 사용합니다.
            children: 자식 요소들의 배열.
            예시 (간단한 비교):
            ```visual
            {
            "type": "box",
            "props": { "className": "flex gap-4 p-4" },
            "children": [
            { "type": "box", "props": { "className": "flex-1 p-3" }, "children": [{ "type": "text", "props": { "content": "항목 1" }}]},
            { "type": "box", "props": { "className": "flex-1 p-3" }, "children": [{ "type": "text", "props": { "content": "항목 2" }}]}
            ]
            }
            ```

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