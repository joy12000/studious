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
            learning_materials = form.getlist('files')
            
            subject_name = form.getvalue('subject', '[과목명]')
            week_info = form.getvalue('week', '[N주차/18주차]')
            material_types = form.getvalue('materialTypes', '[PPT/PDF/텍스트 등]')

            prompt = f"""
            당신은 인지과학과 교육심리학 전문가입니다. 첨부된 강의 자료를 분석하여, 학생이 스스로 깊이 있게 학습할 수 있는 최고의 참고서를 제작해야 합니다.

            # 🎨 출력 서식 규칙 (★★★★★ 가장 중요)
            당신이 생성하는 모든 텍스트는 아래 규칙을 **반드시** 따라야 합니다.

            1.  **수학 수식 (LaTeX):** 모든 수학 기호, 변수, 방정식은 **반드시** KaTeX 문법으로 감싸야 합니다.
                -   인라인 수식: `$`로 감쌉니다. 예: `$\ q''_x = -k \frac{{dT}}{{dx}} $`
                -   블록 수식: `$$`로 감쌉니다. 예: `$$ T(x) = T_s + \frac{{q'''}}{{2k}}(Lx - x^2) $$`
            
            2.  **다이어그램 (Mermaid):** 복잡한 시스템, 알고리즘, 상태 변화는 **반드시** Mermaid.js 문법으로 시각화해야 합니다.
                -   예시: ```mermaid\ngraph TD; A[열원] --> B(표면);\n```
            
            3.  **코드 (Code Block):** 모든 소스 코드는 **반드시** 언어를 명시한 코드 블록으로 작성해야 합니다.
                -   예시: ```python\nprint("Hello")\n```
            
            4.  **핵심 용어 (Tooltip):** 중요한 전공 용어는 **반드시** `<dfn title="용어에 대한 간단한 설명">핵심 용어</dfn>` HTML 태그로 감싸 설명을 제공해야 합니다.
                -   예시: `<dfn title="매질 없이 열이 직접 전달되는 현상">복사</dfn>`

            # 📚 결과물 구조 (Gagne의 9단계 + 백워드 설계)
            1단계: **주의집중 & 학습목표** (핵심 질문, 구체적 목표, 이전 학습과의 연결고리)
            2단계: **선행지식 활성화** (사전 점검 퀴즈, 관련 개념 요약)
            3단계: **핵심 내용 구조화** (각 개념별 정의, 시각화(Mermaid), 구체적 예시, 주의사항 제시)
            4단계: **단계별 예제** (유형별 모범 풀이와 사고과정 설명, 변형 문제 제시)
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

            for material_file in learning_materials:
                file_content = getattr(material_file, 'value', material_file)
                file_type = getattr(material_file, 'type', 'application/octet-stream')
                filename = getattr(material_file, 'filename', 'unknown')
                print(f"INFO: 처리 중인 파일: {filename}, 타입: {file_type}")

                if not isinstance(file_content, bytes):
                    continue

                if file_type == 'application/pdf':
                    try:
                        images = convert_from_bytes(file_content)
                        if images:
                            request_contents.extend(images)
                    except Exception as e:
                        print(f"WARN: PDF 처리 실패 ('{filename}'): {e}")
                        if "Poppler" in str(e):
                            raise ValueError("PDF 처리를 위해 Poppler를 설치해야 합니다.")
                        else:
                            raise e
                elif 'image' in file_type:
                    try:
                        img = Image.open(io.BytesIO(file_content))
                        request_contents.append(img)
                    except Exception as img_err:
                        print(f"WARN: 이미지 파일 처리 실패 ('{filename}'): {img_err}")
                else:
                    try:
                        text_content = file_content.decode('utf-8', errors='ignore')
                        text_materials.append(text_content)
                    except Exception as txt_err:
                        print(f"WARN: 텍스트 파일 처리 실패 ('{filename}'): {txt_err}")

            if text_materials:
                request_contents.append("\n--- 학습 자료 (텍스트) ---\n" + "\n\n".join(text_materials))
                
            for i, api_key in enumerate(valid_keys):
                try:
                    print(f"INFO: API 키 #{i + 1} (으)로 참고서 생성 시도...")
                    genai.configure(api_key=api_key)
                    model = genai.GenerativeModel('gemini-1.5-pro-latest')
                    
                    response = model.generate_content(request_contents)
                    
                    json_response = {"textbook": response.text}

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
