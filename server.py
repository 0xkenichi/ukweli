"""Serve the live debate page: python server.py, then open http://localhost:8000"""

import argparse
import json
from dataclasses import asdict
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from ukweli.debate import run_all
from ukweli.knowledge import ROOT, forget, learned_atoms, load, teach

WEB = ROOT / "web"


def debates_json():
    debates = [asdict(d) for d in run_all(load())]
    for d in debates:
        del d["evidence"]  # the moves already carry everything the page shows
    return {"debates": debates, "learned": learned_atoms()}


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
        return super().do_GET()

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(length) or b"{}")
        if self.path == "/api/answer":
            teach(body["customer"], body["phone"], bool(body["answer"]))
            return self._send_json(debates_json())
        if self.path == "/api/forget":
            forget()
            return self._send_json(debates_json())
        return self._send_json({"error": "not found"}, 404)

    def log_message(self, fmt, *args):
        pass


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--port", type=int, default=8000)
    args = p.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Ukweli is running at http://localhost:{args.port}  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
