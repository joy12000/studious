import json, os, time, re, traceback
import requests
import google.generativeai as genai
from urllib.parse import urlparse, parse_qs
from http.server import BaseHTTPRequestHandler

# ==============================================================================
# CONFIGURATION
# ==============================================================================
GENAI_MODEL = os.getenv("GENAI_MODEL", "models/gemini-2.5-pro")
API_KEY = os.getenv("GEMINI_API_KEY_QUATERNARY")
APIFY_ENDPOINT = os.getenv("APIFY_ENDPOINT")
APIFY_TOKEN = os.getenv("APIFY_TOKEN")
HTTP_TIMEOUT = 240 # Apify can take a while, give it up to 4 minutes

# ==============================================================================
# PROMPTS
# ==============================================================================
COMBINED_PROMPT = """당신은 영상 콘텐츠 요약 및 분류 전문가입니다.
사용자가 제공한 유튜브 영상의 전사 내용을 꼼꼼히 분석하여, 아래 규칙과 출력 형식에 따라 완벽한 JSON 객체를 생성해주세요.

[요약 규칙]
- **스타일:** 전문 요약가로서 객관적이고 정확한 어조로 작성합니다.
- **핵심 포함:** 영상에서 강조된 통찰이나 시사점을 요약에 반드시 포함합니다.
- **구조:** `summary` 필드에는 서술형 문단의 요약 내용만 포함하고, 별도의 요점 목록은 추가하지 마세요. 핵심 요점은 `key_insights` 필드에 별도로 제공됩니다.
- **가독성 (마크다운):**
  - 중요한 키워드나 문장은 `**굵은 글씨**`로만 강조하고, 절대로 ` (백틱)을 함께 사용하지 마세요.
  - 내용상 목록화가 필요하면 `- 글머리 기호`를 사용합니다.
  - 문단과 문단 사이는 줄바꿈을 확실히 하여 시각적으로 분리합니다.
  - **중요:** `summary` 필드 내의 마크다운은 JSON 문자열에 포함되므로, 모든 특수 문자(예: `\n`)는 JSON 규칙에 따라 이스케이프 처리(`\\n`)되어야 합니다.

[분류 규칙]
1.  **제목 (`title`):** 요약문의 핵심 내용을 담아 간결하게 생성합니다.
2.  **주제 태그 (`tag`):** 영상의 내용을 가장 잘 나타내는, 매우 포괄적이고 일반적인 단 하나의 단어로 생성합니다. (예시: IT, 경제, 과학, 역사, 자기계발, 건강, 문화, 시사, 예능, 교육)

[결과 출력 형식]
- 반드시 아래와 같은 키를 가진 단일 JSON 객체로만 응답해야 합니다.
- **매우 중요:** `summary` 내용이 길어지더라도, 전체 JSON 구조가 깨지지 않고 완벽하게 끝나도록 작성해야 합니다.

{{
  "title": "AI가 생성한 영상 제목",
  "tag": "AI가 생성한 포괄적 주제 태그",
  "summary": "마크다운 서식이 적용된, 서술형 문단으로 구성된 상세하고 체계적인 핵심 요약문. (요점 목록 제외)",
  "key_insights": [
    "영상이 강조하는 가장 중요한 통찰 또는 시사점 1",
    "영상이 강조하는 가장 중요한 통찰 또는 시사점 2",
    "그 외 주목할 만한 핵심 정보나 주장"
  ]
}}

[Transcript]
{text}
"""

LEARNING_NOTE_PROMPT = """당신은 수강생의 학습 효율을 극대화하는 **AI 학습 전략가이자 콘텐츠 구조화 전문가**입니다.
제공된 영상 스크립트를 분석하여, 단순한 노트 필기를 넘어 **능동적인 학습을 유도하는 입체적인 학습 자료**를 아래 규칙과 출력 형식에 따라 완벽한 JSON 객체로 생성해주세요.

[학습 자료 생성 규칙]
- **목표:** 학습자가 강의 내용을 완벽히 자기 것으로 만들 수 있도록 돕는 것이 최종 목표입니다.
- **논리적 구조:**
  - 강의의 **논리적 흐름(서론-본론-결론, 문제 제기-해결 과정 등)**을 파악하고, 이를 `summary`의 전체적인 목차 구조에 `##`와 `###` 마크다운으로 반영해주세요.
  - 이해를 돕기 위해 언급된 **구체적인 예시나 비유**는 생략하지 말고 포함해야 합니다.
- **핵심 용어 정의:**
  - 강의에 등장하는 **핵심 용어(Key Terms)**는 `key_terms` 필드에 별도로 정리해야 합니다.
  - `summary` 본문에서도 용어가 처음 등장할 때 `**용어:** 설명` 형식으로 한 번 더 명확하게 정의해주세요.
- **가독성:**
  - 가장 중요한 핵심 문장이나 키워드는 `**굵은 글씨**`로 강조하세요.
- **수식 표현:** 모든 수학 수식은 반드시 LaTeX 형식으로 작성하고, 인라인 수식은 `$`로, 블록 수식은 `$$`로 감싸주세요. (예: `$q = mc\Delta T$`, `$$E=mc^2$$`)
- **JSON 이스케이프:** `summary` 필드 내의 모든 특수 문자(예: `\n`)는 JSON 규칙에 따라 이중 백슬래시로 이스케이프 처리(`\\n`)되어야 합니다.

[결과 출력 형식]
- 반드시 아래 JSON 형식과 키(key)에 맞춰 응답해야 합니다.
- 전체 JSON 구조가 깨지지 않도록 완벽하게 마무리되어야 합니다.

{{
  "title": "AI가 생성한 학습 노트 제목",
  "tag": "AI가 생성한 포괄적 주제 태그 (예: IT, 경제, 과학)",
  "summary": "강의의 논리적 흐름과 구조가 마크다운으로 명확하게 표현된 상세 학습 노트 본문. 핵심 용어 정의와 구체적인 예시가 포함되어야 합니다.",
  "key_terms": [
    {{
      "term": "반드시 알아야 할 첫 번째 핵심 용어",
      "definition": "해당 용어에 대한 명확하고 간결한 정의"
    }},
    {{
      "term": "두 번째 핵심 용어",
      "definition": "해당 용어에 대한 상세한 설명"
    }}
  ],
  "review_questions": [
    "학습자가 스스로 이해도를 점검해볼 수 있는 첫 번째 핵심 질문",
    "강의의 핵심 내용을 관통하는 두 번째 질문",
    "배운 내용을 응용해볼 수 있는 세 번째 질문"
  ],
  "further_study": [
    "이 강의와 관련하여 더 깊게 학습하면 좋을 첫 번째 주제",
    "다음 단계로 학습을 이어가기 위한 두 번째 추천 주제"
  ]
}}

[Transcript]
{text}
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
    print(f"--- DEBUGGING ---")
    print(f"APIFY_ENDPOINT from env: {os.getenv('APIFY_ENDPOINT')}")
    print(f"APIFY_TOKEN from env is set: {bool(os.getenv('APIFY_TOKEN'))}")
    
    if not APIFY_ENDPOINT or not APIFY_TOKEN:
        raise ValueError("APIFY_ENDPOINT and APIFY_TOKEN must be set.")

    api_url = f"{APIFY_ENDPOINT}?token={APIFY_TOKEN}"
    payload = {'videoUrl': youtube_url}
    headers = {"Content-Type": "application/json"}

    print(f"Final API URL being called: {APIFY_ENDPOINT}?token=...REDACTED...")
    print(f"Payload being sent: {payload}")
    print(f"--- END DEBUGGING ---")

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

def summarize_text(model, text: str, summary_type: str = 'default'):
    """Summarizes and categorizes text content using the Gemini API."""
    if summary_type == 'lecture':
        prompt = LEARNING_NOTE_PROMPT.format(text=text)
    else:
        prompt = COMBINED_PROMPT.format(text=text)

    resp = model.generate_content(prompt)
    result_data = extract_first_json(resp.text)
    return result_data

# ==============================================================================
# VERCEL HANDLER CLASS
# ==============================================================================

class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status_code, body):
        self.send_response(status_code)
        self.send_header("Content-type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(body, ensure_ascii=False).encode("utf-8"))

    def do_POST(self):
        try:
            if not API_KEY or not APIFY_ENDPOINT or not APIFY_TOKEN:
                return self._send_json(500, {"error": "Required environment variables (GEMINI, APIFY) are not set."})

            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            body = json.loads(post_data)
            url = body.get("youtubeUrl")
            summary_type = body.get("summaryType", "default")

            if not url:
                return self._send_json(400, {"error": "youtubeUrl is required."})

            genai.configure(api_key=API_KEY)
            model = genai.GenerativeModel(GENAI_MODEL)

            transcript = get_transcript_from_apify(url)
            result = summarize_text(model, transcript, summary_type)
            
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

    def do_GET(self):
        self._send_json(405, {"error": "Method Not Allowed. Use POST."})