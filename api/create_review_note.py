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
            learning_material_files = form.getlist('files')
            subjects_list_str = form.getvalue('subjects', '[]')
            subjects_list = json.loads(subjects_list_str)

            api_key = os.environ.get('GEMINI_API_KEY')
            if not api_key:
                raise ValueError("GEMINI_API_KEY environment variable not set.")

            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-1.5-flash-latest') # 모델명을 최신으로 업데이트

            prompt_text = f"""
            너는 학습 전문가다.
            주어진 대화 내용과 여러 학습 자료를 종합하고, 아래 '과목 목록'을 참고하여 가장 관련 있는 과목의 'id'를 'subjectId' 필드에 담아라.
            그리고 해당 과목의 복습 노트(요약, 핵심 개념)와 객관식 퀴즈 3개를 포함하여 {{"title": "...", "summary": "...", "key_insights": ["...", "..."], "quiz": {{"questions": [{{"question": "...", "options": ["...", "..."], "answer": "..."}}]}}, "subjectId": "..."}} 형식의 JSON으로 출력해줘.

            AI 대화 내용: {ai_conversation_text}
            과목 목록 (JSON 형식): {subjects_list}
            """
            
            request_contents = [prompt_text]
            
            for learning_material_file in learning_material_files:
                # ✨ [오류 수정] getattr를 사용하여 안정적으로 파일 내용물 가져오기
                file_content = getattr(learning_material_file, 'value', learning_material_file)
                file_type = getattr(learning_material_file, 'type', 'application/octet-stream')
                filename = getattr(learning_material_file, 'filename', 'unknown')

                if not isinstance(file_content, bytes):
                    continue

                if file_type == 'application/pdf':
                    try:
                        images = convert_from_bytes(file_content)
                        if images:
                            # PDF의 모든 페이지를 이미지로 추가
                            request_contents.extend(images)
                    except Exception as e:
                        if "Poppler" in str(e):
                            raise ValueError("PDF 처리를 위해 Poppler를 설치해야 합니다.")
                        else:
                            raise e
                elif 'image' in file_type:
                    try:
                        img = Image.open(io.BytesIO(file_content))
                        request_contents.append(img)
                    except Exception as img_err:
                         print(f"이미지 파일 '{filename}' 처리 중 오류: {img_err}")
                else:
                    try:
                        text_content = file_content.decode('utf-8', errors='ignore')
                        request_contents.append(f"\n--- 텍스트 파일 '{filename}' 내용 ---\n{text_content}")
                    except Exception as txt_err:
                        print(f"텍스트 파일 '{filename}' 처리 중 오류: {txt_err}")

            response = model.generate_content(request_contents)

            cleaned_text = response.text.strip().replace('```json', '').replace('```', '')
            json_response = json.loads(cleaned_text)

            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
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