import json, os
from http.server import BaseHTTPRequestHandler

# ==============================================================================
# DIAGNOSTIC HANDLER
# ==============================================================================

class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status_code, body):
        self.send_response(status_code)
        self.send_header("Content-type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(body, ensure_ascii=False).encode("utf-8"))

    def do_GET(self):
        apify_endpoint = os.getenv("APIFY_ENDPOINT", "NOT_SET")
        apify_token = os.getenv("APIFY_TOKEN", "NOT_SET")

        masked_token = "NOT_SET"
        if apify_token and apify_token != "NOT_SET":
            if len(apify_token) > 8:
                masked_token = f"{apify_token[:4]}...{apify_token[-4:]} (total {len(apify_token)} chars)"
            else:
                masked_token = "Token is too short to mask properly."

        results = {
            "APIFY_ENDPOINT_SEEN_BY_SERVER": apify_endpoint,
            "APIFY_TOKEN_SEEN_BY_SERVER": masked_token,
            "NOTE": "Please compare these values with your Apify dashboard. Check for typos or extra spaces."
        }

        return self._send_json(200, results)