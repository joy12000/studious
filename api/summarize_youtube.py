import json, os, time, re, traceback
import requests
import certifi
from urllib.parse import urlparse, parse_qs
from http.server import BaseHTTPRequestHandler

# ==============================================================================
# CONFIGURATION
# ==============================================================================
PROXY_URL = os.getenv("PROXY_URL")
HTTP_TIMEOUT = 25 # Use a shorter timeout for diagnostics

# ==============================================================================
# DIAGNOSTIC HANDLER
# ==============================================================================

def get_proxies():
    """Builds a proxy dictionary for requests if PROXY_URL is set."""
    if not PROXY_URL:
        return None
    return {"http": PROXY_URL, "https": PROXY_URL}

class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status_code, body):
        self.send_response(status_code)
        self.send_header("Content-type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(body, ensure_ascii=False).encode("utf-8"))

    def do_GET(self):
        results = {}
        proxies = get_proxies()

        if not proxies:
            return self._send_json(400, {"error": "PROXY_URL is not set. Please set the environment variable."})

        # Test 1: Bright Data Test URL (geo.brdtest.com)
        # This tests if the proxy credentials and basic connection are okay.
        try:
            r = requests.get(
                "https://geo.brdtest.com/welcome.txt?product=resi&method=native",
                proxies=proxies,
                timeout=HTTP_TIMEOUT,
                verify=certifi.where()
            )
            r.raise_for_status()
            results["test_1_brightdata_test_url"] = f"SUCCESS: {r.text.strip()}"
        except Exception as e:
            results["test_1_brightdata_test_url"] = f"FAILED: {e}"

        # Test 2: Google.com
        # This tests general internet connectivity via the proxy.
        try:
            r = requests.get("https://www.google.com", proxies=proxies, timeout=HTTP_TIMEOUT, verify=certifi.where())
            r.raise_for_status()
            results["test_2_google_com"] = "SUCCESS"
        except Exception as e:
            results["test_2_google_com"] = f"FAILED: {e}"

        # Test 3: YouTube.com
        # This tests connectivity for youtube-transcript-api.
        try:
            r = requests.get("https://www.youtube.com", proxies=proxies, timeout=HTTP_TIMEOUT, verify=certifi.where())
            r.raise_for_status()
            results["test_3_youtube_com"] = "SUCCESS"
        except Exception as e:
            results["test_3_youtube_com"] = f"FAILED: {e}"

        # Test 4: A Piped Server
        # This tests connectivity for the audio fallback path.
        try:
            r = requests.get("https://piped.kavin.rocks/", proxies=proxies, timeout=HTTP_TIMEOUT, verify=certifi.where())
            r.raise_for_status()
            results["test_4_piped_server"] = "SUCCESS"
        except Exception as e:
            results["test_4_piped_server"] = f"FAILED: {e}"

        return self._send_json(200, results)