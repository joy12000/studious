from http.server import BaseHTTPRequestHandler
import json
import os
import google.generativeai as genai
import tempfile
import shutil
from PIL import Image
import traceback
import requests
import io

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
            if not blob_urls or not isinstance(blob_urls, list):
                return self.handle_error(ValueError("유효하지 않은 blobUrls 입니다."), status_code=400)
            
            blob_urls_to_delete.extend(blob_urls) # Add to cleanup list

            subject_name = data.get('subject', '[과목명]')
            subject_id = data.get('subjectId')
            week_info = data.get('week', '[N주차/18주차]')
            material_types = data.get('materialTypes', '[PPT/PDF/텍스트 등]')

            prompt = f"""
            당신은 인지과학과 교육심리학 전문가입니다. 첨부된 강의 자료를 분석하여, 학생이 스스로 깊이 있게 학습할 수 있는 최고의 참고서를 제작해야 합니다.

            # 📖 교과서 정보
            - 과목: {subject_name}
            - 주차: {week_info}
            - 자료 형태: {material_types}

            # 🎨 출력 서식 규칙 (★★★★★ 가장 중요)
            당신이 생성하는 모든 텍스트는 아래 규칙을 **반드시** 따라야 합니다.

            1.  **수학 수식 (LaTeX):** 모든 수학 기호, 변수, 방정식은 **반드시** KaTeX 문법으로 감싸야 합니다.
                -   인라인 수식: $로 감쌉니다. 예: $q''_x = -k \frac{{dT}}{{dx}}$
                -   블록 수식: $$로 감쌉니다. 예: $$ T(x) = T_s + \frac{{q'''}}{{2k}}(Lx - x^2) $$
                -   수식 내부에 일반 텍스트(한글 등)를 넣어야 할 경우, 반드시 `\\text{{}}` 명령어로 감싸야 합니다. (예: $(P_\\text{{목표}} - P_\\text{{시작}})$)

            2.  **코드 (Code Block):** 모든 소스 코드는 **반드시** 언어를 명시한 코드 블록으로 작성해야 합니다.
                -   예시: ```python\nprint("Hello")\n```

            3.  **핵심 용어 (Tooltip):** 중요한 전공 용어는 **반드시** `<dfn title="용어에 대한 간단한 설명">핵심 용어</dfn>` HTML 태그로 감싸 설명을 제공해야 합니다.
                -   예시: `<dfn title="매질 없이 열이 직접 전달되는 현상">복사</dfn>`

            4.  **이미지 (Image):**
            -   **절대로 외부 이미지 링크(예: `imgur.com`)를 생성하거나 사용하지 마세요.**
            -   학습 자료에 포함된 이미지를 본문에 삽입해야 할 경우, `[이미지: 이미지에 대한 상세한 설명]` 형식의 텍스트 설명으로 대체하세요. 이 설명은 이미지를 보지 않고도 내용을 이해할 수 있을 만큼 구체적이어야 합니다.
            -   예시: `[이미지: 뉴런의 구조를 보여주는 다이어그램. 세포체, 축삭, 수상돌기가 표시되어 있음.]`

            # 🖼️ 절대 규칙: 모든 시각 자료는 반드시 지정된 언어의 코드 블록 안에 포함하여 출력해야 합니다. 이 규칙은 선택이 아닌 필수입니다. 코드 블록 바깥에 순수한 JSON이나 다이어그램 코드를 절대로 출력해서는 안 됩니다. 이 규칙을 위반한 출력은 실패한 것으로 간주됩니다.

             Mermaid (mermaid): 순서도, 타임라인 등을 시각화할 때 사용합니다.
        - **따옴표 규칙:** 노드 이름, 링크 텍스트, subgraph 제목에 줄바꿈, 공백, 또는 특수문자 `( ) ,`가 포함될 경우, 반드시 전체 내용을 큰따옴표(`"`)로 감싸야 합니다.
        - **줄바꿈:** 노드 안에서 줄을 바꾸려면 `<br>` 태그 대신, 반드시 전체 텍스트를 큰따옴표(`"`)로 감싸고 실제 엔터 키로 줄을 나눠야 합니다.
        - **수식 사용 금지:** Mermaid 노드 안에서는 LaTeX 수식을 렌더링할 수 없으니, `ΔP`와 같은 간단한 텍스트나 유니코드 기호만 사용하세요.

        - **올바른 예시:**
         A["첫 번째 줄
        두 번째 줄"]
        B["노드 이름 (특수문자)"]
        C -- "링크 텍스트" --> D
        subgraph "서브그래프 제목"
        
-       **잘못된 예시:**
        A[첫 번째 줄<br>두 번째 줄]
        B[노드 이름 (특수문자)]
        C -- 링크 텍스트 --> D
        subgraph "서브그래프 제목"  
        
            자유 시각화 (visual): 복잡한 개념, 비교, 구조 등을 설명해야 할 때, 아래 규칙에 따라 가상의 UI 컴포넌트 구조를 JSON으로 설계하여 시각화할 수 있습니다. **이 JSON 데이터는 반드시 `visual` 언어 타입의 코드 블록으로 감싸야 합니다.**

            - **올바른 예시:**
            ```visual
            {{
              "type": "box",
              "children": [ {{ "type": "text", "props": {{ "content": "예시" }} }} ]
            }}
            ```

            ### visual JSON 생성 규칙 (★★★★★ 반드시 준수)
            1.  **텍스트 내용**: 텍스트를 표시할 때는 반드시 `props` 객체 안에 `content` 속성을 사용해야 합니다.
                -   **올바른 예시:** `{{ "type": "text", "props": {{ "content": "내용" }} }}`
                -   **잘못된 예시:** `{{ "type": "text", "props": {{ "children": "내용" }} }}`
            2.  **요소 중첩**: 다른 요소를 자식으로 포함할 때는 반드시 최상위 레벨의 `children` 배열을 사용해야 합니다.
                -   **올바른 예시:** `{{ "type": "box", "children": [ {{ "type": "text", ... }} ] }}`
                -   **잘못된 예시:** `{{ "type": "box", "props": {{ "children": [ ... ] }} }}`
            3.  **스타일링**: 스타일은 `className`을 사용하지 말고, 반드시 CSS 속성을 직접 포함하는 인라인 `style` 객체를 사용해야 합니다.
                -   **올바른 예시:** `{{ "props": {{ "style": {{ "color": "blue", "fontSize": "16px" }} }} }}`
                -   **잘못된 예시:** `{{ "props": {{ "className": "text-blue-500 text-base" }} }}`

            4.  **개념 분리**: 서로 다른 여러 개념을 나란히 비교하거나 나열할 때, 하나의 거대한 `visual` 블록으로 합치지 마세요. 각 개념에 대해 **별개의 `visual` 코드 블록을 생성**하여 명확하게 구분해야 합니다. (예: '전도, 대류, 복사'를 설명한다면, 각각에 대한 `visual` 블록을 총 3개 만들어야 합니다.)

            # 📚 결과물 구조 (Gagne의 9단계 + 백워드 설계)
            1단계: **주의집중 & 학습목표** (핵심 질문, 구체적 목표, 이전 학습과의 연결고리)
            2단계: **선행지식 활성화** (사전 점검 퀴즈, 관련 개념 요약)
            3단계: **핵심 내용 구조화** (각 개념별 정의, 시각화(Mermaid), 구체적 예시, 주의사항 제시)
            4단계: **단계별 예제** (유형별 모범 풀이와 사고과정 설명, 변형 문제 제시, 자료에 제시된 문제 빠짐없이 제시.)
            5단계: **능동 연습 설계** (기초/응용/교차 연습 문제 및 자가 채점 해설)
            6단계: **요약 및 연결** (핵심 요약, 암기용 개념 카드, 다음 학습 예고)
            7단계: **복습 스케줄링** (1일/3일/1주 후 복습 계획 제안)

            # ✅ 최종 품질 체크리스트
            - 위의 '출력 서식 규칙'이 모두 완벽하게 적용되었는가?
            - 자기주도 학습이 가능한 친절하고 상세한 설명인가?

            결과물은 다른 설명 없이, 위 규칙들을 모두 준수한 참고서 본문(마크다운)만 생성해야 합니다.
            """
            
            request_contents = [prompt]
            text_materials = []
            import google.ai.generativelanguage as glm

            for url in blob_urls:
                try:
                    response = requests.get(url, stream=True)
                    response.raise_for_status()
                    file_content = response.content
                    content_type = response.headers.get('content-type', 'application/octet-stream')

                    if 'image/' in content_type:
                        request_contents.append(Image.open(io.BytesIO(file_content)))
                    elif 'application/pdf' in content_type:
                        request_contents.append(glm.Part(inline_data=glm.Blob(mime_type='application/pdf', data=file_content)))
                    else:
                        text_materials.append(file_content.decode('utf-8', errors='ignore'))
                except Exception as e:
                    print(f"WARN: Blob URL에서 파일 다운로드 또는 처리 실패 ('{url}'): {e}")

            if text_materials:
                request_contents.append("\n--- 학습 자료 (텍스트) ---\n" + "\n\n".join(text_materials))
                
            for i, api_key in enumerate(valid_keys):
                try:
                    print(f"INFO: API 키 #{i + 1} (으)로 참고서 생성 시도...")
                    genai.configure(api_key=api_key)
                    model = genai.GenerativeModel('gemini-2.5-pro')
                    
                    response = model.generate_content(request_contents)
                    
                    json_response = {
                        "title": f"{subject_name} - {week_info} 참고서",
                        "content": response.text,
                        "subjectId": subject_id
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