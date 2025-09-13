import http.server
import socketserver
import json
import os
import ssl
from urllib.parse import urlparse, parse_qs
import tempfile
from pytube import YouTube

# --- SSL Certificate Verification Workaround ---
try:
    _create_unverified_https_context = ssl._create_unverified_context
except AttributeError:
    pass
else:
    ssl._create_default_https_context = _create_unverified_https_context

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
            # 1. Pytube로 오디오 다운로드 (이것만 테스트)
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
            
            # 테스트 성공 메시지 전송
            response_data = {"message": "TEST_SUCCESS: Audio downloaded successfully.", "path": audio_path}
            self.wfile.write(json.dumps(response_data).encode('utf-8'))

        except Exception as e:
            error_message = f"An error occurred during pytube download test: {str(e)}"
            print(f"[ERROR] {error_message}")
            self.wfile.write(json.dumps({"error": error_message}).encode('utf-8'))
        
        finally:
            # 임시 오디오 파일 삭제
            if audio_path and os.path.exists(audio_path):
                os.remove(audio_path)
                print(f"Cleaned up temporary file: {audio_path}")
