from http.server import BaseHTTPRequestHandler
import json
import os
import google.generativeai as genai
from PIL import Image
import io
from pdf2image import convert_from_bytes, pdfinfo_from_bytes
import cgi
import traceback

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
        last_error = None

        try:
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': self.headers['Content-Type']}
            )
            
            uploaded_file = form['file']
            file_data = uploaded_file.file.read()
            file_type = uploaded_file.type

            img = None
            if file_type == 'application/pdf':
                try:
                    # Poppler 설치 여부 먼저 확인
                    pdfinfo_from_bytes(file_data, userpw=None, poppler_path=None)
                    images = convert_from_bytes(file_data)
                    if images:
                        img = images[0]
                except Exception as e:
                    # pdf2image.exceptions.PDFInfoNotInstalledError 감지
                    if "Poppler" in str(e) or "PDFInfoNotInstalledError" in str(type(e)):
                        raise ValueError("PDF 처리에 필요한 Poppler 라이브러리를 서버에 설치해야 합니다. 로컬에서는 Poppler를 설치하고 PATH에 추가해주세요.")
                    else: # 그 외 다른 PDF 관련 오류
                        raise e
            elif 'image' in file_type:
                img = Image.open(io.BytesIO(file_data))
            
            if img is None:
                raise ValueError("Unsupported file type or file processing failed. Please upload a valid PDF or an image.")

            if not valid_keys:
                raise ValueError("설정된 Gemini API 키가 없습니다.")

            prompt = """이 시간표 이미지에서 과목 이름(subjectName), 시작 시간(startTime), 종료 시간(endTime), 요일(dayOfWeek)을 추출하여 JSON 배열 형식으로 만들어줘.

            추출 규칙:
            1. **시간 계산:** 시간표의 한 칸은 보통 1시간을 의미합니다. 과목이 차지하는 칸 수를 바탕으로 시작 시간(startTime)과 종료 시간(endTime)을 정확히 계산해야 합니다.
            2. **중복 및 분리:** 한 요일의 같은 시간대에 여러 과목이 겹쳐 있거나 나란히 있는 경우, 각 과목을 반드시 별개의 JSON 객체로 분리하여 추출해야 합니다.
            3. **출력 형식:**
               - subjectName: 한글 과목명을 그대로 추출합니다.
               - startTime, endTime: 'HH:MM' 형식으로 추출합니다.
               - dayOfWeek: '월','화','수','목','금','토','일' 중 하나로 표기합니다.
            """

            for i, api_key in enumerate(valid_keys):
                try:
                    print(f"INFO: API 키 #{i + 1} (으)로 시간표 처리 시도...")
                    genai.configure(api_key=api_key)
                    model = genai.GenerativeModel('gemini-1.5-flash-latest')
                    
                    response = model.generate_content([prompt, img], request_options={'timeout': 60})
                    
                    raw_text = response.text
                    print(f"Gemini Raw Response for Calendar: {raw_text}")

                    cleaned_text = raw_text.replace('```json', '').replace('```', '').strip()

                    if not cleaned_text or not cleaned_text.startswith('['):
                        try:
                            if response.prompt_feedback.block_reason:
                                reason = response.prompt_feedback.block_reason
                                raise ValueError(f"AI 모델이 안전상의 이유로 요청을 차단했습니다: {reason}")
                        except (AttributeError, IndexError):
                            pass
                        raise ValueError(f"AI 모델이 비어있거나 유효하지 않은 응답을 반환했습니다. 원본 텍스트: '{raw_text}'")

                    json_response = json.loads(cleaned_text)

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
            print(f"Error processing request: {e}")
            traceback.print_exc()
            self.send_response(500)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.end_headers()
            error_details = {
                "error": "시간표 처리 중 서버 오류가 발생했습니다.",
                "details": str(e)
            }
            self.wfile.write(json.dumps(error_details, ensure_ascii=False).encode('utf-8'))