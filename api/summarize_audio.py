import http.server
import json
import os
import ssl
import subprocess
import tempfile
from urllib.parse import urlparse, parse_qs
import google.generativeai as genai

# --- SSL Certificate Verification Workaround ---
try:
    _create_unverified_https_context = ssl._create_unverified_context
except AttributeError:
    pass
else:
    ssl._create_default_https_context = _create_unverified_https_context

# --- Gemini API Configuration ---
try:
    genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
except Exception as e:
    print(f"[ERROR] Failed to configure Gemini API: {e}")

# --- Prompts ---
SUMMARY_PROMPT = """..." # (Content is long, assuming it's correct from previous steps)
TAGGING_PROMPT_TEMPLATE = """..." # (Content is long, assuming it's correct)

def clean_and_parse_json(raw_text):
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
            # 1. yt-dlp로 오디오 다운로드
            print(f"[YTDLP_DL] Start downloading for: {youtube_url}")
            
            # Define a unique output filename
            video_id = parse_qs(urlparse(youtube_url).query).get('v', [os.path.basename(urlparse(youtube_url).path)])[0]
            output_filename = os.path.join(temp_dir, f"{video_id}.%(ext)s")

            command = [
                './bin/yt-dlp',
                '-f', 'bestaudio',
                '-o', output_filename,
                '--no-check-certificate',
                youtube_url
            ]

            proxy_url = os.environ.get("PROXY_URL")
            if proxy_url:
                print(f"[PROXY] Using proxy: {proxy_url}")
                command.extend(['--proxy', proxy_url])

            process = subprocess.run(command, capture_output=True, text=True, timeout=180) # 3-minute timeout

            if process.returncode != 0:
                print(f"[YTDLP_DL] Failed. Stderr: {process.stderr}")
                raise Exception(f"yt-dlp failed: {process.stderr}")
            
            # Find the actual downloaded file path (extension is unknown)
            downloaded_files = [f for f in os.listdir(temp_dir) if f.startswith(video_id)]
            if not downloaded_files:
                raise Exception("Downloaded audio file not found.")
            audio_path = os.path.join(temp_dir, downloaded_files[0])
            print(f"[YTDLP_DL] Success. File path: {audio_path}")

            # 2. Gemini 처리 (이하 동일)
            print(f"[GEMINI_UPLOAD] Start uploading: {audio_path}")
            audio_file = genai.upload_file(path=audio_path, display_name=video_id)
            print(f"[GEMINI_UPLOAD] Success. File URI: {audio_file.uri}")

            print("[GEMINI_SUMMARY] Start generating summary...")
            model = genai.GenerativeModel(model_name='models/gemini-1.5-flash-latest')
            summary_response = model.generate_content([SUMMARY_PROMPT, audio_file])
            summary_data = clean_and_parse_json(summary_response.text)
            print("[GEMINI_SUMMARY] Success.")
            
            print("[GEMINI_TAGGING] Start generating title and tag...")
            tagging_model = genai.GenerativeModel(model_name='models/gemini-1.5-flash-latest')
            tagging_prompt = TAGGING_PROMPT_TEMPLATE.format(summary_text=summary_data['summary'])
            tagging_response = tagging_model.generate_content(tagging_prompt)
            tagging_data = clean_and_parse_json(tagging_response.text)
            print("[GEMINI_TAGGING] Success.")

            final_data = {**summary_data, **tagging_data, "sourceUrl": youtube_url}
            self.wfile.write(json.dumps(final_data).encode('utf-8'))

        except Exception as e:
            error_message = f"An error occurred: {str(e)}"
            print(f"[ERROR] {error_message}")
            self.wfile.write(json.dumps({"error": error_message}).encode('utf-8'))
        
        finally:
            if audio_path and os.path.exists(audio_path):
                os.remove(audio_path)
                print(f"Cleaned up temporary file: {audio_path}")