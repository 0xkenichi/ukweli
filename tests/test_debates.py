import tempfile
import unittest
from pathlib import Path

from ukweli.debate import find_cases, run_all
from ukweli.knowledge import load, query, teach

# case -> (outcome, agreed amount, agent that concedes)
EXPECTED = {
    "(Case reversed 104)": ("settled", 0, "ledger"),
    "(Case amount-mismatch 107)": ("settled", 1050, "ledger"),
    "(Case duplicate 111)": ("settled", 300, "ledger"),
    "(Case owner-topup QL6S3DR1XW)": ("settled", 0, "mpesa"),
    "(Case unrecorded QKA5Y7GJ4T)": ("settled", 1200, "ledger"),
    "(Case possible-match 115)": ("escalated", None, None),
}


class DebateTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.memory = Path(self.tmp.name) / "learned.metta"
        self.metta = load(memory=self.memory)

    def tearDown(self):
        self.tmp.cleanup()

    def possible_match(self):
        return next(d for d in run_all(load(memory=self.memory)) if d.kind == "possible-match")

    def test_finds_every_disagreement_and_nothing_else(self):
        self.assertEqual(sorted(find_cases(self.metta)), sorted(EXPECTED))

    def test_each_case_reaches_the_expected_result(self):
        for d in run_all(self.metta):
            with self.subTest(case=d.case):
                self.assertEqual((d.outcome, d.agreed, d.conceded_by), EXPECTED[d.case])

    def test_conceding_agent_rewrites_its_belief_in_metta(self):
        run_all(self.metta)
        self.assertEqual(query(self.metta, "(belief-of ledger (Case reversed 104))"), [["kes", 0]])
        revisions = query(self.metta, "(match &beliefs (revision ledger (Case reversed 104) $old $new $why) ($old $new))")
        self.assertEqual(revisions, [[["kes", 500], ["kes", 0]]])

    def test_settled_cases_tell_the_owner_what_to_do(self):
        for d in run_all(self.metta):
            with self.subTest(case=d.case):
                if d.outcome == "settled":
                    self.assertTrue(d.action)
                    self.assertGreater(d.confidence, 0.5)
                else:
                    self.assertIn("0711***902", d.owner_question)

    def test_unrecorded_payment_is_matched_to_open_debt(self):
        d = next(d for d in run_all(self.metta) if d.kind == "unrecorded")
        self.assertIn("D-03", d.action)

    def test_every_case_has_swahili_for_the_owner(self):
        for d in run_all(self.metta):
            with self.subTest(case=d.case):
                self.assertTrue(d.question_sw)
                self.assertTrue(d.action_sw if d.outcome == "settled" else d.owner_question_sw)

    def test_owner_yes_teaches_agents_to_settle_on_their_own(self):
        d = self.possible_match()
        self.assertEqual(d.outcome, "escalated")
        teach(d.ask["customer"], d.ask["phone"], True, memory=self.memory)
        d = self.possible_match()
        self.assertEqual((d.outcome, d.agreed, d.conceded_by), ("settled", 800, "mpesa"))
        self.assertIn("QL4V2NB8HK", d.action)

    def test_owner_no_teaches_agents_the_payment_is_missing(self):
        d = self.possible_match()
        teach(d.ask["customer"], d.ask["phone"], False, memory=self.memory)
        d = self.possible_match()
        self.assertEqual((d.outcome, d.agreed, d.conceded_by), ("settled", 0, "ledger"))
        self.assertIn("UNPAID", d.action)


if __name__ == "__main__":
    unittest.main()
