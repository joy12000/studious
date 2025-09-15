import json, os, time, re, traceback
import requests
import google.generativeai as genai
from urllib.parse import urlparse, parse_qs
from http.server import BaseHTTPRequestHandler

# ==============================================================================
# CONFIGURATION
# ==============================================================================
GENAI_MODEL = os.getenv("GENAI_MODEL", "models/gemini-1.5-flash-latest")
API_KEY = os.getenv("GEMINI_API_KEY")
APIFY_ENDPOINT = os.getenv("APIFY_ENDPOINT")
APIFY_TOKEN = os.getenv("APIFY_TOKEN")
HTTP_TIMEOUT = 240 # Apify can take a while, give it up to 4 minutes

# ==============================================================================
# PROMPTS
# ==============================================================================
SUMMARY_PROMPT = """당신은 영상 콘텐츠 요약을 전문으로 하는 요약 전문가입니다. 
사용자가 제공한 유튜브 영상의 전사 내용을 꼼꼼히 분석한 뒤, 영상의 핵심 메시지와 중요한 인사이트를 빠짐없이 담아 체계적으로 요약해주세요.

- **요약 스타일:** 전문 요약가로서 객관적이고 정확한 어조로 작성합니다.
- **특히 강조할 점:** 영상에서 강조된 통찰이나 시사점이 있다면 이를 요약에 반드시 포함합니다.

[결과 출력 형식]
아래와 같은 JSON 형식에 맞춰 한국어로 결과를 반환해주세요.
{
  "summary": "영상 전체 내용을 아우르는 3~4 문단의 핵심 요약문",
  "key_insights": [
    "영상이 강조하는 가장 중요한 통찰 또는 시사점 1",
    "영상이 강조하는 가장 중요한 통찰 또는 시사점 2",
    "그 외 주목할 만한 핵심 정보나 주장"
  ]
}
"""

TAGGING_PROMPT_TEMPLATE = """당신은 콘텐츠의 핵심 주제를 파악하여 카테고리를 분류하는 분류 전문가입니다.
제공된 요약문을 기반으로, 영상의 내용을 가장 잘 나타내는 '제목'과 '주제 태그'를 하나씩 생성해주세요.

[규칙]
1. 제목: 요약문의 핵심 내용을 담아 간결하게 생성합니다.
2. 주제 태그: 반드시 아래 예시와 같이 매우 포괄적이고 일반적인 단 하나의 단어로 생성해야 합니다. (예시: IT, 경제, 과학, 역사, 자기계발, 건강, 문화, 시사, 예능, 교육)

[요약문]
{summary_text}

[결과 출력 형식]
결과는 반드시 아래 JSON 형식으로 반환해주세요.
{
  "title": "AI가 생성한 영상 제목",
  "tag": "AI가 생성한 포괄적 주제 태그"
}
"""

# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

def extract_first_json(text: str):
    """Finds and decodes the first valid JSON object block in a string."""
    if not text:
        raise ValueError("Empty response from model.")

    # First, try to find a JSON object within a markdown code block
    match = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        json_str = match.group(1)
    else:
        # If not found, try to find the first and last curly brace
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise ValueError("No JSON object found in the model's response.")
        json_str = match.group(0)

    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        # Add the problematic string to the error for easier debugging
        raise ValueError(f"Failed to decode JSON: {e} - Response text was: '{text}'")

# ==============================================================================
# CORE LOGIC
# ==============================================================================

def get_transcript_from_apify(youtube_url: str) -> str:
    """Calls the Apify Actor to get the transcript."""
    if not APIFY_ENDPOINT or not APIFY_TOKEN:
        raise ValueError("APIFY_ENDPOINT and APIFY_TOKEN must be set.")

    api_url = f"{APIFY_ENDPOINT}?token={APIFY_TOKEN}"
    payload = {"urls": [youtube_url]}
    headers = {"Content-Type": "application/json"}

    r = requests.post(api_url, json=payload, headers=headers, timeout=HTTP_TIMEOUT)
    r.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx)

    results = r.json()
    # Correctly parse the nested data structure
    if not results or not isinstance(results, list) or not results[0].get('data'):
        raise ValueError("Apify returned no transcript data. The video may not have captions.")

    segments = results[0].get('data', [])
    if not segments:
        raise ValueError("Apify returned an empty data list. The video may not have captions.")

    text_parts = []
    for item in segments:
        if isinstance(item, dict):
            text_parts.append(item.get('text', ''))
        elif isinstance(item, str):
            text_parts.append(item)

    full_text = " ".join(text_parts).strip()
    
    if len(full_text) < 50:
        raise ValueError("Transcript from Apify is too short or empty.")

    return full_text

def summarize_text(model, text: str):
    """Summarizes text content using the Gemini API."""
    resp = model.generate_content([SUMMARY_PROMPT, f"[Transcript]\n{text}"])
    summary_data = extract_first_json(resp.text)
    
    tag_resp = model.generate_content(TAGGING_PROMPT_TEMPLATE.format(summary_text=summary_data["summary"]))
    tag_data = extract_first_json(tag_resp.text)
    
    return {**summary_data, **tag_data}

# ==============================================================================
# VERCEL HANDLER CLASS
# ==============================================================================

class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status_code, body):
        self.send_response(status_code)
        self.send_header("Content-type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(body, ensure_ascii=False).encode("utf-8"))

    def do_GET(self):
        try:
            if not API_KEY or not APIFY_ENDPOINT or not APIFY_TOKEN:
                return self._send_json(500, {"error": "Required environment variables (GEMINI, APIFY) are not set."})

            qs = parse_qs(urlparse(self.path).query)
            url = (qs.get("youtubeUrl") or [None])[0]
            if not url:
                return self._send_json(400, {"error": "youtubeUrl is required."})

            genai.configure(api_key=API_KEY)
            model = genai.GenerativeModel(GENAI_MODEL)

            transcript = get_transcript_from_apify(url)
            result = summarize_text(model, transcript)
            
            return self._send_json(200, {**result, "mode": "transcript", "sourceUrl": url})

        except (ValueError, TypeError) as e:
            return self._send_json(400, {"error": str(e)})
        except requests.HTTPError as e:
            try: 
                error_details = e.response.json()
            except:
                error_details = e.response.text[:200]
            return self._send_json(e.response.status_code, {"error": f"API call failed: {error_details}"})
        except Exception as e:
            print(f"Unhandled Exception: {e}\n{traceback.format_exc()}")
            return self._send_json(500, {"error": "An internal server error occurred."})
