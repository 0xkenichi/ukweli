"""The debate protocol between the Ledger agent and the M-Pesa agent.

Each turn an agent does the first of these that applies:
  1. rebut   - use any of its evidence that the MeTTa rules say beats a
               standing piece of the other agent's evidence
  2. present - if none of its own evidence is still standing, bring new evidence
  3. concede - if it has nothing standing and nothing left to bring
  4. pass

The debate ends when an agent concedes (the case is settled) or both pass
in a row (the agents can't agree, so the owner is asked).

What counts as evidence, and what beats what, comes from metta/ukweli.metta.
This file only keeps score.
"""

from dataclasses import dataclass, field

from .knowledge import query, query_atoms

AGENTS = ("ledger", "mpesa")
NAMES = {"ledger": "Ledger agent", "mpesa": "M-Pesa agent"}
MAX_TURNS = 12


@dataclass
class Evidence:
    agent: str
    kind: str
    says: str
    order: int
    played: bool = False
    beaten_by: "Evidence | None" = None
    why_beaten: str = ""

    def standing(self, seen=None):
        """Evidence stands unless whatever beat it is itself still standing."""
        if self.beaten_by is None:
            return True
        seen = (seen or set()) | {id(self)}
        if id(self.beaten_by) in seen:
            return False
        return not self.beaten_by.standing(seen)


@dataclass
class Debate:
    case: str
    kind: str
    question: str
    claims: dict
    evidence: dict
    moves: list = field(default_factory=list)
    outcome: str = ""
    agreed: int | None = None
    conceded_by: str | None = None
    confidence: float | None = None
    action: str = ""
    owner_question: str = ""
    belief_change: dict = field(default_factory=dict)


def _head(value):
    return value[0] if isinstance(value, list) and value else None


def find_cases(metta):
    return [str(a) for a in query_atoms(metta, "(detect)")]


def _setup(metta, case):
    question = query(metta, f"(question {case})")[0]
    claims, evidence = {}, {}
    for agent in AGENTS:
        claims[agent] = query(metta, f"(claim {agent} {case})")[0][1]
        args = [a for a in query(metta, f"(args {agent} {case})") if _head(a) == "Arg"]
        args.sort(key=lambda a: a[1])
        evidence[agent] = [Evidence(agent, kind, says, order) for _, order, kind, says in args]
        metta.run(f"!(believe {agent} {case} (kes {claims[agent]}))")
    kind = case.strip("()").split()[1]
    return Debate(case, kind, question, claims, evidence)


def _rebuttal(metta, attacker, target):
    found = query(metta, f"(rebuttal {attacker} {target})")
    return found[0] if found and isinstance(found[0], str) else None


def _turn(metta, d, agent, turn):
    other = AGENTS[1 - AGENTS.index(agent)]
    mine = d.evidence[agent]

    # 1. Rebut a standing piece of the other agent's evidence.
    for target in [e for e in d.evidence[other] if e.played and e.standing()]:
        for ev in mine:
            if ev.played and not ev.standing():
                continue
            why = _rebuttal(metta, ev.kind, target.kind)
            if why:
                first_use = not ev.played
                first_move = not any(m["agent"] == agent for m in d.moves)
                ev.played = True
                target.beaten_by, target.why_beaten = ev, why
                d.moves.append(dict(turn=turn, agent=agent, act="rebut", kind=ev.kind,
                                    says=ev.says if first_use else "",
                                    claim=d.claims[agent] if first_move else None,
                                    target=target.kind, why=why))
                return "rebut"

    standing = [e for e in mine if e.played and e.standing()]
    unplayed = [e for e in mine if not e.played]

    # 2. Bring new evidence if nothing of ours is standing.
    if not standing and unplayed:
        ev = unplayed[0]
        ev.played = True
        act = "open" if not any(m["agent"] == agent for m in d.moves) else "present"
        d.moves.append(dict(turn=turn, agent=agent, act=act, kind=ev.kind, says=ev.says,
                            claim=d.claims[agent] if act == "open" else None))
        return act

    # 3. Concede: nothing standing, nothing left.
    if not standing:
        winner = d.claims[other]
        why = next((e.why_beaten for e in reversed(mine) if e.why_beaten), "")
        revised = query(metta, f'(revise {agent} {d.case} (kes {winner}) "{why}")')
        old, new = revised[0][1][1], revised[0][2][1]
        d.belief_change = dict(agent=agent, old=old, new=new, why=why)
        d.moves.append(dict(turn=turn, agent=agent, act="concede", claim=winner))
        return "concede"

    # 4. Nothing new to say.
    d.moves.append(dict(turn=turn, agent=agent, act="pass"))
    return "pass"


def run_debate(metta, case):
    d = _setup(metta, case)
    passes = 0
    for turn in range(MAX_TURNS):
        agent = AGENTS[turn % 2]
        act = _turn(metta, d, agent, turn + 1)
        if act == "concede":
            d.outcome = "settled"
            d.conceded_by = agent
            d.agreed = d.claims[AGENTS[1 - AGENTS.index(agent)]]
            settled = [s for s in query(metta, f"(settle {case})") if _head(s) == "Settled"]
            if settled:
                d.confidence, d.action = settled[0][1], settled[0][2]
            return d
        passes = passes + 1 if act == "pass" else 0
        if passes == 2:
            break

    d.outcome = "escalated"
    asked = [e for e in query(metta, f"(escalate {case})") if _head(e) == "Escalate"]
    d.owner_question = asked[0][1] if asked else "The agents couldn't agree. Please check this one by hand."
    return d


def run_all(metta):
    return [run_debate(metta, c) for c in find_cases(metta)]
