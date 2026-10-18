"""Turn an owner's message (typed, spoken or photographed) into a ledger entry.

Python only splits the text into tokens. metta/reader.metta decides what
the words mean: the language, amount, who paid, how and when.
"""

import re
import unicodedata
from datetime import date, timedelta

from .knowledge import query

CODE = re.compile(r"^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{10}$")
DATE = re.compile(r"^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$")
TIME = re.compile(r"^\d{1,2}:\d{2}$")
MONEY = re.compile(r"^(?:ksh|kes|sh)?\.?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?(?:/=|/-|bob|k)?$", re.I)

LANGUAGES = {"en": "English", "sw": "Kiswahili", "sheng": "Sheng", "ki": "Gĩkũyũ", "luo": "Dholuo"}


def plain(word):
    """Lower-case, strip accents and apostrophes: 'Ĩmwe' -> 'imwe', "ang'wen" -> 'angwen'."""
    word = unicodedata.normalize("NFKD", word)
    word = "".join(ch for ch in word if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9-]", "", word.lower().replace("'", "").replace("’", ""))


def tokenize(text, year):
    """Split a message into (MeTTa token, text shown to the owner) pairs."""
    text = re.sub(r"\bm[\s-]?pesa\b", "mpesa", text, flags=re.I)
    tokens = []
    for raw in text.split():
        raw = raw.strip(".,;:!?()[]\"“”")
        if not raw or "*" in raw or TIME.match(raw):
            continue
        if CODE.match(raw):
            tokens.append((f"(code {raw})", raw))
            continue
        d = DATE.match(raw)
        if d:
            day, month, y = int(d.group(1)), int(d.group(2)), d.group(3)
            y = int(y) + 2000 if y and len(y) == 2 else int(y) if y else year
            try:
                tokens.append((f'(date "{date(y, month, day).isoformat()}")', raw))
            except ValueError:
                pass
            continue
        money = MONEY.match(raw)
        if money and any(ch.isdigit() for ch in raw):
            tokens.append((f"(n {int(money.group(1).replace(',', ''))})", raw))
            continue
        word = plain(raw)
        if word:
            tokens.append((f'(w "{word}")', raw))
    return tokens


def describe(meaning):
    """A short label for what one token meant, for the chips under a message."""
    if not isinstance(meaning, list) or not meaning:
        return None
    kind, *rest = meaning
    if kind == "number":
        return f"= {rest[0]}"
    if kind == "scale":
        return f"× {rest[0]:,}"
    if kind == "digits":
        return f"KES {rest[0]:,}"
    if kind == "paid":
        return "paid"
    if kind == "owes":
        return "owes"
    if kind == "method":
        return "M-Pesa" if rest[0] == "mpesa" else "cash"
    if kind == "when":
        return rest[0]
    if kind == "mpesa-code":
        return "M-Pesa code"
    if kind == "on-date":
        return rest[0]
    if kind == "name-word":
        return "name"
    return None  # filler words aren't shown


def read_message(metta, text, business_day, customers):
    """Read one message. Returns a proposed entry the owner can confirm or fix."""
    tokens = tokenize(text, business_day.year)
    if not tokens:
        return {"text": text, "problems": ["I couldn't find anything to read."], "chips": []}
    atoms = " ".join(t for t, _ in tokens)
    # Put this message's tokens in &msg, replacing the last message's.
    metta.run("!(collapse (match &msg $x (remove-atom &msg $x)))")
    metta.run("\n".join(f"!(add-atom &msg (tok {i} {t}))" for i, (t, _) in enumerate(tokens)))
    reading = query(metta, f"(read-message ({atoms}))")[0]
    _, lang, amount, polarity, method, when, code, who, meanings = reading

    if when == "yesterday":
        day = business_day - timedelta(days=1)
    elif isinstance(when, list):
        day = date.fromisoformat(when[1])
    else:
        day = business_day

    if who[0] == "contact":
        customer = {"id": who[1], "name": customers[who[1]]["name"], "new": False}
    elif who[0] == "new-person":
        name = " ".join(w.capitalize() for w in who[1])
        customer = {"id": None, "name": name, "new": True}
    else:
        customer = None

    chips = []
    for (_, shown), meaning in zip(tokens, meanings):
        label = describe(meaning)
        if label == "name" and customer:
            label = customer["name"] + (" (new)" if customer["new"] else "")
        if label:
            chips.append({"text": shown, "means": label})

    problems = []
    if not amount:
        problems.append("amount")
    if customer is None:
        problems.append("customer")
    if method == "unknown":
        problems.append("method")

    return {
        "text": text,
        "language": lang,
        "language_name": LANGUAGES.get(lang, lang),
        "kind": polarity,
        "amount": amount,
        "method": method,
        "date": day.isoformat(),
        "code": None if code == "nocode" else code,
        "customer": customer,
        "chips": chips,
        "problems": problems,
    }
