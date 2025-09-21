from http.server import BaseHTTPRequestHandler
import json
import os
import google.generativeai as genai
import cgi
from PIL import Image
import io

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': self.headers['Content-Type']}
            )

            ai_conversation_text = form.getvalue('aiConversationText', '')
            learning_material_file = form['file']
            subjects_list = json.loads(form.getvalue('subjects', '[]'))

            file_content = learning_material_file.file.read()
            file_type = learning_material_file.type

            genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))
            model = genai.GenerativeModel('2.5-flash')

            prompt_text = f"""너는 학습 전문가다. 
            주어진 대화 내용과 학습 자료를 종합하고, 등록된 과목 목록을 참고하여 가장 관련 있는 과목을 자동으로 분류해라. 
            그리고 해당 과목의 복습 노트(요약, 핵심 개념)와 객관식 퀴즈 3개를 포함하여 {{title, summary, key_insights, quiz, subjectName}} 형식의 JSON으로 출력해줘.

            AI 대화 내용: {ai_conversation_text}
            과목 목록: {subjects_list}
            """
            
            request_contents = [prompt_text]

            if 'image' in file_type:
                img = Image.open(io.BytesIO(file_content))
                request_contents.append(img)
            else:
                # For text files, add the content to the prompt
                text_prompt = prompt_text + f"\n학습 자료: {file_content.decode('utf-8', errors='ignore')}"
                request_contents = [text_prompt]

            response = model.generate_content(request_contents)

            json_response = json.loads(response.text.replace('```json', '').replace('```', ''))

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(json_response).encode('utf-8'))

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
