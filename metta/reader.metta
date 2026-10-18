; =====================================================================
; Ukweli reader: understands an owner's message in English, Kiswahili,
; Sheng, Kikuyu or Dholuo, and turns it into a ledger entry.
;
; Python only splits the message into tokens:
;   (w "word")   a lower-case word, accents removed
;   (n 800)      a number written in digits
;   (code QK..)  something shaped like an M-Pesa code
;   (date "2026-10-15")
; Everything else, from what each word means to the amount, who paid,
; how and when, is decided by the rules below, and every token's
; meaning is returned so the owner can see how the message was read.
;
; Word lists are a first version and need checking by native speakers.
; =====================================================================

; ---------- Lexicon: (lex <language> "<word>" <meaning>) ----------
; Meanings: (number N), (scale N) for hundred/thousand words,
; (paid), (owes), (method mpesa|cash), (when yesterday|today), (filler).

; English
(lex en "one" (number 1)) (lex en "two" (number 2)) (lex en "three" (number 3))
(lex en "four" (number 4)) (lex en "five" (number 5)) (lex en "six" (number 6))
(lex en "seven" (number 7)) (lex en "eight" (number 8)) (lex en "nine" (number 9))
(lex en "ten" (number 10)) (lex en "twenty" (number 20)) (lex en "thirty" (number 30))
(lex en "forty" (number 40)) (lex en "fifty" (number 50)) (lex en "sixty" (number 60))
(lex en "seventy" (number 70)) (lex en "eighty" (number 80)) (lex en "ninety" (number 90))
(lex en "hundred" (scale 100)) (lex en "thousand" (scale 1000))
(lex en "paid" (paid)) (lex en "sent" (paid)) (lex en "gave" (paid)) (lex en "received" (paid)) (lex en "bought" (paid))
(lex en "owes" (owes)) (lex en "owe" (owes)) (lex en "debt" (owes)) (lex en "credit" (owes))
(lex en "cash" (method cash)) (lex en "mpesa" (method mpesa)) (lex en "till" (method mpesa))
(lex en "yesterday" (when yesterday)) (lex en "today" (when today))
(lex en "by" (filler)) (lex en "via" (filler)) (lex en "with" (filler)) (lex en "from" (filler))
(lex en "the" (filler)) (lex en "a" (filler)) (lex en "for" (filler)) (lex en "on" (filler))
(lex en "and" (filler)) (lex en "kes" (filler)) (lex en "ksh" (filler)) (lex en "shillings" (filler))
(lex en "confirmed" (filler)) (lex en "at" (filler)) (lex en "pm" (filler)) (lex en "am" (filler))
(lex en "new" (filler)) (lex en "balance" (filler)) (lex en "is" (filler)) (lex en "me" (filler))

; Kiswahili
(lex sw "moja" (number 1)) (lex sw "mbili" (number 2)) (lex sw "tatu" (number 3))
(lex sw "nne" (number 4)) (lex sw "tano" (number 5)) (lex sw "sita" (number 6))
(lex sw "saba" (number 7)) (lex sw "nane" (number 8)) (lex sw "tisa" (number 9))
(lex sw "kumi" (number 10)) (lex sw "ishirini" (number 20)) (lex sw "thelathini" (number 30))
(lex sw "arobaini" (number 40)) (lex sw "hamsini" (number 50)) (lex sw "sitini" (number 60))
(lex sw "sabini" (number 70)) (lex sw "themanini" (number 80)) (lex sw "tisini" (number 90))
(lex sw "mia" (scale 100)) (lex sw "elfu" (scale 1000))
(lex sw "amelipa" (paid)) (lex sw "alilipa" (paid)) (lex sw "amelipia" (paid)) (lex sw "kalipa" (paid))
(lex sw "ametuma" (paid)) (lex sw "alituma" (paid)) (lex sw "amenitumia" (paid)) (lex sw "lipa" (paid))
(lex sw "anadaiwa" (owes)) (lex sw "deni" (owes)) (lex sw "amekopa" (owes)) (lex sw "mkopo" (owes))
(lex sw "taslimu" (method cash)) (lex sw "keshi" (method cash))
(lex sw "jana" (when yesterday)) (lex sw "leo" (when today))
(lex sw "kwa" (filler)) (lex sw "na" (filler)) (lex sw "ya" (filler)) (lex sw "za" (filler))
(lex sw "wa" (filler)) (lex sw "la" (filler)) (lex sw "shilingi" (filler)) (lex sw "pesa" (filler))
(lex sw "kutoka" (filler)) (lex sw "simu" (filler)) (lex sw "amepokea" (filler))

; Sheng
(lex sheng "thao" (scale 1000)) (lex sheng "soo" (scale 100)) (lex sheng "mbao" (number 20))
(lex sheng "amesend" (paid)) (lex sheng "kasend" (paid)) (lex sheng "ametupia" (paid)) (lex sheng "ameniwekea" (paid))
(lex sheng "doh" (filler)) (lex sheng "ganji" (filler)) (lex sheng "mbeca" (filler))
(lex en "bob" (filler))
(lex sheng "ameniaccount" (owes)) (lex sheng "anakula" (owes))

; Kikuyu (Gikuyu)
(lex ki "imwe" (number 1)) (lex ki "igiri" (number 2)) (lex ki "ithatu" (number 3))
(lex ki "inya" (number 4)) (lex ki "ithano" (number 5)) (lex ki "ithathatu" (number 6))
(lex ki "mugwanja" (number 7)) (lex ki "inyanya" (number 8)) (lex ki "kenda" (number 9))
(lex ki "ikumi" (number 10))
(lex ki "meeri" (number 2)) (lex ki "matatu" (number 3)) (lex ki "mana" (number 4))
(lex ki "matano" (number 5)) (lex ki "matandatu" (number 6)) (lex ki "manana" (number 8))
(lex ki "igana" (scale 100)) (lex ki "magana" (scale 100)) (lex ki "ngiri" (scale 1000))
(lex ki "niarihire" (paid)) (lex ki "arihire" (paid)) (lex ki "riha" (paid)) (lex ki "niatumire" (paid))
(lex ki "thiiri" (owes))
(lex ki "ira" (when yesterday)) (lex ki "umuthi" (when today))
(lex ki "mbeca" (filler)) (lex ki "ya" (filler)) (lex ki "wa" (filler))

; Dholuo
(lex luo "achiel" (number 1)) (lex luo "ariyo" (number 2)) (lex luo "adek" (number 3))
(lex luo "angwen" (number 4)) (lex luo "abich" (number 5)) (lex luo "auchiel" (number 6))
(lex luo "abiriyo" (number 7)) (lex luo "aboro" (number 8)) (lex luo "ochiko" (number 9))
(lex luo "apar" (number 10))
(lex luo "alufu" (scale 1000))
(lex luo "ochulo" (paid)) (lex luo "nochulo" (paid)) (lex luo "chulo" (paid)) (lex luo "ooro" (paid))
(lex luo "gope" (owes))
(lex luo "nyoro" (when yesterday)) (lex luo "kawuono" (when today))
(lex luo "gi" (filler)) (lex luo "mar" (filler)) (lex luo "kod" (filler)) (lex luo "otuoro" (filler))

; ---------- What a token means ----------

(= (meaning (w $word))
   (let $found (collapse (match &self (lex $lang $word $m) $m))
     (if (== $found ()) (name-word $word) (car-atom $found))))
(= (meaning (n $num)) (digits $num))
(= (meaning (code $c)) (mpesa-code $c))
(= (meaning (date $d)) (on-date $d))

(= (meanings $toks)
   (if (== $toks ())
       ()
       (let* (($h (car-atom $toks)) ($m (meaning $h)) ($rest (meanings (cdr-atom $toks))))
         (cons-atom $m $rest))))

; ---------- Which language is it? ----------
; Count each language's words in the message. Words shared by several
; languages count for all of them; the language with the most wins.

; The message's tokens are also in &msg as (tok <i> <token>), so each
; language is scored with a single pattern match instead of a loop.
(= (lang-score $lang)
   (let $hits (collapse (match &msg (tok $i (w $word)) (match &self (lex $lang $word $m) hit)))
     (size-atom $hits)))

(= (better $a $b) (if (> (car-atom $b) (car-atom $a)) $b $a))

; Ties go to the earlier language in the list, so a message with Kikuyu
; or Dholuo words isn't swallowed by the Kiswahili words it shares.
; Sheng is built on Kiswahili, so any Sheng word in a Kiswahili-looking
; message makes it Sheng.
(= (language)
   (let* (($sheng (lang-score sheng))
          ($scored ((Scored (lang-score ki) ki)
                    (Scored (lang-score luo) luo)
                    (Scored $sheng sheng)
                    (Scored (lang-score sw) sw)
                    (Scored (lang-score en) en))))
     (pick-language (best-scored (cdr-atom $scored) (car-atom $scored)) $sheng)))

(= (pick-language (Scored $s $lang) $sheng)
   (if (> $s 0)
       (if (and (== $lang sw) (> $sheng 0)) sheng $lang)
       en))

(= (best-scored $rest $best)
   (if (== $rest ())
       $best
       (let* (((Scored $s1 $l1) $best) ((Scored $s2 $l2) (car-atom $rest)))
         (best-scored (cdr-atom $rest) (if (> $s2 $s1) (Scored $s2 $l2) $best)))))

; ---------- Amounts from number words ----------
; Kiswahili, Sheng, Kikuyu and Dholuo say the size first: "mia nane"
; is hundred x eight. English says it last: "eight hundred".

(= (scale-first $lang) (if (== $lang en) False True))

; Scale first: a scale takes the number right after it as its count.
(= (compose-after $ms)
   (if (== $ms ())
       0
       (let* (($h (car-atom $ms)) ($t (cdr-atom $ms)))
         (case $h (((scale $s) (after-scale $s $t))
                   ((number $n) (+ $n (compose-after $t)))
                   ($_ (compose-after $t)))))))
(= (after-scale $s $t)
   (if (== $t ())
       $s
       (case (car-atom $t) (((number $n) (+ (* $s $n) (compose-after (cdr-atom $t))))
                            ($_ (+ $s (compose-after $t)))))))

; Scale last: a number takes the scale right after it.
(= (compose-before $ms)
   (if (== $ms ())
       0
       (let* (($h (car-atom $ms)) ($t (cdr-atom $ms)))
         (case $h (((number $n) (before-number $n $t))
                   ((scale $s) (+ $s (compose-before $t)))
                   ($_ (compose-before $t)))))))
(= (before-number $n $t)
   (if (== $t ())
       $n
       (case (car-atom $t) (((scale $s) (+ (* $n $s) (compose-before (cdr-atom $t))))
                            ($_ (+ $n (compose-before $t)))))))

; Digits win over words: "800 bob" is 800.
(= (first-digits $ms)
   (if (== $ms ())
       none
       (case (car-atom $ms) (((digits $d) $d)
                             ($_ (first-digits (cdr-atom $ms)))))))

(= (amount $ms $lang)
   (let $d (first-digits $ms)
     (if (== $d none)
         (if (scale-first $lang) (compose-after $ms) (compose-before $ms))
         $d)))

; ---------- Paid or owes, M-Pesa or cash, when ----------

(= (first-of $ms $pattern-kind)
   (if (== $ms ())
       none
       (let $h (car-atom $ms)
         (if (== (kind-of $h) $pattern-kind) $h (first-of (cdr-atom $ms) $pattern-kind)))))

(= (kind-of (paid)) polarity) (= (kind-of (owes)) polarity)
(= (kind-of (method $x)) method) (= (kind-of (when $x)) when)
(= (kind-of (mpesa-code $x)) code) (= (kind-of (on-date $x)) date)
(= (kind-of (number $x)) other) (= (kind-of (scale $x)) other) (= (kind-of (digits $x)) other)
(= (kind-of (filler)) other) (= (kind-of (name-word $x)) other)

(= (polarity $ms) (case (first-of $ms polarity) (((owes) owes) ($_ paid))))

; A message with an M-Pesa code is an M-Pesa payment.
(= (method-of $ms)
   (case (first-of $ms code)
     (((mpesa-code $c) mpesa)
      ($_ (case (first-of $ms method) (((method $m) $m) ($_ unknown)))))))

(= (code-of $ms) (case (first-of $ms code) (((mpesa-code $c) $c) ($_ nocode))))
(= (when-of $ms)
   (case (first-of $ms date)
     (((on-date $d) (date $d))
      ($_ (case (first-of $ms when) (((when $w) $w) ($_ today)))))))

; ---------- Who? ----------
; Words the lexicon doesn't know are probably names. Score every
; contact by how many of those words appear in their name.

(= (name-words $ms)
   (if (== $ms ())
       ()
       (let $rest (name-words (cdr-atom $ms))
         (case (car-atom $ms) (((name-word $w) (cons-atom $w $rest))
                               ($_ $rest))))))

(= (add-names $ws)
   (if (== $ws ())
       ()
       (let $w (car-atom $ws)
         (let () (add-atom &msg (name $w)) (add-names (cdr-atom $ws))))))

(= (name-score $c)
   (let $hits (collapse (match &msg (name $w) (match &ledger (name-part $c $w) hit)))
     (size-atom $hits)))

(= (who $ws)
   (if (== $ws ())
       (nobody)
       (let* ((() (add-names $ws))
              ($scored (collapse (match &ledger (customer $c $n $ph $r) (Scored (name-score $c) $c)))))
         (let (Scored $s $c) (best-scored (cdr-atom $scored) (car-atom $scored))
           (if (> $s 0) (contact $c) (new-person $ws))))))

; ---------- The whole reading ----------

(= (read-message $toks)
   (let* (($ms (meanings $toks))
          ($lang (language))
          ($names (name-words $ms)))
     (Reading $lang (amount $ms $lang) (polarity $ms) (method-of $ms) (when-of $ms)
              (code-of $ms) (who $names) $ms)))
