
import http.server
import socketserver
import json
import os
import ssl
from urllib.parse import urlparse, parse_qs

# --- SSL Certificate Verification Workaround ---
# In some serverless/containerized environments, Python cannot find root CAs.
# This creates an unverified context to bypass SSL certificate verification.
# Note: This is less secure but often necessary for these environments.
try:
    _create_unverified_https_context = ssl._create_unverified_context
except AttributeError:
    # For Python versions that don't have this, do nothing.
    pass
else:
    ssl._create_default_https_context = _create_unverified_https_context

import tempfile
import google.generativeai as genai
from pytube import YouTube

# Gemini API 키 설정
try:
    genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
except Exception as e:
    print(f"Error configuring Gemini API: {e}")

# --- 프롬프트 템플릿 ---
SUMMARY_PROMPT = """
You are a professional summarizer specializing in audio content. 
Listen carefully to the provided audio and create a concise, well-structured summary.
Your summary should capture the main topics, key arguments, and important insights from the audio.

Output the result in Korean, following this JSON format:
'''json
{
  "summary": "오디오 전체 내용을 아우르는 3~4 문단의 핵심 요약문",
  "key_insights": [
    "오디오의 가장 중요한 통찰 또는 시사점 1",
    "오디오의 가장 중요한 통찰 또는 시사점 2",
    "그 외 주목할 만한 핵심 정보나 주장"
  ]
}
'''
"""

TAGGING_PROMPT_TEMPLATE = """
You are an expert at identifying the main theme of a piece of content and categorizing it.
Based on the provided summary, generate a single 'title' and a single 'tag' that best represent the content.
All output text, including the title and tag, must be in Korean.

[Rules]
1. Title: Create a concise title in Korean that captures the core message of the summary.
2. Tag: You must generate a single, very broad, and general Korean word for the tag. (Examples: IT, 경제, 과학, 역사, 자기계발, 건강, 문화, 시사, 예능, 교육)

[Summary]
{summary_text}

[Output Format]
You must return the result in the following JSON format:
'''json
{
  "title": "AI가 생성한 영상 제목",
  "tag": "AI가 생성한 포괄적 주제 태그"
}
'''
"""

def clean_and_parse_json(raw_text):
    """Helper function to clean and parse JSON from Gemini response."""
    cleaned_text = raw_text.replace('```json', '').replace('```', '').strip()
    return json.loads(cleaned_text)

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()

        query_components = parse_qs(urlparse(self.path).query)
        youtube_url = query_components.get("youtubeUrl", [None])[0]

        if not youtube_url:
            self.wfile.write(json.dumps({"error": "youtubeUrl is required."}).encode('utf-8'))
            return

        temp_dir = tempfile.gettempdir()
        audio_path = None
        
        try:
            # 1. Pytube로 오디오 다운로드
            print(f"[AUDIO_DL] Start downloading for: {youtube_url}")

            proxies = {}
            proxy_url_env = os.environ.get("PROXY_URL")
            if proxy_url_env:
                print("[PROXY] Using proxy from PROXY_URL environment variable.")
                proxies = {"http": proxy_url_env, "https": proxy_url_env}

            yt = YouTube(youtube_url, proxies=proxies)
            audio_stream = yt.streams.get_audio_only()
            audio_path = audio_stream.download(output_path=temp_dir)
            print(f"[AUDIO_DL] Success. File path: {audio_path}")

            audio_file = None
            try:
                # 2. Gemini File API에 오디오 파일 업로드
                print(f"[GEMINI_UPLOAD] Start uploading: {audio_path}")
                audio_file = genai.upload_file(path=audio_path, display_name=yt.title)
                print(f"[GEMINI_UPLOAD] Success. File URI: {audio_file.uri}")
            except Exception as e:
                # This is where the 400 Bad Request is likely happening
                print(f"[GEMINI_UPLOAD] Failed. Error: {str(e)}")
                raise Exception(f"Gemini file upload failed. It might be an unsupported audio format. Error: {str(e)}")

            # 3. Gemini로 오디오 요약
            print("[GEMINI_SUMMARY] Start generating summary...")
            model = genai.GenerativeModel(model_name='models/gemini-1.5-flash-latest')
            summary_response = model.generate_content([SUMMARY_PROMPT, audio_file])
            summary_data = clean_and_parse_json(summary_response.text)
            print("[GEMINI_SUMMARY] Success.")
            
            # 4. Gemini로 제목/태그 생성
            print("[GEMINI_TAGGING] Start generating title and tag...")
            tagging_model = genai.GenerativeModel(model_name='models/gemini-1.5-flash-latest')
            tagging_prompt = TAGGING_PROMPT_TEMPLATE.format(summary_text=summary_data['summary'])
            tagging_response = tagging_model.generate_content(tagging_prompt)
            tagging_data = clean_and_parse_json(tagging_response.text)
            print("[GEMINI_TAGGING] Success.")

            # 5. 최종 데이터 조합 및 전송
            final_data = {**summary_data, **tagging_data, "sourceUrl": youtube_url}
            self.wfile.write(json.dumps(final_data).encode('utf-8'))

        except Exception as e:
            error_message = f"An error occurred: {str(e)}"
            print(f"[ERROR] {error_message}")
            self.wfile.write(json.dumps({"error": error_message}).encode('utf-8'))
        
        finally:
            # 임시 오디오 파일 삭제
            if audio_path and os.path.exists(audio_path):
                os.remove(audio_path)
                print(f"Cleaned up temporary file: {audio_path}")

if __name__ == '__main__':
    PORT = 8000
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print("serving at port", PORT)
        httpd.serve_forever()
