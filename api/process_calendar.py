from http.server import BaseHTTPRequestHandler
import json
import os
import google.generativeai as genai
from PIL import Image
import io

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Get the image from the request
            content_length = int(self.headers['Content-Length'])
            image_data = self.rfile.read(content_length)

            # Optimize the image with Pillow
            img = Image.open(io.BytesIO(image_data))
            # You can add more optimization here if needed, e.g., resizing
            # img = img.resize((1024, 1024))
            
            # Configure the Gemini API
            genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))
            model = genai.GenerativeModel('2.5-flash')

            # The prompt for the API
            prompt = "이 시간표 이미지를 분석하여 각 과목의 이름(subjectName), 시작 시간(startTime), 종료 시간(endTime), 요일(dayOfWeek)을 JSON 배열로 추출해줘. 요일은 월,화,수,목,금,토,일 중 하나로 표기해줘."

            # Send the image to the Gemini API
            response = model.generate_content([prompt, img])

            # Extract the JSON from the response
            # This might need adjustment based on the actual response format from Gemini
            json_response = json.loads(response.text.replace('```json', '').replace('```', ''))

            # Send the JSON response to the frontend
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(json_response).encode('utf-8'))

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
