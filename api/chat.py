from http.server import BaseHTTPRequestHandler
import json
import os
import google.generativeai as genai
import traceback
import re

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
        # List of API keys to try
        api_keys = [
            os.environ.get('GEMINI_API_KEY_PRIMARY'),
            os.environ.get('GEMINI_API_KEY_SECONDARY'),
            os.environ.get('GEMINI_API_KEY_TERTIARY'),
            os.environ.get('GEMINI_API_KEY_QUATERNARY'),
            os.environ.get('GEMINI_API_KEY')
        ]
        valid_keys = [key for key in api_keys if key]

        if not valid_keys:
            return self.handle_error(ValueError("No valid Gemini API keys found."), "Configuration Error", 500)

        try:
            # 1. Parse Request
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data)
            
            note_context = data.get('noteContext', '')
            chat_history = data.get('history', []) 
            
            if not chat_history or chat_history[-1]['role'] != 'user':
                 return self.handle_error(ValueError("Invalid history format or missing user message."), "Bad Request", 400)

            user_message = chat_history[-1]['parts'][0]['text']

            # 2. Prepare Chat
            system_prompt = f"""You are a helpful study assistant. Your goal is to help the user understand their notes.
            Use the provided note context to answer the user's questions.
            Keep your answers concise and clear. Format responses in Markdown.
            After your main answer, on new lines, suggest exactly 3 follow-up questions the user might have, starting with the phrase \"Follow-up questions\".

            --- NOTE CONTEXT ---
            {note_context}
            --- END NOTE CONTEXT ---"""
            
            model_history = chat_history[:-1]
            
            full_prompt = f"{system_prompt}\n\nUSER QUESTION: {user_message}"

            last_error = None
            for api_key in valid_keys:
                try:
                    # 3. Configure API and send request
                    genai.configure(api_key=api_key)
                    model = genai.GenerativeModel('gemini-1.5-pro-latest')
                    
                    chat = model.start_chat(history=model_history)
                    response = chat.send_message(full_prompt)

                    # 4. Post-process for follow-up questions
                    response_text = response.text
                    
                    # Find the follow-up questions section
                    follow_up_match = re.search(r'Follow-up questions:(.*)', response_text, re.IGNORECASE | re.DOTALL)
                    
                    answer = response_text
                    follow_ups = []

                    if follow_up_match:
                        # Extract the main answer by splitting at the follow-up section
                        answer = response_text.split(follow_up_match.group(0))[0].strip()
                        
                        # Extract the questions from the matched group
                        questions_text = follow_up_match.group(1).strip()
                        # Split by newline and filter out empty strings
                        follow_ups = [q.strip() for q in questions_text.split('\n') if q.strip()]
                        # Further clean up by removing potential numbering/bullets
                        follow_ups = [re.sub(r'^[\d\*\-]+\s*', '', q) for q in follow_ups]


                    # 5. Send JSON Response
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json; charset=utf-8')
                    self.end_headers()
                    
                    response_data = {
                        "answer": answer,
                        "followUp": follow_ups[:3] # Return up to 3 follow-up questions
                    }
                    self.wfile.write(json.dumps(response_data, ensure_ascii=False).encode('utf-8'))
                    return # Success, exit the loop and function

                except Exception as e:
                    last_error = e
                    print(f"WARN: API key failed. Trying next key. Error: {e}")
                    continue # Try next key
            
            # If all keys failed
            raise ConnectionError("All API keys failed.") from last_error

        except Exception as e:
            self.handle_error(e)
