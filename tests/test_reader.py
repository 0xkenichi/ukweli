import tempfile
import unittest
from pathlib import Path

from ukweli.debate import find_cases, run_all
from ukweli.knowledge import business_day, customers, load, save_entry
from ukweli.reader import read_message


class ReaderTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.memory = Path(self.tmp.name) / "learned.metta"
        self.metta = load(memory=self.memory)
        self.day = business_day()

    def tearDown(self):
        self.tmp.cleanup()

    def read(self, text):
        return read_message(self.metta, text, self.day, customers(memory=self.memory))

    def test_reads_all_five_languages(self):
        cases = {
            "Mama Faith amelipa mia nane kwa M-Pesa jana": ("sw", 800, "faith", "mpesa", "2026-10-15"),
            "Brian Mwangi paid one thousand two hundred cash": ("en", 1200, "brian", "cash", "2026-10-16"),
            "Peter ametuma thao mbili": ("sheng", 2000, "peter", "unknown", "2026-10-16"),
            "Kevin niarihire magana mana mpesa": ("ki", 400, "kevin", "mpesa", "2026-10-16"),
            "Akinyi ochulo mia aboro": ("luo", 800, "akinyi", "unknown", "2026-10-16"),
        }
        for text, (lang, amount, who, method, day) in cases.items():
            with self.subTest(text=text):
                r = self.read(text)
                self.assertEqual((r["language"], r["amount"], r["customer"]["id"], r["method"], r["date"]),
                                 (lang, amount, who, method, day))

    def test_reads_a_forwarded_mpesa_sms(self):
        r = self.read("QKA5Y7GJ4T Confirmed. Ksh1,200.00 received from BRIAN MWANGI 0722***415 "
                      "on 15/10/26 at 6:05 PM New M-PESA balance is Ksh5,000.00")
        self.assertEqual((r["code"], r["amount"], r["customer"]["id"], r["date"], r["method"]),
                         ("QKA5Y7GJ4T", 1200, "brian", "2026-10-15", "mpesa"))

    def test_debts_and_new_people(self):
        r = self.read("Grace anadaiwa elfu moja mia mbili hamsini")
        self.assertEqual((r["kind"], r["amount"], r["customer"]["name"], r["customer"]["new"]),
                         ("owes", 1250, "Grace", True))

    def test_shows_how_each_word_was_read(self):
        chips = {c["text"]: c["means"] for c in self.read("Mama Faith amelipa mia nane")["chips"]}
        self.assertEqual(chips["mia"], "× 100")
        self.assertEqual(chips["nane"], "= 8")
        self.assertEqual(chips["amelipa"], "paid")

    def test_logging_the_missing_payment_settles_it(self):
        self.assertIn("(Case unrecorded QKA5Y7GJ4T)", find_cases(self.metta))
        entry = self.read("QKA5Y7GJ4T Confirmed. Ksh1,200.00 received from BRIAN MWANGI on 15/10/26")
        save_entry(entry, memory=self.memory)
        self.assertNotIn("(Case unrecorded QKA5Y7GJ4T)", find_cases(load(memory=self.memory)))

    def test_uncoded_payment_from_customers_own_phone_just_matches(self):
        entry = self.read("Brian Mwangi amelipa elfu moja mia mbili kwa M-Pesa jana")
        save_entry(entry, memory=self.memory)
        cases = find_cases(load(memory=self.memory))
        self.assertNotIn("(Case unrecorded QKA5Y7GJ4T)", cases)
        self.assertEqual(len(cases), 5)

    def test_payment_that_never_arrived_is_debated(self):
        entry = self.read("Kevin amelipa elfu moja kwa M-Pesa")
        lid = save_entry(entry, memory=self.memory)
        d = next(d for d in run_all(load(memory=self.memory)) if d.kind == "no-trace")
        self.assertEqual(lid, "L-200")
        self.assertEqual((d.outcome, d.agreed, d.conceded_by), ("settled", 0, "ledger"))
        self.assertIn("Kevin Ochieng", d.action)


if __name__ == "__main__":
    unittest.main()
