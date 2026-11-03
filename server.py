#!/usr/bin/env python3
"""FaceTwin local server: serves the app and does realistic previews with an AI image editor.

Run (in the FaceTwin_MVP folder):
    python3 server.py                     # app only; previews say "add a key"
    GEMINI_API_KEY=your_key python3 server.py
or put the key in a file named  gemini_key.txt  next to this file (one line, nothing else).
Then open http://localhost:8080

Your key stays on your computer: the web page never sees it.
MOCK=1 python3 server.py  returns a tinted copy of the photo instead of calling the AI (for testing).
"""
import base64, json, os, sys, urllib.request, urllib.error
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

HERE = Path(__file__).resolve().parent
PORT = int(os.environ.get("PORT", "8080"))
MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")
MOCK = os.environ.get("MOCK") == "1"
MAX_BYTES = 6 * 1024 * 1024


def api_key():
    k = os.environ.get("GEMINI_API_KEY", "").strip()
    f = HERE / "gemini_key.txt"
    if not k and f.exists():
        k = f.read_text().strip()
    return k


def gemini_edit(img_b64, mime, prompt):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
    body = {
        "contents": [{"role": "user", "parts": [
            {"inline_data": {"mime_type": mime, "data": img_b64}},
            {"text": prompt},
        ]}],
        "generationConfig": {"responseModalities": ["IMAGE", "TEXT"]},
    }
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "x-goog-api-key": api_key()})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:600]
        raise RuntimeError(f"AI service error {e.code}: {detail}")
    for cand in data.get("candidates", []):
        for part in (cand.get("content") or {}).get("parts", []):
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                return inline["data"], inline.get("mimeType") or inline.get("mime_type") or "image/png"
    reason = (data.get("promptFeedback") or {}).get("blockReason") or \
        ((data.get("candidates") or [{}])[0].get("finishReason")) or "no image returned"
    raise RuntimeError(f"The AI didn't return an image ({reason}). Try another photo or change.")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(HERE), **kw)

    def log_message(self, fmt, *args):
        if "/api/" in (args[0] if args else ""):
            sys.stderr.write("[facetwin] " + (fmt % args) + "\n")

    def _json(self, code, obj):
        raw = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path.startswith("/api/status"):
            return self._json(200, {"ai": bool(api_key()) or MOCK, "mock": MOCK, "model": MODEL})
        if self.path.split("?")[0].endswith(("gemini_key.txt", "server.py")):
            return self._json(404, {"error": "not found"})
        return super().do_GET()

    def do_POST(self):
        if not self.path.startswith("/api/edit"):
            return self._json(404, {"error": "not found"})
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0 or n > MAX_BYTES:
            return self._json(413, {"error": "Photo too large"})
        try:
            req = json.loads(self.rfile.read(n))
            img, mime, prompt = req["image"], req.get("mime", "image/jpeg"), req["prompt"]
            base64.b64decode(img[:64] + "==", validate=False)
        except Exception:
            return self._json(400, {"error": "Bad request"})
        if MOCK:
            return self._json(200, {"image": img, "mime": mime, "mock": True})
        if not api_key():
            return self._json(503, {"error": "No AI key yet. Add your Gemini key (see README) to turn on realistic previews."})
        try:
            out, out_mime = gemini_edit(img, mime, prompt)
            return self._json(200, {"image": out, "mime": out_mime})
        except Exception as e:
            return self._json(502, {"error": str(e)})


if __name__ == "__main__":
    status = "MOCK mode" if MOCK else ("AI key found" if api_key() else "no AI key (previews off)")
    print(f"FaceTwin running at http://localhost:{PORT}  ·  {status}  ·  model {MODEL}")
    print("Leave this window open. Press Ctrl + C to stop.")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
