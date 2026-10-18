# Ukweli audit trail

Generated 2026-10-18 16:55. Every step below comes from a rule in `metta/ukweli.metta`. The owner can overrule any decision.

| # | Question | Ledger | M-Pesa | Result | Confidence |
|---|---|---|---|---|---|
| 1 | How much did John Kamau really pay on 2026-10-14 (book entry L-104)? | KES 500 | KES 0 | KES 0 | 95% |
| 2 | How much did Akinyi Odhiambo really pay on 2026-10-15 (book entry L-107)? | KES 1,500 | KES 1,050 | KES 1,050 | 85% |
| 3 | How much did Peter Otieno pay with M-Pesa code QK7D3FT9WS? | KES 600 | KES 300 | KES 300 | 97% |
| 4 | Is the KES 2,000 from WANJIKU K on 2026-10-16 (QL6S3DR1XW) a sale? | KES 0 | KES 2,000 | KES 0 | 95% |
| 5 | Is the KES 1,200 from BRIAN MWANGI on 2026-10-15 (QKA5Y7GJ4T) shop income? | KES 0 | KES 1,200 | KES 1,200 | 90% |
| 6 | Did Mama Faith's KES 800 on 2026-10-16 (book entry L-115) arrive? | KES 800 | KES 0 | Ask the owner | - |

## Case 1: How much did John Kamau really pay on 2026-10-14 (book entry L-104)?

Rule match: `(Case reversed 104)`

- **1.** Ledger agent believes KES 500: "My book entry L-104 says John Kamau paid KES 500 by M-Pesa on 2026-10-14, code QJK4T7XA2P."
- **2.** M-Pesa agent believes KES 0: "My statement shows QJK4T7XA2P brought in KES 500 at 10:14, but QJR9W2LB6E reversed it at 16:42. Net: KES 0."
- **2.** M-Pesa agent rebuts: Safaricom reversed this payment after it was sent, so the money never stayed in the till. (rule: statement-reversal beats book-entry)
- **3.** Ledger agent brings new evidence: "And the customer showed me the confirmation SMS for QJK4T7XA2P. I saw it myself."
- **4.** M-Pesa agent rebuts: The SMS was real, but it was sent before the reversal. An SMS can't show a reversal that happened later. (rule: statement-reversal beats customer-sms)
- **5.** Ledger agent concedes and now believes KES 0.

**Agreed:** KES 0 (confidence 95%)

**What to do:** Mark L-104 as UNPAID. Ask John Kamau to pay KES 500 again: the payment was reversed.

**Kazi ya kufanya:** Weka L-104 kama HAIJALIPWA. Muombe John Kamau alipe KES 500 tena: malipo yalirudishwa.

**Belief change:** Ledger agent went from KES 500 to KES 0 because: The SMS was real, but it was sent before the reversal. An SMS can't show a reversal that happened later.

**To overrule:** if you know better, fix the record and run Ukweli again.

## Case 2: How much did Akinyi Odhiambo really pay on 2026-10-15 (book entry L-107)?

Rule match: `(Case amount-mismatch 107)`

- **1.** Ledger agent believes KES 1,500: "My book entry L-107 says Akinyi Odhiambo paid KES 1,500, code QK2H6VN3LC."
- **2.** M-Pesa agent believes KES 1,050: "My statement shows QK2H6VN3LC was exactly KES 1,050 from AKINYI ODHIAMBO at 12:03."
- **2.** M-Pesa agent rebuts: Safaricom records the amount automatically. The book is written by hand. (rule: statement-amount beats book-entry)
- **3.** Ledger agent concedes and now believes KES 1,050.

**Agreed:** KES 1,050 (confidence 85%)

**What to do:** Correct L-107 to KES 1,050. The KES 450 gap divides by 9, the classic sign of swapped digits. Check with Akinyi Odhiambo whether KES 1,500 was owed; if so, KES 450 is still due.

**Kazi ya kufanya:** Sahihisha L-107 iwe KES 1,050. Tofauti ya KES 450 inagawanyika kwa 9, dalili ya tarakimu zilizobadilishana. Muulize Akinyi Odhiambo kama alikuwa anadaiwa KES 1,500; kama ndiyo, bado anadaiwa KES 450.

**Belief change:** Ledger agent went from KES 1,500 to KES 1,050 because: Safaricom records the amount automatically. The book is written by hand.

**To overrule:** if you know better, fix the record and run Ukweli again.

## Case 3: How much did Peter Otieno pay with M-Pesa code QK7D3FT9WS?

Rule match: `(Case duplicate 111)`

- **1.** Ledger agent believes KES 600: "My book entries L-110 and L-111 each record KES 300 from Peter Otieno. That's KES 600 in total."
- **2.** M-Pesa agent believes KES 300: "Code QK7D3FT9WS appears once in my statement: one payment of KES 300 from PETER OTIENO at 15:47."
- **2.** M-Pesa agent rebuts: Every M-Pesa code is unique. The same code written twice is one payment recorded twice. (rule: single-code beats book-entries-sum)
- **3.** Ledger agent concedes and now believes KES 300.

**Agreed:** KES 300 (confidence 97%)

**What to do:** Delete L-111. It repeats code QK7D3FT9WS, which was already recorded.

**Kazi ya kufanya:** Futa L-111. Inarudia namba ya muamala QK7D3FT9WS iliyokwisha andikwa.

**Belief change:** Ledger agent went from KES 600 to KES 300 because: Every M-Pesa code is unique. The same code written twice is one payment recorded twice.

**To overrule:** if you know better, fix the record and run Ukweli again.

## Case 4: Is the KES 2,000 from WANJIKU K on 2026-10-16 (QL6S3DR1XW) a sale?

Rule match: `(Case owner-topup QL6S3DR1XW)`

- **1.** Ledger agent believes KES 0: "0700***111 is the owner's own number in my contact list. Money from it is a float top-up, not a sale."
- **2.** M-Pesa agent believes KES 2,000: "My statement shows QL6S3DR1XW brought in KES 2,000 from WANJIKU K at 20:02 on 2026-10-16."
- **3.** Ledger agent rebuts: Money from the owner's own phone is the owner's money, not a customer's payment. (rule: own-number beats statement-received)
- **4.** M-Pesa agent concedes and now believes KES 0.

**Agreed:** KES 0 (confidence 95%)

**What to do:** Don't count QL6S3DR1XW as sales. Record the KES 2,000 as the owner's float top-up.

**Kazi ya kufanya:** Usihesabu QL6S3DR1XW kama mauzo. Andika KES 2,000 kama pesa ya mwenye duka ya kuongeza float.

**Belief change:** M-Pesa agent went from KES 2,000 to KES 0 because: Money from the owner's own phone is the owner's money, not a customer's payment.

**To overrule:** if you know better, fix the record and run Ukweli again.

## Case 5: Is the KES 1,200 from BRIAN MWANGI on 2026-10-15 (QKA5Y7GJ4T) shop income?

Rule match: `(Case unrecorded QKA5Y7GJ4T)`

- **1.** Ledger agent believes KES 0: "No entry in my book has code QKA5Y7GJ4T, so I don't count it as income."
- **2.** M-Pesa agent believes KES 1,200: "My statement shows QKA5Y7GJ4T brought in KES 1,200 from BRIAN MWANGI (0722***415) at 18:05 on 2026-10-15. Completed, not reversed."
- **2.** M-Pesa agent rebuts: A missing book entry doesn't mean missing money. The statement shows it arrived. (rule: statement-received beats no-book-entry)
- **3.** Ledger agent concedes and now believes KES 1,200.

**Agreed:** KES 1,200 (confidence 90%)

**What to do:** Add a book entry for QKA5Y7GJ4T, and close Brian Mwangi's debt D-03 (KES 1,200, from 2026-10-03).

**Kazi ya kufanya:** Andika QKA5Y7GJ4T kwenye kitabu, na ufunge deni la Brian Mwangi D-03 (KES 1,200, la tarehe 2026-10-03).

**Belief change:** Ledger agent went from KES 0 to KES 1,200 because: A missing book entry doesn't mean missing money. The statement shows it arrived.

**To overrule:** if you know better, fix the record and run Ukweli again.

## Case 6: Did Mama Faith's KES 800 on 2026-10-16 (book entry L-115) arrive?

Rule match: `(Case possible-match 115)`

- **1.** Ledger agent believes KES 800: "My book entry L-115 says Mama Faith paid KES 800 by M-Pesa on 2026-10-16. No code was written down."
- **2.** M-Pesa agent believes KES 0: "No payment came from Mama Faith's number (0733***208) on 2026-10-16."
- **2.** M-Pesa agent rebuts: There's no code in the book to check, and the customer's own number didn't pay that day. (rule: no-payment-from-number beats book-entry)
- **3.** Ledger agent: "But your statement has KES 800 that day that nobody in my book claims: QL4V2NB8HK from GRACE MUTHONI (0711***902) at 18:20. Customers often pay from a relative's phone."
- **3.** Ledger agent rebuts: A payment of exactly this amount arrived the same day and no one else claims it. (rule: same-day-payment beats no-payment-from-number)
- **4.** M-Pesa agent brings new evidence: "0711***902 isn't in the shop's contacts. I can't confirm GRACE MUTHONI paid for Mama Faith."
- **5.** Ledger agent has nothing to add.
- **6.** M-Pesa agent has nothing to add.

**No agreement.** Ask Mama Faith: did you pay KES 800 on 2026-10-16 from 0711***902 (GRACE MUTHONI)?

**Hawakukubaliana.** Muulize Mama Faith: ulilipa KES 800 tarehe 2026-10-16 kutoka 0711***902 (GRACE MUTHONI)?
