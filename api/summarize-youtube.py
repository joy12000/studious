
import os
import json
import re
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

import google.generativeai as genai
from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled

# --- 프롬프트 템플릿 정의 ---
SUMMARY_PROMPT_TEMPLATE = """
당신은 영상 콘텐츠 요약을 전문으로 하는 요약 전문가입니다. 
사용자가 제공한 유튜브 영상의 전사 내용을 꼼꼼히 분석한 뒤, 영상의 핵심 메시지와 중요한 인사이트를 빠짐없이 담아 체계적으로 요약해주세요.

- **요약 스타일:** 전문 요약가로서 객관적이고 정확한 어조로 작성합니다.
- **특히 강조할 점:** 영상에서 강조된 통찰이나 시사점이 있다면 이를 요약에 반드시 포함합니다.

[결과 출력 형식]
아래와 같은 JSON 형식에 맞춰 한국어로 결과를 반환해주세요.
```json
{
  "summary": "영상 전체 내용을 아우르는 3~4 문단의 핵심 요약문",
  "key_insights": [
    "영상이 강조하는 가장 중요한 통찰 또는 시사점 1",
    "영상이 강조하는 가장 중요한 통찰 또는 시사점 2",
    "그 외 주목할 만한 핵심 정보나 주장"
  ]
}
```
"""

TAGGING_PROMPT_TEMPLATE = """
당신은 콘텐츠의 핵심 주제를 파악하여 카테고리를 분류하는 분류 전문가입니다.
제공된 요약문을 기반으로, 영상의 내용을 가장 잘 나타내는 '제목'과 '주제 태그'를 하나씩 생성해주세요.

[규칙]
1. 제목: 요약문의 핵심 내용을 담아 간결하게 생성합니다.
2. 주제 태그: 반드시 아래 예시와 같이 매우 포괄적이고 일반적인 단 하나의 단어로 생성해야 합니다. (예시: IT, 경제, 과학, 역사, 자기계발, 건강, 문화, 시사, 예능, 교육)

[요약문]
{summary_text}

[결과 출력 형식]
결과는 반드시 아래 JSON 형식으로 반환해주세요.
```json
{
  "title": "AI가 생성한 영상 제목",
  "tag": "AI가 생성한 포괄적 주제 태그"
}
```
"""

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            body = json.loads(post_data)

            youtube_url = body.get('youtubeUrl')
            if not youtube_url:
                self._send_response(400, {'error': 'youtubeUrl is required.'})
                return

            # --- 1. 유튜브 스크립트 추출 ---
            video_id = self._get_video_id(youtube_url)
            if not video_id:
                self._send_response(400, {'error': 'Invalid YouTube URL'})
                return

            try:
                transcript_list = YouTubeTranscriptApi.get_transcript(video_id, languages=['ko', 'en'])
                video_transcript = " ".join([item['text'] for item in transcript_list])
            except (NoTranscriptFound, TranscriptsDisabled):
                self._send_response(404, {'error': 'Transcript not found for this video.'})
                return

            if not video_transcript or not video_transcript.strip():
                self._send_response(404, {'error': 'Transcript is empty or unavailable.'})
                return

            # --- 2. Gemini API 호출 ---
            genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
            model = genai.GenerativeModel('gemini-1.5-flash') # gemini-2.0-flash를 gemini-1.5-flash로 변경하여 안정성 확보

            # 2.1. 요약 호출
            summary_prompt = f"{SUMMARY_PROMPT_TEMPLATE}\n\n[영상 스크립트]\n{video_transcript}"
            summary_response = model.generate_content(summary_prompt)
            summary_data = self._clean_and_parse_json(summary_response.text)

            # 2.2. 태깅 호출
            tagging_prompt = TAGGING_PROMPT_TEMPLATE.format(summary_text=summary_data.get('summary', ''))
            tagging_response = model.generate_content(tagging_prompt)
            tagging_data = self._clean_and_parse_json(tagging_response.text)

            # --- 3. 데이터 통합 및 응답 ---
            final_data = {
                **summary_data,
                **tagging_data,
                'sourceUrl': youtube_url,
            }

            self._send_response(200, finalData)

        except Exception as e:
            print(f"API 함수 처리 중 오류: {e}")
            self._send_response(500, {'error': 'Failed to process request.', 'details': str(e)})

    def _send_response(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def _get_video_id(self, url):
        """Extracts the video ID from a YouTube URL."""
        parsed_url = urlparse(url)
        hostname = parsed_url.hostname
        
        if hostname is None:
            return None

        if 'youtube.com' in hostname:
            if parsed_url.path == '/watch':
                qs = parse_qs(parsed_url.query)
                return qs.get('v', [None])[0]
            elif parsed_url.path.startswith('/embed/'):
                return parsed_url.path.split('/embed/')[1]
            elif parsed_url.path.startswith('/v/'):
                return parsed_url.path.split('/v/')[1]
        elif 'youtu.be' in hostname:
            return parsed_url.path[1:]
            
        return None

    def _clean_and_parse_json(self, text):
        # Gemini API 응답에서 ```json ... ``` 코드 블록을 제거하고 파싱
        match = re.search(r"```json\n(.*?)\n```", text, re.DOTALL)
        if match:
            clean_text = match.group(1)
        else:
            clean_text = text.strip()
        return json.loads(clean_text)

