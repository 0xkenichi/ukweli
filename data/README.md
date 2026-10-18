# Sample data

**All data here is made up.** The names, phone numbers, M-Pesa codes and amounts are placeholders for a fictional shop ("Mama Wanjiku's Duka"). No real customer or Safaricom data is used.

| File | Who knows it | What it is |
|---|---|---|
| `ledger.csv` | Ledger agent | The shop's sales book, written by hand |
| `debts.csv` | Ledger agent | The credit book: customers who owe money |
| `customers.csv` | Ledger agent | The shop's contact list |
| `mpesa_statement.csv` | M-Pesa agent | The till's M-Pesa statement |

The data is built so that 4 entries agree and 6 situations need the agents to debate:

1. A payment that was **reversed** after the customer showed the SMS (L-104)
2. An **amount mismatch**: 1,500 written, 1,050 received (L-107)
3. A **duplicate** entry: the same code written twice (L-110 / L-111)
4. A payment **missing from the book** that settles an old debt (QKA5Y7GJ4T)
5. The **owner's own top-up**, which is not a sale (QL6S3DR1XW)
6. A payment from an **unknown number** that might be Mama Faith's (L-115). The agents can't settle this one and ask the owner.
