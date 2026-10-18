"""Run Ukweli: find where the shop book and the M-Pesa statement disagree, and let the agents debate."""

import argparse
import sys
from datetime import datetime
from pathlib import Path

from ukweli.debate import run_all
from ukweli.knowledge import ROOT, load
from ukweli.report import audit_json, audit_markdown, print_debate, print_summary


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--data", default=ROOT / "data", help="folder with the CSV files")
    p.add_argument("--out", default=ROOT / "audit", help="where to write the audit trail")
    p.add_argument("--no-color", action="store_true")
    args = p.parse_args()

    metta = load(args.data)
    debates = run_all(metta)

    color = sys.stdout.isatty() and not args.no_color
    for n, d in enumerate(debates, 1):
        print_debate(d, n, color)
    print_summary(debates, color)

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    (out / "AUDIT.md").write_text(audit_markdown(debates, stamp), encoding="utf-8")
    (out / "audit.json").write_text(audit_json(debates), encoding="utf-8")
    print(f"\nAudit trail written to {out / 'AUDIT.md'}")


if __name__ == "__main__":
    main()
