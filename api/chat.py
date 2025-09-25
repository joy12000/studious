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
        try:
            # 1. Parse Request
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data)
            
            note_context = data.get('noteContext', '')
            user_message = data.get('userMessage', '')
            chat_history = data.get('chatHistory', [])

            if not user_message:
                return self.handle_error(ValueError("userMessage is required."), "Bad Request", 400)

            # 2. Configure API
            # Try primary key first, then fall back to the general one
            api_key = os.environ.get('GEMINI_API_KEY_PRIMARY') or os.environ.get('GEMINI_API_KEY')
            if not api_key:
                 return self.handle_error(ValueError("GEMINI_API_KEY not set."), "Configuration Error", 500)
            
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel('gemini-1.5-pro-latest')

            # 3. Prepare Chat
            system_prompt = f"""You are a helpful study assistant. Your goal is to help the user understand their notes.
            Use the provided note context to answer the user's questions.
            Keep your answers concise and clear. Format responses in Markdown.

            --- NOTE CONTEXT ---
            {note_context}
            --- END NOTE CONTEXT ---"""

            # Reformat history for the model
            model_history = []
            for msg in chat_history:
                role = 'user' if msg['sender'] == 'user' else 'model'
                model_history.append({'role': role, 'parts': [{'text': msg['text']}]})

            # Start the chat session
            chat = model.start_chat(history=model_history)
            
            # 4. Stream Response
            self.send_response(200)
            self.send_header('Content-type', 'text/plain; charset=utf-8')
            self.end_headers()

            # Combine system prompt with the latest user message
            full_prompt = f"{system_prompt}\n\nUSER QUESTION: {user_message}"
            
            response = chat.send_message(full_prompt, stream=True)
            for chunk in response:
                if chunk.text:
                    self.wfile.write(chunk.text.encode('utf-8'))
            
        except Exception as e:
            # If headers are not sent, send an error response.
            # Otherwise, we can't do much as the stream has started.
            if not hasattr(self, '_headers_sent') or not self._headers_sent:
                self.handle_error(e)
            else:
                print(f"ERROR during streaming: {e}")
                traceback.print_exc()