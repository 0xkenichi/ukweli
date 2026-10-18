"""Transcribe photos of the book and voice notes with Google's Gemini.

Gemini only writes down what it sees or hears. It doesn't decide amounts,
names or anything else: metta/reader.metta reads the transcription, so all
the understanding stays in MeTTa.
"""

import base64
import json
import os
import urllib.error
import urllib.request

from .knowledge import ROOT

API = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
LANGS = "English, Kiswahili, Sheng, Gikuyu (Kikuyu) or Dholuo (Luo), or a mix"

PHOTO_PROMPT = f"""This is a photo of a page from a small Kenyan shop's sales book or debt book.
Transcribe every entry exactly as written, one entry per line, keeping names, amounts,
dates, M-Pesa codes and words in their original language ({LANGS}).
Do not translate, correct, total or add anything. Skip headings and totals.
If a word can't be read, write [?].
Return JSON: {{"lines": ["..."]}}"""

VOICE_PROMPT = f"""This is a voice note from a Kenyan shop owner logging a payment or a debt.
It may be in {LANGS}.
Transcribe it exactly as spoken, in the original language. Write amounts the way they
were said, as words. Do not translate, explain or add anything.
Return JSON: {{"transcript": "...", "language": "..."}}"""


class GeminiError(Exception):
    pass


def _env():
    """Read .env (KEY=value lines) without needing an extra package."""
    path = ROOT / ".env"
    values = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                values[k.strip()] = v.strip().strip('"').strip("'")
    return values


def settings():
    env = _env()
    key = os.environ.get("GEMINI_API_KEY") or env.get("GEMINI_API_KEY", "")
    model = os.environ.get("GEMINI_MODEL") or env.get("GEMINI_MODEL") or "gemini-2.5-flash"
    return key, model


def available():
    return bool(settings()[0])


def _ask(prompt, data, mime):
    key, model = settings()
    if not key:
        raise GeminiError("No Gemini key yet. Add GEMINI_API_KEY to the .env file and restart the server.")
    body = {
        "contents": [{"parts": [
            {"text": prompt},
            {"inline_data": {"mime_type": mime, "data": base64.b64encode(data).decode()}},
        ]}],
        "generationConfig": {"response_mime_type": "application/json", "temperature": 0},
    }
    req = urllib.request.Request(
        API.format(model=model),
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as res:
            reply = json.load(res)
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:300]
        raise GeminiError(f"Gemini said {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise GeminiError(f"Couldn't reach Gemini: {e.reason}") from e
    try:
        text = reply["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(text)
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        raise GeminiError("Gemini's answer wasn't in the expected format.") from e


def read_photo(data, mime):
    """Return the lines written on the page."""
    lines = _ask(PHOTO_PROMPT, data, mime).get("lines", [])
    return [str(ln).strip() for ln in lines if str(ln).strip()]


def read_voice(data, mime):
    """Return (transcript, language Gemini heard)."""
    out = _ask(VOICE_PROMPT, data, mime)
    return str(out.get("transcript", "")).strip(), str(out.get("language", "")).strip()
