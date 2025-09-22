from http.server import BaseHTTPRequestHandler
import json
import os
import google.generativeai as genai
from PIL import Image
import io
from pdf2image import convert_from_bytes
import cgi

import traceback

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
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
                    images = convert_from_bytes(file_data)
                    if images:
                        img = images[0]
                except Exception as e:
                    if "Poppler" in str(e):
                        raise ValueError("Poppler not found. Please install Poppler and add it to your system's PATH to process PDF files.")
                    else:
                        raise e
            elif 'image' in file_type:
                img = Image.open(io.BytesIO(file_data))
            
            if img is None:
                raise ValueError("Unsupported file type or file processing failed. Please upload a valid PDF or an image.")

            api_key = os.environ.get('GEMINI_API_KEY')
            if not api_key:
                raise ValueError("GEMINI_API_KEY environment variable not set.")
            
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-2.5-flash')

            prompt = f"""이 시간표 이미지에서 과목 이름(subjectName), 시작 시간(startTime), 종료 시간(endTime), 요일(dayOfWeek)을 추출하여 JSON 배열 형식으로 만들어줘.

            추출 규칙:
            1. **시간 계산:** 시간표의 한 칸은 보통 1시간을 의미합니다. 과목이 차지하는 칸 수를 바탕으로 시작 시간(startTime)과 종료 시간(endTime)을 정확히 계산해야 합니다.
            2. **중복 및 분리:** 한 요일의 같은 시간대에 여러 과목이 겹쳐 있거나 나란히 있는 경우, 각 과목을 반드시 별개의 JSON 객체로 분리하여 추출해야 합니다.
            3. **출력 형식:**
               - subjectName: 한글 과목명을 그대로 추출합니다.
               - startTime, endTime: 'HH:MM' 형식으로 추출합니다.
               - dayOfWeek: '월','화','수','목','금','토','일' 중 하나로 표기합니다.
            """

            response = model.generate_content([prompt, img])

            raw_text = response.text
            print(f"Gemini Raw Response for Calendar: {raw_text}")

            cleaned_text = raw_text.replace('```json', '').replace('```', '').strip()

            if not cleaned_text or not cleaned_text.startswith('['):
                try:
                    if response.prompt_feedback.block_reason:
                        reason = response.prompt_feedback.block_reason
                        raise ValueError(f"AI model blocked the request for safety reasons: {reason}")
                except (AttributeError, IndexError):
                    pass
                raise ValueError(f"AI model returned an empty or invalid response. Raw text: '{raw_text}'")

            json_response = json.loads(cleaned_text)

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(json_response).encode('utf-8'))

        except Exception as e:
            print(f"Error processing request: {e}")
            traceback.print_exc()
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            error_details = {
                "error": str(e),
                "traceback": traceback.format_exc()
            }
            self.wfile.write(json.dumps(error_details).encode('utf-8'))