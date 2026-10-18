# Ukweli: two agents, one truth

*Ukweli* means "truth" in Swahili.

Small shops in Kenya keep two records of the same money: a sales book written by hand, and the M-Pesa statement from Safaricom. When the two disagree (a reversed payment, a typo, an entry written twice, a payment nobody wrote down), sorting it out by hand takes hours and can end in arguments with customers.

Ukweli gives each record its own agent. When they disagree, the two agents debate using MeTTa rules. They bring evidence, rebut each other and concede when they're beaten, until they agree on one answer. If they can't agree, they ask the owner the one question that would settle it, and **remember the answer**, so next time they settle that case on their own. Every step goes into an audit trail that the owner can read and overrule, in English or Swahili.

**Hackathon:** State of the Art Hackathon 2026 (BASIX.MARKET × SingularityNET × Omega)
**Track:** Track 02 Builders: Omega AI Agents
**Challenge:** 4. Two Agents, One Truth

## Logging money is easy: photo, voice or text, in 5 languages

Owners don't fill in forms. In the Ukweli app they chat:

- **Send a photo** of the book page. Gemini transcribes the handwriting.
- **Send a voice note.** Gemini transcribes it; without a key, the browser's own speech-to-text is used.
- **Type,** or **forward the M-Pesa SMS** straight from their phone.
- **In English, Kiswahili, Sheng, Gĩkũyũ or Dholuo.** For example "Mama Faith amelipa mia nane kwa M-Pesa jana", "Kevin niarihire magana mana", "Akinyi ochulo mia abich".

**Gemini only writes down what it sees or hears. MeTTa does all the understanding.** [`metta/reader.metta`](metta/reader.metta) holds the word lists for all 5 languages and the rules that work out:

- the language;
- the amount: *mia nane* is hundred × eight, while English *eight hundred* puts the number first;
- paid or owes, M-Pesa or cash, and which day;
- which customer, matched against the contact list.

The app shows the owner how every word was read (for example `mia → ×100`, `nane → 8`, `amelipa → paid`). The owner confirms, and the agents immediately check the new entry against the M-Pesa statement. That either **settles** an open issue (forwarding Brian's SMS settles the "payment missing from the book" case) or **opens a new one** for the agents to debate (Kevin's KES 1,500 never reached the till).

This is neural-symbolic AI in practice: neural models for perception, symbolic MeTTa rules for every judgement, so every decision can be explained and overruled.

## What it does

```text
Case 1: How much did John Kamau really pay on 2026-10-14 (book entry L-104)?
  Ledger says KES 500, M-Pesa says KES 0
   1. Ledger agent believes KES 500: "My book entry L-104 says John Kamau paid KES 500 by M-Pesa ..."
   2. M-Pesa agent believes KES 0: "My statement shows QJK4T7XA2P brought in KES 500 at 10:14, but QJR9W2LB6E reversed it at 16:42."
   2. M-Pesa agent rebuts: Safaricom reversed this payment after it was sent, so the money never stayed in the till.
   3. Ledger agent brings new evidence: "And the customer showed me the confirmation SMS for QJK4T7XA2P."
   4. M-Pesa agent rebuts: The SMS was real, but it was sent before the reversal.
   5. Ledger agent concedes and now believes KES 0.
  Agreed: KES 0  (confidence 95%)
  Owner action: Mark L-104 as UNPAID. Ask John Kamau to pay KES 500 again: the payment was reversed.
```

With the sample data, the agents find 6 disagreements, settle 5 of them, and pass 1 to the owner:

| Situation | Who concedes | Result |
|---|---|---|
| Payment reversed after the customer showed the SMS | Ledger | Mark unpaid, ask the customer again |
| 1,500 written, 1,050 received | Ledger | Correct the book. The gap divides by 9, so the digits were probably swapped |
| Same M-Pesa code written twice | Ledger | Delete the duplicate |
| Owner's own top-up counted as money in | M-Pesa | Not a sale, record it as a float top-up |
| Payment missing from the book | Ledger | Add it and close the customer's open debt |
| Book says paid, no code, unknown number paid the same amount | Nobody | Ask the owner. Once the owner answers, the agents learn it and settle the case themselves |

The full trail is written to [`audit/AUDIT.md`](audit/AUDIT.md) and `audit/audit.json`.

## How it works

```text
data/*.csv ──► MeTTa spaces ──► (detect) finds disagreements
                &ledger           │
                &mpesa            ▼
                         debate loop (Python keeps turns)
                         ├─ (claim agent case)     what each agent believes
                         ├─ (args agent case)      evidence each can bring
                         ├─ (defeats a b why)      which evidence beats which
                         ├─ (revise ...)           loser rewrites its belief in &beliefs
                         └─ (settle case) / (escalate case) ──► owner answers
                                  │                                      │
                                  ▼                                      ▼
                  web page / terminal + audit/AUDIT.md     memory/learned.metta (loaded next run)
```

- **Two agents with separate knowledge.** The Ledger agent only sees `&ledger` (sales book, credit book, contacts). The M-Pesa agent only sees `&mpesa` (the statement).
- **All reasoning is in MeTTa.** The rules in [`metta/ukweli.metta`](metta/ukweli.metta) decide what counts as a disagreement, what each agent claims, what evidence it has, which evidence beats which and why, and what the owner should do. Python ([`ukweli/debate.py`](ukweli/debate.py)) only takes turns and keeps score.
- **The debate protocol.** On each turn an agent rebuts if it can. If none of its evidence is still standing, it brings new evidence. If it has nothing left, it concedes. If both agents pass, the case goes to the owner. Evidence that was beaten comes back into play if whatever beat it gets beaten in turn.
- **Visible belief change.** When an agent concedes, it rewrites its belief in the `&beliefs` space and keeps a `(revision agent case old new why)` atom, so every change of mind can be traced.
- **Learning from the owner.** The owner's answer to an escalated question is saved as a MeTTa fact, for example `(learned-phone faith "0711***902" yes "2026-10-18")`, in `memory/learned.metta`. It's loaded into `&ledger` on every run and becomes new evidence (`owner-confirmed` or `owner-denied`) in the next debate.
- **Swahili for the owner.** Case questions, owner actions and owner questions come from MeTTa rules in both English and Swahili.

## Setup

Needs Python 3.10 or newer (tested with 3.11).

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

**The app** (best for the demo):

```bash
python server.py
```

Then open http://localhost:8000. On the left is the **owner's phone app**: a chat for logging money, plus an **Issues** tab. On the right is the **agents' brain**. On a phone, the app fills the screen and **Watch the agents** switches to the brain.

To turn on photos and voice notes, get a free key at https://aistudio.google.com/apikey and create a `.env` file (see `.env.example`):

```bash
echo "GEMINI_API_KEY=your-key-here" > .env
```

The agents' brain is a 3D stage, **Mizani ya Ukweli** (the scale of truth):

- The Ledger agent is a floating book and the M-Pesa agent is a floating phone. Each shows its current belief.
- Every piece of evidence flies onto its agent's pan as a tablet. The scale tilts toward the side with more evidence still standing.
- A rebuttal fires a beam that shatters the other side's tablet. If that rebuttal is beaten in turn, the tablet re-forms.
- When an agent concedes, its belief counts to the new value, the scale settles and a gold shockwave goes out. If the agents can't agree, the scale keeps wobbling and the owner's lantern comes down with one question.

Pick a case at the top, press **Play debate**, and switch between EN and SW. On case 06, answer the owner's question and watch the agents debate again with what they learned. **Log** shows every step; **Reset owner's answers** resets the demo. The 3D libraries (three.js, GSAP) load from a CDN, so the page needs internet. Without WebGL the page still works without the 3D stage.

**Terminal:**

```bash
python run.py
```

| Option | What it does |
|---|---|
| `--lang sw` | Questions and owner actions in Swahili |
| `--ask` | Ask the owner the agents' questions, save the answers, then debate again |
| `--forget` | Forget everything the owner taught |
| `--data <folder>` | Use other CSV files |
| `--out <folder>` | Where to write the audit trail |
| `--no-color` | Plain output |

## Test

```bash
python -m unittest discover -s tests -t .
```

## Data

All data in `data/` is made up. See [`data/README.md`](data/README.md).

## What's next

- [x] Web page that shows the debate live, for the demo video
- [x] Questions and owner actions in Swahili (needs a check by a native speaker)
- [x] Learning from the owner: answers are saved as MeTTa facts and used in later debates
- [x] Logging by photo, voice note, text or forwarded M-Pesa SMS, in English, Kiswahili, Sheng, Gĩkũyũ and Dholuo
- [ ] Check the word lists with native speakers, especially Sheng, Gĩkũyũ and Dholuo
- [ ] The agents' own lines in Swahili too
- [ ] Run the agents on Omega's agent infrastructure (waiting on the Omega resources on BASIX.MARKET)
- [ ] Import real M-Pesa statement exports (PDF/CSV)

## Demo script (3 minutes)

1. **The problem (20 s).** A duka owner has a sales book and an M-Pesa statement that don't agree.
2. **Logging is a chat (40 s).** Forward Brian's M-Pesa SMS: the chips show how each word was read, and saving it settles an open issue. Send "Kevin amelipa elfu moja mia tano kwa M-Pesa": a new issue opens. Tap **Watch the agents debate**.
3. **Case 1 (30 s).** Play it. The customer showed an SMS, but the M-Pesa agent shows the reversal. The Ledger agent concedes, and its belief changes from KES 500 to KES 0.
4. **Case 4 (15 s).** This time the M-Pesa agent concedes: the money came from the owner's own phone.
5. **Case 6 (35 s).** The agents can't agree and ask the owner one question. Click **Yes**. They debate again, and this time settle it on their own.
6. **Kiswahili (10 s).** Switch the language. The owner's instructions are in Swahili.
7. **Under the hood (20 s).** Show `metta/reader.metta` (the 5-language word lists), the `defeats` rules in `metta/ukweli.metta`, and `audit/AUDIT.md`.
8. **What's next (10 s).** Real M-Pesa statement imports, and running on Omega.

## Team

| Name | Role |
|---|---|
| kenichi | Team lead |
| _to add_ | |
| _to add_ | |

## AI disclosure

See [`AI_DISCLOSURE.md`](AI_DISCLOSURE.md).

## Hackathon files

`BRIEF.md`, `SUBMISSION.md`, `AGENTS.md`, `CLAUDE.md` and `tracks/` come from the [BASIX hackathon starter](https://github.com/BASIXmarket-io/hackathon-starter).
