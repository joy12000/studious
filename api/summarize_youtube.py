import json, os, traceback
import requests
from urllib.parse import urlparse, parse_qs
from http.server import BaseHTTPRequestHandler

# ==============================================================================
# CONFIGURATION
# ==============================================================================
APIFY_ENDPOINT = os.getenv("APIFY_ENDPOINT")
APIFY_TOKEN = os.getenv("APIFY_TOKEN")
HTTP_TIMEOUT = 240

# ==============================================================================
# DIAGNOSTIC HANDLER 3.0
# ==============================================================================

class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status_code, body):
        self.send_response(status_code)
        self.send_header("Content-type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(body, ensure_ascii=False).encode("utf-8"))

    def do_GET(self):
        try:
            if not APIFY_ENDPOINT or not APIFY_TOKEN:
                return self._send_json(500, {"error": "Required environment variables (APIFY_ENDPOINT, APIFY_TOKEN) are not set."})

            qs = parse_qs(urlparse(self.path).query)
            url = (qs.get("youtubeUrl") or [None])[0]
            if not url:
                return self._send_json(400, {"error": "youtubeUrl is required."})

            # --- Call Apify and return the raw result ---
            api_url = f"{APIFY_ENDPOINT}?token={APIFY_TOKEN}"
            payload = {"urls": [url]}
            headers = {"Content-Type": "application/json"}

            r = requests.post(api_url, json=payload, headers=headers, timeout=HTTP_TIMEOUT)
            r.raise_for_status()

            # Return the raw JSON response from Apify directly
            raw_data = r.json()
            return self._send_json(200, raw_data)

        except requests.HTTPError as e:
            try: 
                error_details = e.response.json()
            except:
                error_details = e.response.text[:200]
            return self._send_json(e.response.status_code, {"error": f"API call failed: {error_details}"})
        except Exception as e:
            print(f"Unhandled Exception: {e}\n{traceback.format_exc()}")
            return self._send_json(500, {"error": "An internal server error occurred."})