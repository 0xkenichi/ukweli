; =====================================================================
; Ukweli: two agents, one truth.
;
; Knowledge lives in three spaces:
;   &ledger   what the shop book knows: sales book, credit book, contacts
;   &mpesa    what the M-Pesa statement knows
;   &beliefs  each agent's current belief per case, and every revision
;
; Python only runs the turn order. Everything an agent claims, every
; piece of evidence, every rebuttal and every settlement comes from the
; rules below, so each step of a debate can be traced back to a rule.
; =====================================================================

; ---------- Helpers ----------

(= (name-of $c) (match &ledger (customer $c $n $p $r) $n))
(= (phone-of $c) (match &ledger (customer $c $n $p $r) $p))

(= (is-owner-phone $ph)
   (not (== (collapse (match &ledger (customer $c $n $ph owner) $c)) ())))

(= (code-in-book $code)
   (not (== (collapse (match &ledger (ledger-entry $i $d $c $a mpesa $code $p) $i)) ())))

(= (is-reversed $code)
   (not (== (collapse (match &mpesa (mpesa-reversal $r $d $t $n $ph $a $code) $r)) ())))

(= (has-statement-payment $date $amount)
   (not (== (collapse (match &mpesa (mpesa-received $code $date $t $n $ph $amount) $code)) ())))

(= (has-uncoded-entry $date $amount)
   (not (== (collapse (match &ledger (ledger-entry $i $date $c $amount mpesa nocode $p) $i)) ())))

; Bookkeepers' rule: when two digits are swapped while writing a number,
; the difference between the right and wrong number divides by 9.
(= (looks-like-digit-swap $a $b) (== (% (abs-diff $a $b) 9) 0))
(= (abs-diff $a $b) (if (> $a $b) (- $a $b) (- $b $a)))

; ---------- Finding disagreements ----------
; Each (detect) rule is one kind of disagreement between the two records.

; The book says paid, but the statement shows the payment was reversed.
(= (detect)
   (match &ledger (ledger-entry $id $d $c $a mpesa $code $p)
     (if (is-reversed $code) (Case reversed $id) (empty))))

; Same M-Pesa code, different amounts.
(= (detect)
   (match &ledger (ledger-entry $id $d $c $a1 mpesa $code $p)
     (match &mpesa (mpesa-received $code $d2 $t $n $ph $a2)
       (if (and (not (== $a1 $a2)) (not (is-reversed $code)))
           (Case amount-mismatch $id)
           (empty)))))

; The same M-Pesa code is written in the book twice.
(= (detect)
   (match &ledger (ledger-entry $id1 $d1 $c1 $a1 mpesa $code $p1)
     (match &ledger (ledger-entry $id2 $d2 $c2 $a2 mpesa $code $p2)
       (if (and (< $id1 $id2) (not (== $code nocode)))
           (Case duplicate $id2)
           (empty)))))

; Money in the statement that the book doesn't mention.
(= (detect)
   (match &mpesa (mpesa-received $code $d $t $n $ph $a)
     (if (code-in-book $code)
         (empty)
         (if (is-owner-phone $ph)
             (Case owner-topup $code)
             (if (has-uncoded-entry $d $a) (empty) (Case unrecorded $code))))))

; The book says paid by M-Pesa with no code, and an unclaimed payment of
; the same amount arrived that day from someone else's number. (From the
; customer's own number it simply matches, so there's nothing to debate.)
(= (detect)
   (match &ledger (ledger-entry $id $d $c $a mpesa nocode $p)
     (match &mpesa (mpesa-received $code $d $t $n $ph $a)
       (if (or (code-in-book $code) (== $ph (phone-of $c))) (empty) (Case possible-match $id)))))

; The book says paid by M-Pesa, but nothing of that amount arrived that day.
(= (detect)
   (match &ledger (ledger-entry $id $d $c $a mpesa nocode $p)
     (if (has-statement-payment $d $a) (empty) (Case no-trace $id))))

; ---------- The question each case settles ----------

(= (question (Case reversed $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p)
     (let $n (name-of $c)
       (format-args "How much did {} really pay on {} (book entry L-{})?" ($n $d $id)))))

(= (question (Case amount-mismatch $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p)
     (let $n (name-of $c)
       (format-args "How much did {} really pay on {} (book entry L-{})?" ($n $d $id)))))

(= (question (Case duplicate $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p)
     (let $n (name-of $c)
       (format-args "How much did {} pay with M-Pesa code {}?" ($n $code)))))

(= (question (Case unrecorded $code))
   (match &mpesa (mpesa-received $code $d $t $n $ph $a)
     (format-args "Is the KES {} from {} on {} ({}) shop income?" ($a $n $d $code))))

(= (question (Case owner-topup $code))
   (match &mpesa (mpesa-received $code $d $t $n $ph $a)
     (format-args "Is the KES {} from {} on {} ({}) a sale?" ($a $n $d $code))))

(= (question (Case possible-match $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p)
     (let $n (name-of $c)
       (format-args "Did {}'s KES {} on {} (book entry L-{}) arrive?" ($n $a $d $id)))))

(= (question (Case no-trace $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p)
     (let $n (name-of $c)
       (format-args "Did {}'s KES {} on {} (book entry L-{}) arrive?" ($n $a $d $id)))))

; The same questions in Swahili, for the owner.

(= (question-sw (Case no-trace $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p)
     (let $n (name-of $c)
       (format-args "Je, KES {} za {} tarehe {} (L-{}) zilifika?" ($a $n $d $id)))))

(= (question-sw (Case reversed $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p)
     (let $n (name-of $c)
       (format-args "{} alilipa kiasi gani hasa tarehe {} (L-{})?" ($n $d $id)))))

(= (question-sw (Case amount-mismatch $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p)
     (let $n (name-of $c)
       (format-args "{} alilipa kiasi gani hasa tarehe {} (L-{})?" ($n $d $id)))))

(= (question-sw (Case duplicate $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p)
     (let $n (name-of $c)
       (format-args "{} alilipa kiasi gani kwa namba ya muamala {}?" ($n $code)))))

(= (question-sw (Case unrecorded $code))
   (match &mpesa (mpesa-received $code $d $t $n $ph $a)
     (format-args "Je, KES {} kutoka kwa {} tarehe {} ({}) ni mapato ya duka?" ($a $n $d $code))))

(= (question-sw (Case owner-topup $code))
   (match &mpesa (mpesa-received $code $d $t $n $ph $a)
     (format-args "Je, KES {} kutoka kwa {} tarehe {} ({}) ni mauzo?" ($a $n $d $code))))

(= (question-sw (Case possible-match $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p)
     (let $n (name-of $c)
       (format-args "Je, KES {} za {} tarehe {} (L-{}) zilifika?" ($a $n $d $id)))))

; ---------- What each agent believes at the start ----------
; A claim is (kes N): the money this case really brought into the shop.

(= (claim ledger (Case reversed $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p) (kes $a)))
(= (claim mpesa (Case reversed $id)) (kes 0))

(= (claim ledger (Case amount-mismatch $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p) (kes $a)))
(= (claim mpesa (Case amount-mismatch $id))
   (match &ledger (ledger-entry $id $d $c $a1 $m $code $p)
     (match &mpesa (mpesa-received $code $d2 $t $n $ph $a2) (kes $a2))))

(= (claim ledger (Case duplicate $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p) (kes (* 2 $a))))
(= (claim mpesa (Case duplicate $id))
   (match &ledger (ledger-entry $id $d $c $a1 $m $code $p)
     (match &mpesa (mpesa-received $code $d2 $t $n $ph $a2) (kes $a2))))

(= (claim ledger (Case unrecorded $code)) (kes 0))
(= (claim mpesa (Case unrecorded $code))
   (match &mpesa (mpesa-received $code $d $t $n $ph $a) (kes $a)))

(= (claim ledger (Case owner-topup $code)) (kes 0))
(= (claim mpesa (Case owner-topup $code))
   (match &mpesa (mpesa-received $code $d $t $n $ph $a) (kes $a)))

(= (claim ledger (Case possible-match $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p) (kes $a)))
(= (claim mpesa (Case possible-match $id)) (kes 0))

(= (claim ledger (Case no-trace $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p) (kes $a)))
(= (claim mpesa (Case no-trace $id)) (kes 0))

; ---------- Evidence each agent can bring ----------

; Entry with nothing matching in the statement
(= (args ledger (Case no-trace $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p)
     (let $n (name-of $c)
       (Arg 1 book-entry
         (format-args "My book entry L-{} says {} paid KES {} by M-Pesa on {}. No code was written down." ($id $n $a $d))))))
(= (args mpesa (Case no-trace $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p)
     (Arg 1 no-payment-at-all
       (format-args "My statement has no payment of KES {} from anyone on {}." ($a $d)))))
; (Arg <order> <kind> <what the agent says>). Lower order is played first.

; Reversed payment
(= (args ledger (Case reversed $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p)
     (let $n (name-of $c)
       (Arg 1 book-entry
         (format-args "My book entry L-{} says {} paid KES {} by M-Pesa on {}, code {}." ($id $n $a $d $code))))))
(= (args ledger (Case reversed $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code sms-shown)
     (Arg 2 customer-sms
       (format-args "And the customer showed me the confirmation SMS for {}. I saw it myself." ($code)))))
(= (args mpesa (Case reversed $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p)
     (match &mpesa (mpesa-received $code $d2 $t $n $ph $a2)
       (match &mpesa (mpesa-reversal $r $d3 $t3 $n3 $ph3 $a3 $code)
         (Arg 1 statement-reversal
           (format-args "My statement shows {} brought in KES {} at {}, but {} reversed it at {}. Net: KES 0." ($code $a2 $t $r $t3)))))))

; Amount mismatch
(= (args ledger (Case amount-mismatch $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p)
     (let $n (name-of $c)
       (Arg 1 book-entry
         (format-args "My book entry L-{} says {} paid KES {}, code {}." ($id $n $a $code))))))
(= (args mpesa (Case amount-mismatch $id))
   (match &ledger (ledger-entry $id $d $c $a1 $m $code $p)
     (match &mpesa (mpesa-received $code $d2 $t $n $ph $a2)
       (Arg 1 statement-amount
         (format-args "My statement shows {} was exactly KES {} from {} at {}." ($code $a2 $n $t))))))

; Duplicate entry
(= (args ledger (Case duplicate $id2))
   (match &ledger (ledger-entry $id2 $d2 $c $a $m $code $p2)
     (match &ledger (ledger-entry $id1 $d1 $c1 $a1 mpesa $code $p1)
       (if (< $id1 $id2)
           (let* (($n (name-of $c)) ($total (+ $a1 $a)))
             (Arg 1 book-entries-sum
               (format-args "My book entries L-{} and L-{} each record KES {} from {}. That's KES {} in total." ($id1 $id2 $a $n $total))))
           (empty)))))
(= (args mpesa (Case duplicate $id))
   (match &ledger (ledger-entry $id $d $c $a1 $m $code $p)
     (match &mpesa (mpesa-received $code $d2 $t $n $ph $a2)
       (Arg 1 single-code
         (format-args "Code {} appears once in my statement: one payment of KES {} from {} at {}." ($code $a2 $n $t))))))

; Payment missing from the book
(= (args ledger (Case unrecorded $code))
   (Arg 1 no-book-entry
     (format-args "No entry in my book has code {}, so I don't count it as income." ($code))))
(= (args mpesa (Case unrecorded $code))
   (match &mpesa (mpesa-received $code $d $t $n $ph $a)
     (Arg 1 statement-received
       (format-args "My statement shows {} brought in KES {} from {} ({}) at {} on {}. Completed, not reversed." ($code $a $n $ph $t $d)))))

; Owner's own top-up
(= (args ledger (Case owner-topup $code))
   (match &mpesa (mpesa-received $code $d $t $n $ph $a)
     (Arg 1 own-number
       (format-args "{} is the owner's own number in my contact list. Money from it is a float top-up, not a sale." ($ph)))))
(= (args mpesa (Case owner-topup $code))
   (match &mpesa (mpesa-received $code $d $t $n $ph $a)
     (Arg 1 statement-received
       (format-args "My statement shows {} brought in KES {} from {} at {} on {}." ($code $a $n $t $d)))))

; Uncoded entry that might match a payment from an unknown number
(= (args ledger (Case possible-match $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p)
     (let $n (name-of $c)
       (Arg 1 book-entry
         (format-args "My book entry L-{} says {} paid KES {} by M-Pesa on {}. No code was written down." ($id $n $a $d))))))
(= (args ledger (Case possible-match $id))
   (match &ledger (ledger-entry $id $d $c $a $m nocode $p)
     (match &mpesa (mpesa-received $code $d $t $n $ph $a)
       (if (code-in-book $code)
           (empty)
           (Arg 3 same-day-payment
             (format-args "But your statement has KES {} that day that nobody in my book claims: {} from {} ({}) at {}. Customers often pay from a relative's phone." ($a $code $n $ph $t)))))))
(= (args mpesa (Case possible-match $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p)
     (let* (($n (name-of $c)) ($ph (phone-of $c)))
       (Arg 1 no-payment-from-number
         (format-args "No payment came from {}'s number ({}) on {}." ($n $ph $d))))))
(= (args mpesa (Case possible-match $id))
   (match &ledger (ledger-entry $id $d $c $a $m nocode $p)
     (match &mpesa (mpesa-received $code $d $t $n $ph $a)
       (if (or (code-in-book $code) (or (owner-confirmed $c $ph) (owner-denied $c $ph)))
           (empty)
           (let $cn (name-of $c)
             (Arg 2 unknown-payer
               (format-args "{} isn't in the shop's contacts. I can't confirm {} paid for {}." ($ph $n $cn))))))))

; Evidence that comes from the owner's answers (see "What the owner taught").
(= (args ledger (Case possible-match $id))
   (match &ledger (ledger-entry $id $d $c $a $m nocode $p)
     (match &ledger (learned-phone $c $ph yes $when)
       (let $cn (name-of $c)
         (Arg 2 owner-confirmed
           (format-args "The owner checked with {} on {}: {} is also {}'s number." ($cn $when $ph $cn)))))))
(= (args mpesa (Case possible-match $id))
   (match &ledger (ledger-entry $id $d $c $a $m nocode $p)
     (match &ledger (learned-phone $c $ph no $when)
       (let $cn (name-of $c)
         (Arg 2 owner-denied
           (format-args "The owner checked with {} on {}: {} is not {}'s number." ($cn $when $ph $cn)))))))

; ---------- What the owner taught ----------
; When the agents can't agree, the owner answers their question. Each answer
; is saved as (learned-phone <customer> <phone> yes|no <date>) in
; memory/learned.metta and loaded into &ledger on every run, so the agents
; settle the same kind of case on their own next time.

(= (owner-confirmed $c $ph)
   (not (== (collapse (match &ledger (learned-phone $c $ph yes $w) $w)) ())))
(= (owner-denied $c $ph)
   (not (== (collapse (match &ledger (learned-phone $c $ph no $w) $w)) ())))

; ---------- Which evidence beats which ----------
; (defeats <attacker> <target> <why>). Both agents share these rules.

(defeats statement-reversal book-entry
  "Safaricom reversed this payment after it was sent, so the money never stayed in the till.")
(defeats statement-reversal customer-sms
  "The SMS was real, but it was sent before the reversal. An SMS can't show a reversal that happened later.")
(defeats statement-amount book-entry
  "Safaricom records the amount automatically. The book is written by hand.")
(defeats single-code book-entries-sum
  "Every M-Pesa code is unique. The same code written twice is one payment recorded twice.")
(defeats statement-received no-book-entry
  "A missing book entry doesn't mean missing money. The statement shows it arrived.")
(defeats own-number statement-received
  "Money from the owner's own phone is the owner's money, not a customer's payment.")
(defeats no-payment-from-number book-entry
  "There's no code in the book to check, and the customer's own number didn't pay that day.")
(defeats same-day-payment no-payment-from-number
  "A payment of exactly this amount arrived the same day and no one else claims it.")
(defeats no-payment-at-all book-entry
  "Nothing of that amount reached the till that day, from any number.")
(defeats owner-confirmed no-payment-from-number
  "The owner confirmed the other number belongs to the customer, so the payment did arrive.")
(defeats owner-denied same-day-payment
  "The owner confirmed that payment came from someone else.")

(= (rebuttal $attacker $target)
   (match &self (defeats $attacker $target $why) $why))

; ---------- Settling a case ----------
; (Settled <confidence> <English> <Swahili>): what the owner should do,
; once one agent concedes.

(= (settle (Case reversed $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p)
     (let $n (name-of $c)
       (Settled 0.95
         (format-args "Mark L-{} as UNPAID. Ask {} to pay KES {} again: the payment was reversed." ($id $n $a))
         (format-args "Weka L-{} kama HAIJALIPWA. Muombe {} alipe KES {} tena: malipo yalirudishwa." ($id $n $a))))))

(= (settle (Case amount-mismatch $id))
   (match &ledger (ledger-entry $id $d $c $a1 $m $code $p)
     (match &mpesa (mpesa-received $code $d2 $t $nm $ph $a2)
       (let* (($n (name-of $c)) ($gap (abs-diff $a1 $a2)))
         (if (looks-like-digit-swap $a1 $a2)
             (Settled 0.85
               (format-args "Correct L-{} to KES {}. The KES {} gap divides by 9, the classic sign of swapped digits. Check with {} whether KES {} was owed; if so, KES {} is still due." ($id $a2 $gap $n $a1 $gap))
               (format-args "Sahihisha L-{} iwe KES {}. Tofauti ya KES {} inagawanyika kwa 9, dalili ya tarakimu zilizobadilishana. Muulize {} kama alikuwa anadaiwa KES {}; kama ndiyo, bado anadaiwa KES {}." ($id $a2 $gap $n $a1 $gap)))
             (Settled 0.7
               (format-args "Correct L-{} to KES {}. Ask {} about the KES {} gap." ($id $a2 $n $gap))
               (format-args "Sahihisha L-{} iwe KES {}. Muulize {} kuhusu tofauti ya KES {}." ($id $a2 $n $gap))))))))

(= (settle (Case duplicate $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p)
     (Settled 0.97
       (format-args "Delete L-{}. It repeats code {}, which was already recorded." ($id $code))
       (format-args "Futa L-{}. Inarudia namba ya muamala {} iliyokwisha andikwa." ($id $code)))))

(= (settle (Case unrecorded $code))
   (match &mpesa (mpesa-received $code $d $t $nm $ph $a)
     (let $debts (collapse (match &ledger (customer $c $cn $ph $r)
                             (match &ledger (debt $did $dd $c $a) (Debt $did $dd $cn))))
       (if (== $debts ())
           (Settled 0.85
             (format-args "Add a book entry for {}: KES {} from {} on {}." ($code $a $nm $d))
             (format-args "Andika {} kwenye kitabu: KES {} kutoka kwa {} tarehe {}." ($code $a $nm $d)))
           (let (Debt $did $dd $cn) (car-atom $debts)
             (Settled 0.9
               (format-args "Add a book entry for {}, and close {}'s debt {} (KES {}, from {})." ($code $cn $did $a $dd))
               (format-args "Andika {} kwenye kitabu, na ufunge deni la {} {} (KES {}, la tarehe {})." ($code $cn $did $a $dd))))))))

(= (settle (Case owner-topup $code))
   (match &mpesa (mpesa-received $code $d $t $nm $ph $a)
     (Settled 0.95
       (format-args "Don't count {} as sales. Record the KES {} as the owner's float top-up." ($code $a))
       (format-args "Usihesabu {} kama mauzo. Andika KES {} kama pesa ya mwenye duka ya kuongeza float." ($code $a)))))

(= (settle (Case no-trace $id))
   (match &ledger (ledger-entry $id $d $c $a $m $code $p)
     (let $n (name-of $c)
       (Settled 0.9
         (format-args "No M-Pesa payment of KES {} arrived on {}. Ask {} for the M-Pesa message, or check whether it was paid in cash." ($a $d $n))
         (format-args "Hakuna malipo ya M-Pesa ya KES {} yaliyofika tarehe {}. Muombe {} ujumbe wa M-Pesa, au angalia kama alilipa taslimu." ($a $d $n))))))

; Settled only after the owner has answered the agents' question.
(= (settle (Case possible-match $id))
   (match &ledger (ledger-entry $id $d $c $a $m nocode $p)
     (match &mpesa (mpesa-received $code $d $t $nm $ph $a)
       (let $cn (name-of $c)
         (if (owner-confirmed $c $ph)
             (Settled 0.9
               (format-args "Write code {} on L-{}: {} paid KES {} from {}." ($code $id $cn $a $ph))
               (format-args "Andika namba ya muamala {} kwenye L-{}: {} alilipa KES {} kutoka {}." ($code $id $cn $a $ph)))
             (if (owner-denied $c $ph)
                 (Settled 0.9
                   (format-args "Mark L-{} as UNPAID and ask {} to pay KES {}. {} (KES {} from {}) is still unexplained: find out what it was for." ($id $cn $a $code $a $nm))
                   (format-args "Weka L-{} kama HAIJALIPWA na umuombe {} alipe KES {}. {} (KES {} kutoka kwa {}) bado haijaelezwa: tafuta ilikuwa ya nini." ($id $cn $a $code $a $nm)))
                 (empty)))))))

; ---------- When the agents can't agree ----------
; (Escalate <English> <Swahili> <customer> <phone>): one question for the
; owner. The customer and phone let the answer be saved as a learned fact.

(= (escalate (Case possible-match $id))
   (match &ledger (ledger-entry $id $d $c $a $m nocode $p)
     (match &mpesa (mpesa-received $code $d $t $nm $ph $a)
       (if (code-in-book $code)
           (empty)
           (let $cn (name-of $c)
             (Escalate
               (format-args "Ask {}: did you pay KES {} on {} from {} ({})?" ($cn $a $d $ph $nm))
               (format-args "Muulize {}: ulilipa KES {} tarehe {} kutoka {} ({})?" ($cn $a $d $ph $nm))
               $c $ph))))))

; ---------- Belief revision ----------
; An agent that concedes rewrites its own belief. The old belief is kept
; as a (revision ...) atom, so the change can always be shown as a diff.

(= (believe $agent $case $value)
   (add-atom &beliefs (belief $agent $case $value)))

(= (belief-of $agent $case)
   (match &beliefs (belief $agent $case $v) $v))

(= (revise $agent $case $new $why)
   (let $old (belief-of $agent $case)
     (let* ((() (remove-atom &beliefs (belief $agent $case $old)))
            (() (add-atom &beliefs (belief $agent $case $new)))
            (() (add-atom &beliefs (revision $agent $case $old $new $why))))
       (Revised $old $new))))
