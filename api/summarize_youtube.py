import json, os, time, re, traceback
import requests
import google.generativeai as genai
import tempfile
import certifi
from urllib.parse import urlparse, parse_qs
from http.server import BaseHTTPRequestHandler
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import NoTranscriptFound, TranscriptsDisabled, VideoUnavailable

# ==============================================================================
# CONFIGURATION
# ==============================================================================
GENAI_MODEL = os.getenv("GENAI_MODEL", "models/gemini-1.5-flash-latest")
API_KEY = os.getenv("GEMINI_API_KEY")
FETCH_MODE = os.getenv("YOUTUBE_FETCH_MODE", "auto")  # "auto" | "transcript" | "audio"
PIPED_BASE_URLS     = [u.strip() for u in os.getenv("PIPED_BASE_URLS", "https://piped.video,https://piped.kavin.rocks,https://piped.projectsegfau.lt,https://piped.garudalinux.org,https://piped.privacydev.net,https://p.plibre.com").split(",") if u.strip()]
HTTP_TIMEOUT = int(os.getenv("HTTP_TIMEOUT", "90"))
MAX_AUDIO_BYTES = int(os.getenv("MAX_AUDIO_BYTES", str(120 * 1024 * 1024)))
PREFERRED_LANGS = [s.strip() for s in os.getenv("PREFERRED_LANGS", "ko,en,en-US").split(",")]
PROXY_URL = os.getenv("PROXY_URL")

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

def get_proxies():
    """Builds a proxy dictionary for requests if PROXY_URL is set."""
    if not PROXY_URL:
        return None
    return {"http": PROXY_URL, "https": PROXY_URL}

def _get_from_any_host(base_urls, path, params=None):
    """Iterates through a list of base URLs and returns the first successful JSON response."""
    last_err = None
    proxies = get_proxies()
    for base in base_urls:
        try:
            target_url = f"{base}{path}"
            r = requests.get(target_url, params=params, timeout=HTTP_TIMEOUT, proxies=proxies, verify=certifi.where())
            if r.status_code == 200:
                return r.json()
            last_err = f"host {base} returned status {r.status_code}: {r.text[:100]}"
        except Exception as e:
            last_err = str(e)
    raise RuntimeError(f"All hosts failed. Last error: {last_err}")

def extract_first_json(text: str):
    """Finds and decodes the first valid JSON object block in a string."""
    if not text:
        raise ValueError("Empty response from model.")
    
    match = re.search(r"\{{.*\}}", text, re.DOTALL)
    if not match:
        raise ValueError("No JSON object found in the model's response.")
    
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to decode JSON: {e}")

def extract_video_id(url: str) -> str:
    """Extracts YouTube video ID from various URL formats."""
    u = urlparse(url)
    if "youtu.be" in u.netloc:
        return u.path.strip("/")
    qs = parse_qs(u.query)
    if "v" in qs:
        return qs["v"][0]
    m = re.search(r"/shorts/([A-Za-z0-9_-]+)", u.path)
    if m:
        return m.group(1)
    raise ValueError("Failed to extract video_id from URL.")

# ==============================================================================
# CORE LOGIC: FETCHING & SUMMARIZING
# ==============================================================================

def get_transcript_text(video_id: str, proxies: dict = None) -> str:
    """Gets transcript text using youtube-transcript-api, with robust fallbacks and proxy support."""
    try:
        # The library accepts a proxies dict directly.
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id, proxies=proxies)
        
        transcript = None
        for lang in PREFERRED_LANGS:
            try:
                transcript = transcript_list.find_transcript([lang])
                break
            except NoTranscriptFound:
                continue
        
        if not transcript:
            for lang in PREFERRED_LANGS:
                try:
                    transcript = transcript_list.find_generated_transcript([lang])
                    break
                except NoTranscriptFound:
                    continue

        if not transcript:
             raise NoTranscriptFound("No suitable transcript found.")

        segments = transcript.fetch()
        text = " ".join([d['text'] for d in segments])
        if len(text) < 50:
            raise RuntimeError("Transcript text is too short to be meaningful.")
        return text

    except (TranscriptsDisabled, VideoUnavailable) as e:
        raise RuntimeError(f"Cannot fetch transcript: {e}")
    except Exception as e:
        raise RuntimeError(f"youtube-transcript-api failed: {e}")

def get_best_audio_url(video_id: str) -> str:
    """Gets the best audio stream URL from any available Piped instance."""
    streams = _get_from_any_host(PIPED_BASE_URLS, f"/api/v1/streams/{video_id}")
    audio_streams = streams.get("audioStreams", [])
    if not audio_streams:
        raise RuntimeError("No audio streams found.")

    def score(stream):
        is_m4a = "m4a" in stream.get("mimeType", "").lower()
        bitrate = stream.get("bitrate", 0)
        return (is_m4a, bitrate)

    best_stream = sorted(audio_streams, key=score, reverse=True)[0]
    return best_stream["url"]

def summarize_content(model, content, is_audio=False, audio_filename="audio.m4a"):
    """Summarizes text or audio content using the Gemini API."""
    if is_audio:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".m4a") as f:
            f.write(content)
            temp_path = f.name
        try:
            audio_file = genai.upload_file(path=temp_path, display_name=audio_filename)
            prompt_content = audio_file
        finally:
            os.remove(temp_path)
    else:
        prompt_content = f"[Transcript]\n{content}"

    resp = model.generate_content([SUMMARY_PROMPT, prompt_content])
    summary_data = extract_first_json(resp.text)
    
    tag_resp = model.generate_content(TAGGING_PROMPT_TEMPLATE.format(summary_text=summary_data["summary"]))
    tag_data = extract_first_json(tag_resp.text)
    
    return {**summary_data, **tag_data}

def _get_summary_data(youtube_url: str, requested_mode: str):
    """Orchestrates the fetching and summarizing process."""
    genai.configure(api_key=API_KEY)
    model = genai.GenerativeModel(GENAI_MODEL)
    video_id = extract_video_id(youtube_url)
    proxies = get_proxies()
    
    # --- Attempt 1: Transcript ---
    if requested_mode in ("auto", "transcript"):
        try:
            # Pass proxies to the transcript function
            transcript = get_transcript_text(video_id, proxies=proxies)
            result = summarize_content(model, transcript, is_audio=False)
            return {**result, "mode": "transcript", "sourceUrl": youtube_url}
        except Exception as e:
            if requested_mode == "transcript":
                raise RuntimeError(f"Transcript-only mode failed: {e}")
            # In "auto" mode, we fall through to audio
    
    # --- Attempt 2: Audio (Fallback) ---
    audio_url = get_best_audio_url(video_id)
    
    headers = {"User-Agent": "Mozilla/5.0 (compatible; AIBookBeta/1.0)"}
    with requests.get(audio_url, headers=headers, stream=True, timeout=HTTP_TIMEOUT, proxies=proxies, verify=certifi.where()) as r:
        r.raise_for_status()
        audio_bytes = r.content
        if len(audio_bytes) > MAX_AUDIO_BYTES:
            raise ValueError(f"Audio file is too large (> {MAX_AUDIO_BYTES // 1024 // 1024}MB).")

    result = summarize_content(model, audio_bytes, is_audio=True)
    return {**result, "mode": "audio", "sourceUrl": youtube_url}

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
            if not API_KEY:
                return self._send_json(500, {"error": "GEMINI_API_KEY environment variable is not set."})

            qs = parse_qs(urlparse(self.path).query)
            url = (qs.get("youtubeUrl") or [None])[0]
            if not url:
                return self._send_json(400, {"error": "youtubeUrl is required."})

            mode = (qs.get("mode") or [FETCH_MODE])[0]
            
            data = _get_summary_data(url, mode)
            return self._send_json(200, data)

        except (ValueError, TypeError) as e:
            return self._send_json(400, {"error": f"Invalid request: {e}"})
        except TimeoutError as e:
            return self._send_json(504, {"error": f"A timeout occurred: {e}"})
        except requests.HTTPError as e:
            return self._send_json(e.response.status_code, {"error": f"Failed to fetch media: {e}"})
        except Exception as e:
            print(f"Unhandled Exception: {e}\n{traceback.format_exc()}")
            return self._send_json(500, {"error": "An internal server error occurred."})
