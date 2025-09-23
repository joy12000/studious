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
            당신은 인지과학과 교육심리학 전문가입니다. 첨부된 강의 자료를 분석해서, 교수 수업 없이도 스스로 이해하고 숙달할 수 있는 학습 자료를 제작해주세요.

            📋 분석할 자료 정보:
            과목: {subject_name}
            주차: {week_info}
            제공 자료: {material_types}
            ... (이하 프롬프트 동일) ...
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
        print(f"ERROR: {message}: {e}")
        traceback.print_exc()
        if not hasattr(self, '_headers_sent') or not self._headers_sent:
            try:
                self.send_response(status_code)
                self.send_header('Content-type', 'application/json; charset=utf-8')
                self.end_headers()
                error_details = {"error": message, "details": str(e), "traceback": traceback.format_exc()}
                self.wfile.write(json.dumps(error_details).encode('utf-8'))
            except Exception as write_error:
                print(f"FATAL: 오류 응답을 보내는 중 추가 오류 발생: {write_error}")