"""Show debates in the terminal and write the audit trail."""

import json
import re
from dataclasses import asdict

from .debate import NAMES

ACT_LABEL = {
    "open": "states its case",
    "present": "brings new evidence",
    "rebut": "rebuts",
    "concede": "concedes",
    "pass": "has nothing to add",
}


def kes(text):
    """Write KES amounts with thousands separators: KES 1500 -> KES 1,500."""
    return re.sub(r"KES (\d{4,})", lambda m: f"KES {int(m.group(1)):,}", str(text))


def money(n):
    return f"KES {n:,}"


def _move_lines(d, m, rules=False):
    who = NAMES[m["agent"]]
    if m["act"] == "open":
        yield f"{who} believes {money(m['claim'])}: \"{kes(m['says'])}\""
    elif m["act"] == "present":
        yield f"{who} brings new evidence: \"{kes(m['says'])}\""
    elif m["act"] == "rebut":
        if m["says"] and m.get("claim") is not None:
            yield f"{who} believes {money(m['claim'])}: \"{kes(m['says'])}\""
        elif m["says"]:
            yield f"{who}: \"{kes(m['says'])}\""
        rule = f" (rule: {m['kind']} beats {m['target']})" if rules else ""
        yield f"{who} rebuts: {m['why']}{rule}"
    elif m["act"] == "concede":
        yield f"{who} concedes and now believes {money(m['claim'])}."
    else:
        yield f"{who} has nothing to add."


# ---------- Terminal ----------

COLOR = {"ledger": "\033[33m", "mpesa": "\033[32m"}
BOLD, DIM, RESET = "\033[1m", "\033[2m", "\033[0m"


def print_debate(d, n, color=True):
    c = (lambda code: code) if color else (lambda code: "")
    print(f"\n{c(BOLD)}Case {n}: {kes(d.question)}{c(RESET)}")
    print(f"{c(DIM)}  Ledger says {money(d.claims['ledger'])}, M-Pesa says {money(d.claims['mpesa'])}{c(RESET)}")
    for m in d.moves:
        for line in _move_lines(d, m):
            print(f"  {c(COLOR[m['agent']])}{m['turn']:>2}. {line}{c(RESET)}")
    if d.outcome == "settled":
        print(f"  {c(BOLD)}Agreed: {money(d.agreed)}  (confidence {d.confidence:.0%}){c(RESET)}")
        print(f"  Owner action: {kes(d.action)}")
        b = d.belief_change
        print(f"{c(DIM)}  Belief changed: {NAMES[b['agent']]} {money(b['old'])} -> {money(b['new'])}{c(RESET)}")
    else:
        print(f"  {c(BOLD)}No agreement. Asking the owner:{c(RESET)} {kes(d.owner_question)}")


def print_summary(debates, color=True):
    settled = [d for d in debates if d.outcome == "settled"]
    asked = [d for d in debates if d.outcome == "escalated"]
    c = (lambda code: code) if color else (lambda code: "")
    print(f"\n{c(BOLD)}Summary:{c(RESET)} {len(debates)} disagreements. "
          f"{len(settled)} settled by the agents, {len(asked)} for the owner to check.")


# ---------- Audit trail ----------

def audit_markdown(debates, generated):
    out = [
        "# Ukweli audit trail",
        "",
        f"Generated {generated}. Every step below comes from a rule in `metta/ukweli.metta`. "
        "The owner can overrule any decision.",
        "",
        "| # | Question | Ledger | M-Pesa | Result | Confidence |",
        "|---|---|---|---|---|---|",
    ]
    for n, d in enumerate(debates, 1):
        result = money(d.agreed) if d.outcome == "settled" else "Ask the owner"
        conf = f"{d.confidence:.0%}" if d.confidence is not None else "-"
        out.append(f"| {n} | {kes(d.question)} | {money(d.claims['ledger'])} | "
                   f"{money(d.claims['mpesa'])} | {result} | {conf} |")
    for n, d in enumerate(debates, 1):
        out += ["", f"## Case {n}: {kes(d.question)}", "", f"Rule match: `{d.case}`", ""]
        for m in d.moves:
            for line in _move_lines(d, m, rules=True):
                out.append(f"- **{m['turn']}.** {line}")
        out.append("")
        if d.outcome == "settled":
            b = d.belief_change
            out += [
                f"**Agreed:** {money(d.agreed)} (confidence {d.confidence:.0%})",
                "",
                f"**What to do:** {kes(d.action)}",
                "",
                f"**Belief change:** {NAMES[b['agent']]} went from {money(b['old'])} to "
                f"{money(b['new'])} because: {b['why']}",
                "",
                "**To overrule:** if you know better, fix the record and run Ukweli again.",
            ]
        else:
            out += [f"**No agreement.** {kes(d.owner_question)}"]
    return "\n".join(out) + "\n"


def audit_json(debates):
    return json.dumps([asdict(d) for d in debates], indent=2, ensure_ascii=False,
                      default=lambda o: None)
