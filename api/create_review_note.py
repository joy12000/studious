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
        try:
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': self.headers['Content-Type']}
            )

            ai_conversation_text = form.getvalue('aiConversationText', '')
            learning_material_files = form.getlist('files') # Use getlist to handle multiple files
            subjects_list = json.loads(form.getvalue('subjects', '[]'))

            api_key = os.environ.get('GEMINI_API_KEY')
            if not api_key:
                raise ValueError("GEMINI_API_KEY environment variable not set.")

            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-2.0-flash')

            prompt_text = f"""너는 학습 전문가다. 
            주어진 대화 내용과 여러 학습 자료를 종합하고, 아래 '과목 목록'을 참고하여 가장 관련 있는 과목의 'id'를 'subjectId' 필드에 담아라.
            그리고 해당 과목의 복습 노트(요약, 핵심 개념)와 객관식 퀴즈 3개를 포함하여 {{"title", "summary", "key_insights", "quiz", "subjectId"}} 형식의 JSON으로 출력해줘.

            AI 대화 내용: {ai_conversation_text}
            과목 목록 (JSON 형식): {subjects_list}
            """
            
            request_contents = [prompt_text]
            text_materials = []

            for learning_material_file in learning_material_files:
                file_content = learning_material_file.file.read()
                file_type = learning_material_file.type

                if file_type == 'application/pdf':
                    try:
                        images = convert_from_bytes(file_content)
                        if images:
                            request_contents.append(images[0])
                    except Exception as e:
                        if "Poppler" in str(e):
                            raise ValueError("Poppler not found. Please install Poppler and add it to your system's PATH to process PDF files.")
                        else:
                            raise e
                elif 'image' in file_type:
                    img = Image.open(io.BytesIO(file_content))
                    request_contents.append(img)
                else:
                    # For text files, collect them to append at the end
                    text_materials.append(file_content.decode('utf-8', errors='ignore'))

            if text_materials:
                request_contents.append("\n--- 학습 자료 (텍스트) ---\n" + "\n\n".join(text_materials))

            response = model.generate_content(request_contents)

            # Clean the response text before parsing
            cleaned_text = response.text.strip()
            if cleaned_text.startswith('```json'):
                cleaned_text = cleaned_text[7:]
            if cleaned_text.endswith('```'):
                cleaned_text = cleaned_text[:-3]
            
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
