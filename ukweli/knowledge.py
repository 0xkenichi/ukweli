"""Load the shop's records into MeTTa spaces and convert MeTTa atoms back to Python."""

import csv
from datetime import date
from pathlib import Path

from hyperon import MeTTa, AtomKind

ROOT = Path(__file__).resolve().parent.parent
RULES = ROOT / "metta" / "ukweli.metta"


def _s(value):
    """Quote a value as a MeTTa string."""
    return '"' + str(value).replace('"', "'") + '"'


def _rows(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def ledger_atoms(data_dir):
    atoms = []
    for r in _rows(data_dir / "customers.csv"):
        atoms.append(f"(customer {r['id']} {_s(r['name'])} {_s(r['phone'])} {r['role']})")
    for r in _rows(data_dir / "ledger.csv"):
        code = r["mpesa_code"] or "nocode"
        proof = r["proof"] or "none"
        atoms.append(
            f"(ledger-entry {int(r['id'])} {_s(r['date'])} {r['customer']} "
            f"{int(r['amount'])} {r['method']} {code} {proof})"
        )
    for r in _rows(data_dir / "debts.csv"):
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


MEMORY = ROOT / "memory" / "learned.metta"


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
    """Remove everything the owner taught, to replay the demo from the start."""
    Path(memory).unlink(missing_ok=True)


def load(data_dir=ROOT / "data", memory=MEMORY):
    """Return a MeTTa runner with the rules and both agents' knowledge loaded."""
    data_dir = Path(data_dir)
    metta = MeTTa()
    metta.run(
        "!(bind! &ledger (new-space))\n"
        "!(bind! &mpesa (new-space))\n"
        "!(bind! &beliefs (new-space))"
    )
    metta.run(RULES.read_text(encoding="utf-8"))
    adds = [f"!(add-atom &ledger {a})" for a in ledger_atoms(data_dir) + learned_atoms(memory)]
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
