"""Serve the Ukweli app: python server.py, then open http://localhost:8000"""

import argparse
import base64
import json
from dataclasses import asdict
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from ukweli import gemini
from ukweli.debate import find_cases, run_all
from ukweli.knowledge import ROOT, business_day, customers, forget, learned_atoms, load, save_entry, teach
from ukweli.reader import read_message

WEB = ROOT / "web"
MAX_UPLOAD = 15 * 1024 * 1024


def debates_json():
    debates = [asdict(d) for d in run_all(load())]
    for d in debates:
        del d["evidence"]  # the moves already carry everything the page shows
    return {"debates": debates, "learned": learned_atoms()}


def read_lines(lines):
    metta, day, people = load(), business_day(), customers()
    return [read_message(metta, line, day, people) for line in lines if line.strip()]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB), **kwargs)

    def _send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/debates":
            return self._send_json(debates_json())
        if self.path == "/api/config":
            return self._send_json({
                "gemini": gemini.available(),
                "business_day": business_day().isoformat(),
                "shop": "Mama Wanjiku's Duka",
            })
        return super().do_GET()

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_UPLOAD:
            return self._send_json({"error": "That file is too big. Try a smaller photo or a shorter voice note."}, 413)
        body = json.loads(self.rfile.read(length) or b"{}")
        try:
            return self._route(body)
        except gemini.GeminiError as e:
            return self._send_json({"error": str(e)}, 502)

    def _route(self, body):
        if self.path == "/api/answer":
            teach(body["customer"], body["phone"], bool(body["answer"]))
            return self._send_json(debates_json())
        if self.path == "/api/forget":
            forget()
            return self._send_json(debates_json())
        if self.path == "/api/read":
            return self._send_json({"source": "text", "entries": read_lines([body.get("text", "")])})
        if self.path == "/api/photo":
            lines = gemini.read_photo(base64.b64decode(body["data"]), body.get("mime", "image/jpeg"))
            return self._send_json({"source": "photo", "transcript": lines, "entries": read_lines(lines)})
        if self.path == "/api/voice":
            text, heard = gemini.read_voice(base64.b64decode(body["data"]), body.get("mime", "audio/webm"))
            return self._send_json({"source": "voice", "transcript": [text], "heard": heard, "entries": read_lines([text])})
        if self.path == "/api/save":
            before = set(find_cases(load()))
            saved = save_entry(body["entry"])
            after = set(find_cases(load()))
            payload = debates_json()
            payload.update(saved=saved, settled=sorted(before - after), opened=sorted(after - before))
            return self._send_json(payload)
        return self._send_json({"error": "not found"}, 404)

    def log_message(self, fmt, *args):
        pass


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--port", type=int, default=8000)
    args = p.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Ukweli is running at http://localhost:{args.port}  (Ctrl+C to stop)")
    print("Photos and voice notes: " + ("Gemini key found." if gemini.available() else "add GEMINI_API_KEY to .env to turn them on."))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
