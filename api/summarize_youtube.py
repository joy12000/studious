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
SUMMARY_PROMPT = """You are a professional Korean summarizer. Summarize the content for a busy professional.
- Write in Korean.
- Keep the most important facts, numbers, and named entities.
- Structure:
  1) 3~5문장 개요
  2) 핵심 포인트 3~5개 (불릿)
  3) 시사점/활용 아이디어 2~3개 (불릿)
Return ONLY valid JSON using this schema:
{
  "summary": "<개요 3~5문장>",
  "key_insights": ["...", "...", "..."],
  "actionable": ["...", "..."]
}
"""

TAGGING_PROMPT_TEMPLATE = """다음 요약문을 보고 한국어 제목과 해시태그를 생성하세요.
- 제목은 30자 이내로 간결하게
- 해시태그는 5~8개, 소문자, 공백 없이, #표시 제외
반드시 아래 JSON만 출력하세요.
{
  "title": "<30자 이내 제목>",
  "tags": ["tag1","tag2","tag3","tag4","tag5"]
}
[요약]
{summary_text}
"""

# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

def extract_first_json(text: str):
    """Finds and decodes the first valid JSON object block in a string."""
    if not text:
        raise ValueError("Empty response from model.")
    
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise ValueError("No JSON object found in the model's response.")
    
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to decode JSON: {e}")

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
    r.raise_for_status()

    results = r.json()
    # Correctly parse the nested data structure
    if not results or not isinstance(results, list) or not results[0].get('data'):
        raise ValueError("Apify returned no transcript data. The video may not have captions.")

    segments = results[0].get('data', [])
    if not segments:
        raise ValueError("Apify returned an empty data list. The video may not have captions.")

    full_text = " ".join([item.get('text', '') for item in segments]).strip()
    
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
