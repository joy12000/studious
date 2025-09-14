import http.server
import json
import os
import re
import tempfile
import time
from urllib.parse import urlparse, parse_qs
import requests
import google.generativeai as genai

# --------- CONFIG ---------
GENAI_MODEL = os.getenv("GENAI_MODEL", "models/gemini-1.5-flash-latest")
API_KEY = os.getenv("GEMINI_API_KEY")

# Prefer captions to avoid audio download (Vercel-friendly)
FETCH_MODE = os.getenv("YOUTUBE_FETCH_MODE", "auto")  # "auto" | "transcript" | "audio"

# Comma-separated lists (you can reorder or add more)
INVIDIOUS_BASE_URLS = [u.strip() for u in os.getenv("INVIDIOUS_BASE_URLS", "https://yewtu.be,https://invidious.projectsegfau.lt,https://inv.nadeko.net,https://invidious.nerdvpn.de,https://invidious.f5.si").split(",") if u.strip()]
PIPED_BASE_URLS     = [u.strip() for u in os.getenv("PIPED_BASE_URLS", "https://piped.video,https://piped.projectsegfau.lt,https://pipedapi.kavin.rocks").split(",") if u.strip()]

HTTP_TIMEOUT = int(os.getenv("HTTP_TIMEOUT", "25"))  # per request
MAX_AUDIO_BYTES = int(os.getenv("MAX_AUDIO_BYTES", str(120 * 1024 * 1024)))  # 120MB default

PREFERRED_LANGS = [s.strip() for s in os.getenv("PREFERRED_LANGS", "ko,en,en-US").split(",")]

SUMMARY_PROMPT = '''
You are a professional Korean summarizer. Summarize the content for a busy professional.
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
'''

TAGGING_PROMPT_TEMPLATE = '''
다음 요약문을 보고 한국어 제목과 해시태그를 생성하세요.
- 제목은 30자 이내로 간결하게
- 해시태그는 5~8개, 소문자, 공백 없이, #표시 제외
반드시 아래 JSON만 출력하세요.
{
  "title": "<30자 이내 제목>",
  "tags": ["tag1","tag2","tag3","tag4","tag5"]
}
[요약]
{summary_text}
'''

def parse_first_json_block(text: str):
    """
    Finds the first valid JSON object block in a string by balancing braces.
    """
    text = text or ""
    # Handle markdown code blocks
    if '```json' in text:
        text = text.split('```json')[1].split('```')[0]

    start_index = text.find('{')
    if start_index == -1:
        raise ValueError("모델 출력에서 JSON 시작(`{`)을 찾지 못했습니다.")

    brace_count = 0
    for i in range(start_index, len(text)):
        if text[i] == '{':
            brace_count += 1
        elif text[i] == '}':
            brace_count -= 1
        
        if brace_count == 0:
            end_index = i + 1
            json_str = text[start_index:end_index]
            try:
                return json.loads(json_str)
            except json.JSONDecodeError as e:
                raise ValueError(f"JSON 디코딩 실패: {e}. 내용: {json_str[:100]}...")
    
    raise ValueError("모델 출력에서 완전한 JSON 객체를 찾지 못했습니다.")

def extract_video_id(url: str) -> str:
    u = urlparse(url)
    if u.netloc.endswith("youtu.be"):
        return u.path.strip("/")
    qs = parse_qs(u.query)
    if "v" in qs and qs["v"]:
        return qs["v"][0]
    # Shorts or other forms
    m = re.search(r"/shorts/([A-Za-z0-9_-]{6,})", u.path or "")
    if m: return m.group(1)
    # Fallback: last path segment
    seg = (u.path or "").rstrip("/").split("/")[-1]
    if seg: return seg
    raise ValueError("video_id 추출 실패")

def invidious_transcript(video_id: str):
    # 1) list captions
    last_err = None
    for base in INVIDIOUS_BASE_URLS:
        try:
            r = requests.get(f"{base}/api/v1/captions/{video_id}", timeout=HTTP_TIMEOUT)
            if r.status_code != 200:
                last_err = f"list {base} {r.status_code}"
                continue
            try:
                tracks = r.json()
            except json.JSONDecodeError:
                last_err = f"list {base} returned invalid JSON"
                continue

            # choose preferred language
            chosen = None
            # normalize language codes in data: they have \'language\' and \'languageCode\'
            for pref in PREFERRED_LANGS:
                for t in tracks:
                    if t.get("languageCode") == pref or t.get("language") == pref:
                        chosen = t
                        break
                if chosen: break
            if not chosen and tracks:
                chosen = tracks[0]
            if not chosen:
                last_err = "no captions"
                continue
            lang_code = chosen.get("languageCode") or chosen.get("language") or "en"
            # 2) fetch captions
            r2 = requests.get(f"{base}/api/v1/captions/{video_id}", params={"lang": lang_code, "format": "json3"}, timeout=HTTP_HTTP_TIMEOUT)
            if r2.status_code != 200:
                last_err = f"fetch {base} {r2.status_code}"
                continue
            try:
                data = r2.json()
            except json.JSONDecodeError:
                last_err = f"fetch {base} returned invalid JSON for lang"
                continue
            
            # Convert json3 events to text
            lines = []
            for ev in data.get("events", []):
                seg = ""
                for se in (ev.get("segs", []) or []):
                    seg += se.get("utf8", "")
                seg = seg.replace("\n", " ").strip()
                if seg:
                    lines.append(seg)
            text = " ".join(lines)
            if len(text) < 40:  # too short => treat as missing
                last_err = "captions too short"
                continue
            return text
        except Exception as e:
            last_err = str(e)
            continue
    raise RuntimeError(f"Invidious 캡션 실패: {last_err}")

def piped_best_audio_url(video_id: str):
    last_err = None
    for base in PIPED_BASE_URLS:
        try:
            r = requests.get(f"{base}/api/v1/streams/{video_id}", timeout=HTTP_TIMEOUT)
            if r.status_code != 200:
                last_err = f"streams {base} {r.status_code}"
                continue
            try:
                j = r.json()
            except json.JSONDecodeError:
                last_err = f"streams {base} returned invalid JSON"
                continue
            
            audio = j.get("audioStreams") or []
            # pick highest bitrate m4a/mp4a first
            def score(a):
                br = a.get("bitrate") or 0
                # prefer m4a/mp4a over webm/opus for compatibility
                c = (a.get("codec") or "").lower()
                mime = (a.get("mimeType") or "").lower()
                pref = 1 if ("mp4a" in c or "m4a" in mime) else 0
                return (pref, br)
            if not audio:
                last_err = "no audio streams"
                continue
            best = sorted(audio, key=score, reverse=True)[0]
            return best.get("url")
        except Exception as e:
            last_err = str(e)
            continue
    raise RuntimeError(f"Piped 오디오 URL 실패: {last_err}")

def download_to_temp(url: str, max_bytes=MAX_AUDIO_BYTES) -> str:
    # stream download
    headers = {"User-Agent": "Mozilla/5.0 (compatible; AIBookBeta/1.0)"}
    with requests.get(url, headers=headers, stream=True, timeout=HTTP_TIMEOUT) as r:
        r.raise_for_status()
        suffix = ".m4a"
        tmpf = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        total = 0
        for chunk in r.iter_content(chunk_size=1024*256):
            if not chunk: continue
            tmpf.write(chunk)
            total += len(chunk)
            if total > max_bytes:
                tmpf.close()
                os.unlink(tmpf.name)
                raise ValueError("오디오가 너무 큽니다 (MAX_AUDIO_BYTES 초과).")
        tmpf.close()
        return tmpf.name

def summarize_text(model, text: str):
    resp = model.generate_content([SUMMARY_PROMPT, f"[Transcript]\n{text}"])
    data = parse_first_json_block(resp.text)
    tag_resp = model.generate_content(
        TAGGING_PROMPT_TEMPLATE.format(summary_text=data["summary"])
    )
    tags = parse_first_json_block(tag_resp.text)
    return {**data, **tags}

def summarize_audio(model, audio_path: str):
    # Upload then wait for ACTIVE
    f = genai.upload_file(path=audio_path, display_name=os.path.basename(audio_path))
    start = time.time()
    while True:
        check = genai.get_file(f.name)
        state = getattr(getattr(check, "state", None), "name", "")
        if state == "ACTIVE":
            break
        if time.time() - start > 120:
            raise TimeoutError(f"파일 처리 지연(state={state})")
        time.sleep(1)
    resp = model.generate_content([SUMMARY_PROMPT, check])
    data = parse_first_json_block(resp.text)
    tag_resp = model.generate_content(
        TAGGING_PROMPT_TEMPLATE.format(summary_text=data["summary"])
    )
    tags = parse_first_json_block(tag_resp.text)
    return {**data, **tags}

class Handler(http.server.BaseHTTPRequestHandler):
    def _json(self, code: int, payload: dict):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))

    def do_GET(self):
        if not API_KEY:
            return self._json(500, {"error": "GEMINI_API_KEY 환경변수가 필요합니다."})
        genai.configure(api_key=API_KEY)
        model = genai.GenerativeModel(GENAI_MODEL)

        qs = parse_qs(urlparse(self.path).query)
        url = qs.get("youtubeUrl", [None])[0]
        if not url:
            return self._json(400, {"error": "youtubeUrl is required."})

        mode = qs.get("mode", [FETCH_MODE])[0]  # override via query
        video_id = None
        audio_path = None
        try:
            video_id = extract_video_id(url)
            result = None

            if mode in ("auto", "transcript"):
                try:
                    text = invidious_transcript(video_id)
                    result = summarize_text(model, text)
                    return self._json(200, {**result, "mode": "transcript", "sourceUrl": url})
                except Exception as e:
                    if mode == "transcript":
                        raise
                    # else fall through to audio

            # Audio path (Piped proxy)
            audio_url = piped_best_audio_url(video_id)
            audio_path = download_to_temp(audio_url)
            result = summarize_audio(model, audio_path)
            return self._json(200, {**result, "mode": "audio", "sourceUrl": url})

        except ValueError as e:
            return self._json(400, {"error": str(e)})
        except TimeoutError as e:
            return self._json(504, {"error": str(e)})
        except requests.HTTPError as e:
            return self._json(502, {"error": f"HTTP {e.response.status_code} while fetching media."})
        except Exception as e:
            return self._json(502, {"error": f"Unhandled: {str(e)}"})
        finally:
            if audio_path and os.path.exists(audio_path):
                try: os.remove(audio_path)
                except: pass

if __name__ == "__main__":
    from http.server import HTTPServer
    PORT = int(os.getenv("PORT", "8080"))
    httpd = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Serving on :{PORT}")
    httpd.serve_forever()
