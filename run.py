"""Run Ukweli: find where the shop book and the M-Pesa statement disagree, and let the agents debate."""

import argparse
import sys
from datetime import datetime
from pathlib import Path

from ukweli.debate import run_all
from ukweli.knowledge import ROOT, forget, load, teach
from ukweli.report import audit_json, audit_markdown, print_debate, print_summary


def ask_owner(debates, lang):
    """Ask the owner each escalated question in the terminal and save the answers."""
    taught = False
    for d in debates:
        if d.outcome != "escalated" or not d.ask:
            continue
        q = d.owner_question_sw if lang == "sw" else d.owner_question
        answer = input(f"\n{q} [y/n, Enter to skip] ").strip().lower()
        if answer in ("y", "yes", "n", "no", "ndiyo", "hapana"):
            atom = teach(d.ask["customer"], d.ask["phone"], answer in ("y", "yes", "ndiyo"))
            print(f"Saved to memory: {atom}")
            taught = True
    return taught


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--data", default=ROOT / "data", help="folder with the CSV files")
    p.add_argument("--out", default=ROOT / "audit", help="where to write the audit trail")
    p.add_argument("--lang", choices=["en", "sw"], default="en", help="language for the owner (sw = Swahili)")
    p.add_argument("--ask", action="store_true", help="ask the owner the agents' questions, then debate again")
    p.add_argument("--forget", action="store_true", help="forget everything the owner taught, then run")
    p.add_argument("--no-color", action="store_true")
    args = p.parse_args()

    if args.forget:
        forget()
        print("Forgot everything the owner taught.")

    color = sys.stdout.isatty() and not args.no_color
    debates = run_all(load(args.data))
    for n, d in enumerate(debates, 1):
        print_debate(d, n, color, args.lang)
    print_summary(debates, color)

    if args.ask and ask_owner(debates, args.lang):
        print("\nDebating again with what the owner taught...")
        debates = run_all(load(args.data))
        for n, d in enumerate(debates, 1):
            if d.kind == "possible-match":
                print_debate(d, n, color, args.lang)
        print_summary(debates, color)

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    (out / "AUDIT.md").write_text(audit_markdown(debates, stamp), encoding="utf-8")
    (out / "audit.json").write_text(audit_json(debates), encoding="utf-8")
    print(f"\nAudit trail written to {out / 'AUDIT.md'}")


if __name__ == "__main__":
    main()
