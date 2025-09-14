import json, os, time, re
from urllib.parse import urlparse, parse_qs
import requests
import google.generativeai as genai

# ---- CONFIG ----
GENAI_MODEL = os.getenv("GENAI_MODEL", "models/gemini-2.0-flash")
API_KEY = os.getenv("GEMINI_API_KEY")

FETCH_MODE = os.getenv("YOUTUBE_FETCH_MODE", "auto")  # auto|transcript|audio
INVIDIOUS_BASE_URLS = [u.strip() for u in os.getenv("INVIDIOUS_BASE_URLS", "https://yewtu.be,https://invidious.projectsegfau.lt,https://vid.puffyan.us").split(",") if u.strip()]
PIPED_BASE_URLS     = [u.strip() for u in os.getenv("PIPED_BASE_URLS", "https://piped.video,https://piped.projectsegfau.lt,https://piped.mha.fi").split(",") if u.strip()]
HTTP_TIMEOUT = int(os.getenv("HTTP_TIMEOUT", "25"))
MAX_AUDIO_BYTES = int(os.getenv("MAX_AUDIO_BYTES", str(120 * 1024 * 1024)))
PREFERRED_LANGS = [s.strip() for s in os.getenv("PREFERRED_LANGS", "ko,en,en-US").split(",")]

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

def extract_first_json(text: str):
    if not text:
        raise ValueError("빈 응답입니다.")
    t = text.replace('```json', '```').replace('```JSON', '```')
    while '```' in t:
        a = t.find('```'); b = t.find('```', a+3)
        if b == -1: break
        t = t[:a] + t[b+3:]
    start_obj = t.find('{'); start_arr = t.find('[')
    starts = [i for i in [start_obj, start_arr] if i != -1]
    if not starts: raise ValueError("JSON 시작 문자({ 또는 [)를 찾지 못했습니다.")
    i = min(starts)
    stack = []; in_str = False; esc = False; quote = ''
    for j in range(i, len(t)):
        c = t[j]
        if in_str:
            if esc: esc = False
            elif c == '\\': esc = True
            elif c == quote: in_str = False
        else:
            if c in ('"', "'"):
                in_str = True; quote = c
            elif c in '{[': stack.append(c)
            elif c in '}]':
                if not stack: break
                top = stack[-1]
                if (top == '{' and c == '}') or (top == '[' and c == ']'):
                    stack.pop()
                    if not stack:
                        candidate = t[i:j+1]
                        candidate = candidate.replace(',}', '}').replace(',]', ']')
                        return json.loads(candidate)
                else:
                    break
    raise ValueError("유효한 JSON 블록을 조립하지 못했습니다.")

def extract_video_id(url: str) -> str:
    u = urlparse(url)
    if (u.netloc or "").endswith("youtu.be"):
        return u.path.strip("/")
    qs = parse_qs(u.query or "")
    if "v" in qs and qs["v"]:
        return qs["v"][0]
    m = re.search(r"/shorts/([A-Za-z0-9_-]{6,})", u.path or "")
    if m: return m.group(1)
    seg = (u.path or "").rstrip("/").split("/")[-1]
    if seg: return seg
    raise ValueError("video_id 추출 실패")

def invidious_transcript(video_id: str):
    last_err = None
    for base in INVIDIOUS_BASE_URLS:
        try:
            r = requests.get(f"{base}/api/v1/captions/{video_id}", timeout=HTTP_TIMEOUT)
            if r.status_code != 200:
                last_err = f"list {base} {r.status_code}"
                continue
            tracks = r.json()
            chosen = None
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
            r2 = requests.get(f"{base}/api/v1/captions/{video_id}", params={"lang": lang_code, "format": "json3"}, timeout=HTTP_TIMEOUT)
            if r2.status_code != 200:
                last_err = f"fetch {base} {r2.status_code}"
                continue
            data = r2.json()
            lines = []
            for ev in data.get("events", []):
                seg = ""
                for se in (ev.get("segs", []) or []):
                    seg += se.get("utf8", "")
                seg = seg.replace("\\n", " ").strip()
                if seg:
                    lines.append(seg)
            text = " ".join(lines)
            if len(text) < 40:
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
            j = r.json()
            audio = j.get("audioStreams") or []
            if not audio:
                last_err = "no audio streams"
                continue
            def score(a):
                br = a.get("bitrate") or 0
                c = (a.get("codec") or "").lower()
                mime = (a.get("mimeType") or "").lower()
                pref = 1 if ("mp4a" in c or "m4a" in mime) else 0
                return (pref, br)
            best = sorted(audio, key=score, reverse=True)[0]
            return best.get("url")
        except Exception as e:
            last_err = str(e)
            continue
    raise RuntimeError(f"Piped 오디오 URL 실패: {last_err}")

def download_to_bytes(url: str, max_bytes=MAX_AUDIO_BYTES) -> bytes:
    headers = {"User-Agent": "Mozilla/5.0 (compatible; AIBookBeta/1.0)"}
    with requests.get(url, headers=headers, stream=True, timeout=HTTP_TIMEOUT) as r:
        r.raise_for_status()
        buf = bytearray()
        for chunk in r.iter_content(262144):  # 256KB
            buf.extend(chunk)
            if len(buf) > max_bytes:
                raise ValueError("오디오가 너무 큽니다 (MAX_AUDIO_BYTES 초과).")
        return bytes(buf)

def summarize_text(model, text: str):
    resp = model.generate_content([SUMMARY_PROMPT, f"[Transcript]\n{text}"])
    data = extract_first_json(resp.text)
    tag_resp = model.generate_content(TAGGING_PROMPT_TEMPLATE.format(summary_text=data["summary"]))
    tags = extract_first_json(tag_resp.text)
    return {**data, **tags}

def summarize_audio_bytes(model, audio_bytes: bytes, filename="audio.m4a"):
    import tempfile, os as _os
    with tempfile.NamedTemporaryFile(delete=False, suffix=".m4a") as f:
        f.write(audio_bytes)
        temp_path = f.name
    try:
        up = genai.upload_file(path=temp_path, display_name=filename)
        start = time.time()
        while True:
            chk = genai.get_file(up.name)
            state = getattr(getattr(chk, "state", None), "name", "")
            if state == "ACTIVE": break
            if time.time() - start > 120:
                raise TimeoutError(f"파일 처리 지연(state={state})")
            time.sleep(1)
            resp = model.generate_content([SUMMARY_PROMPT, chk])
            data = extract_first_json(resp.text)
            tag_resp = model.generate_content(TAGGING_PROMPT_TEMPLATE.format(summary_text=data["summary"]))
            tags = extract_first_json(tag_resp.text)
            return {**data, **tags}
    finally:
        try: _os.remove(temp_path)
        except: pass

def handler(request, response):
    try:
        if not API_KEY:
            return response.status(500).json({"error": "GEMINI_API_KEY 환경변수가 필요합니다."})
        genai.configure(api_key=API_KEY)
        model = genai.GenerativeModel(GENAI_MODEL)

        qs = parse_qs(urlparse(request.url).query)
        url = (qs.get("youtubeUrl") or [None])[0]
        if not url:
            return response.status(400).json({"error": "youtubeUrl is required."})

        mode = (qs.get("mode") or [FETCH_MODE])[0]

        vid = extract_video_id(url)
        if mode in ("auto", "transcript"):
            try:
                text = invidious_transcript(vid)
                data = summarize_text(model, text)
                return response.status(200).json({**data, "mode": "transcript", "sourceUrl": url})
            except Exception as e:
                if mode == "transcript":
                    return response.status(502).json({"error": f"transcript failed: {str(e)}"})
        audio_url = piped_best_audio_url(vid)
        audio_bytes = download_to_bytes(audio_url)
        data = summarize_audio_bytes(model, audio_bytes)
        return response.status(200).json({**data, "mode": "audio", "sourceUrl": url})

    except ValueError as e:
        return response.status(400).json({"error": str(e)})
    except TimeoutError as e:
        return response.status(504).json({"error": str(e)})
    except requests.HTTPError as e:
        code = getattr(getattr(e, "response", None), "status_code", 502)
        return response.status(502).json({"error": f"HTTP {code} while fetching media."})
    except Exception as e:
        import traceback
        return response.status(502).json({"error": f"Unhandled: {str(e)}", "trace": traceback.format_exc()})