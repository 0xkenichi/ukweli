"""Load the shop's records into MeTTa spaces and convert MeTTa atoms back to Python."""

import csv
from datetime import date
from pathlib import Path

from hyperon import MeTTa, AtomKind

ROOT = Path(__file__).resolve().parent.parent
RULES = [ROOT / "metta" / "ukweli.metta", ROOT / "metta" / "reader.metta"]
MEMORY = ROOT / "memory" / "learned.metta"


def _s(value):
    """Quote a value as a MeTTa string."""
    return '"' + str(value).replace('"', "'") + '"'


def _rows(path):
    if not Path(path).exists():
        return []
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


# The owner's own entries, logged through the chat, live next to the
# learned facts and are added to the sample data on every load.
OWNER_FILES = {
    "customers.csv": ["id", "name", "phone", "role"],
    "ledger.csv": ["id", "date", "customer", "amount", "method", "mpesa_code", "proof"],
    "debts.csv": ["id", "date", "customer", "amount"],
}


def _all_rows(data_dir, memory, name):
    return _rows(Path(data_dir) / name) + _rows(Path(memory).parent / f"owner_{name}")


def customers(data_dir=ROOT / "data", memory=MEMORY):
    return {r["id"]: r for r in _all_rows(data_dir, memory, "customers.csv")}


def business_day(data_dir=ROOT / "data"):
    """The day being closed: the last day on the M-Pesa statement."""
    days = [r["date"] for r in _rows(Path(data_dir) / "mpesa_statement.csv")]
    return date.fromisoformat(max(days)) if days else date.today()


def _name_parts(name):
    from .reader import plain
    return {plain(w) for w in name.split()} - {"", "owner"}


def ledger_atoms(data_dir, memory=MEMORY):
    atoms = []
    for r in _all_rows(data_dir, memory, "customers.csv"):
        atoms.append(f"(customer {r['id']} {_s(r['name'])} {_s(r['phone'])} {r['role']})")
        atoms += [f"(name-part {r['id']} {_s(w)})" for w in _name_parts(r["name"])]
    for r in _all_rows(data_dir, memory, "ledger.csv"):
        code = r["mpesa_code"] or "nocode"
        proof = r["proof"] or "none"
        atoms.append(
            f"(ledger-entry {int(r['id'])} {_s(r['date'])} {r['customer']} "
            f"{int(r['amount'])} {r['method']} {code} {proof})"
        )
    for r in _all_rows(data_dir, memory, "debts.csv"):
        atoms.append(f"(debt {r['id']} {_s(r['date'])} {r['customer']} {int(r['amount'])})")
    return atoms


def mpesa_atoms(data_dir):
    atoms = []
    for r in _rows(data_dir / "mpesa_statement.csv"):
        head = (
            f"{r['code']} {_s(r['date'])} {_s(r['time'])} {_s(r['name'])} "
            f"{_s(r['phone'])} {int(r['amount'])}"
        )
        if r["type"] == "reversal":
            atoms.append(f"(mpesa-reversal {head} {r['reverses']})")
        else:
            atoms.append(f"(mpesa-received {head})")
    return atoms


def learned_atoms(memory=MEMORY):
    """Facts the owner has taught the agents, one atom per line."""
    if not Path(memory).exists():
        return []
    lines = Path(memory).read_text(encoding="utf-8").splitlines()
    return [ln.strip() for ln in lines if ln.strip() and not ln.strip().startswith(";")]


def teach(customer, phone, answer, memory=MEMORY):
    """Save the owner's answer to an escalated question so the agents remember it."""
    memory = Path(memory)
    memory.parent.mkdir(parents=True, exist_ok=True)
    if not memory.exists():
        memory.write_text("; What the owner has taught Ukweli. Loaded into &ledger on every run.\n",
                          encoding="utf-8")
    atom = f"(learned-phone {customer} {_s(phone)} {'yes' if answer else 'no'} {_s(date.today())})"
    with open(memory, "a", encoding="utf-8") as f:
        f.write(atom + "\n")
    return atom


def forget(memory=MEMORY):
    """Remove everything the owner taught or logged, to replay the demo from the start."""
    Path(memory).unlink(missing_ok=True)
    for name in OWNER_FILES:
        (Path(memory).parent / f"owner_{name}").unlink(missing_ok=True)


def _append(memory, name, row):
    path = Path(memory).parent / f"owner_{name}"
    path.parent.mkdir(parents=True, exist_ok=True)
    new = not path.exists()
    with open(path, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=OWNER_FILES[name])
        if new:
            w.writeheader()
        w.writerow(row)


def save_entry(entry, data_dir=ROOT / "data", memory=MEMORY):
    """Save an entry the owner confirmed in the chat. Returns its book id."""
    who = entry["customer"]
    cid = who.get("id")
    if not cid:
        from .reader import plain
        cid = plain(who["name"].replace(" ", "-")) or "customer"
        known = customers(data_dir, memory)
        base, n = cid, 2
        while cid in known:
            cid, n = f"{base}-{n}", n + 1
        _append(memory, "customers.csv", {"id": cid, "name": who["name"], "phone": "unknown", "role": "customer"})
    if entry["kind"] == "owes":
        ids = [r["id"] for r in _all_rows(data_dir, memory, "debts.csv")]
        did = f"D-{len(ids) + 1:02d}"
        _append(memory, "debts.csv", {"id": did, "date": entry["date"], "customer": cid, "amount": int(entry["amount"])})
        return did
    ids = [int(r["id"]) for r in _all_rows(data_dir, memory, "ledger.csv")]
    lid = max([200] + [i + 1 for i in ids if i >= 200])
    _append(memory, "ledger.csv", {
        "id": lid, "date": entry["date"], "customer": cid, "amount": int(entry["amount"]),
        "method": entry["method"] if entry["method"] in ("mpesa", "cash") else "cash",
        "mpesa_code": entry.get("code") or "", "proof": "",
    })
    return f"L-{lid}"


def load(data_dir=ROOT / "data", memory=MEMORY):
    """Return a MeTTa runner with the rules and both agents' knowledge loaded."""
    data_dir = Path(data_dir)
    metta = MeTTa()
    metta.run(
        "!(bind! &ledger (new-space))\n"
        "!(bind! &mpesa (new-space))\n"
        "!(bind! &beliefs (new-space))\n"
        "!(bind! &msg (new-space))"
    )
    for rules in RULES:
        metta.run(rules.read_text(encoding="utf-8"))
    adds = [f"!(add-atom &ledger {a})" for a in ledger_atoms(data_dir, memory) + learned_atoms(memory)]
    adds += [f"!(add-atom &mpesa {a})" for a in mpesa_atoms(data_dir)]
    metta.run("\n".join(adds))
    return metta


def to_py(atom):
    """Convert a MeTTa atom to plain Python: lists, numbers, strings."""
    kind = atom.get_metatype()
    if kind == AtomKind.EXPR:
        return [to_py(a) for a in atom.get_children()]
    if kind == AtomKind.GROUNDED:
        return atom.get_object().value
    return str(atom)


def query(metta, expr):
    """Run one MeTTa expression and return all its results as Python values."""
    return [to_py(a) for a in metta.run(f"!{expr}")[0]]


def query_atoms(metta, expr):
    return metta.run(f"!{expr}")[0]
