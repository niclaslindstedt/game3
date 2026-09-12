---
title: A staged test can pass for a reason its comment does not name — check WHICH event fired before you believe the staging, and never assert on a reading that sits on an asymptote
date: 2026-09-12
scope: tests/
concepts: [tests, measurement, staging, bench]
---

Two tests broke on a hull retune, and neither was a regression. Both were
measuring something other than what they said.

**`tricks_test`'s bail case** said it staged a capsize ("rolling the hull onto
its back and holding it there — a capsize is a bail") and was in fact bailing
via a `dive`: the rolled hull stuffed its bow, and the dive fired. A capsize
cannot reach an open combo at all — `capsize.after` is 1.5 s and the combo's
`linkWindow` is 1 s, so the hull always banks before it is declared over. The
retune stopped the bow burying, the dive stopped firing, and the test failed
for the right reason about the wrong mechanism. **When a test asserts "event X
happens", assert on X, not on a downstream consequence that several events can
produce** — and if the event it names is unreachable, the comment is the bug.

**`tuck_test`'s head-wind case** asserted a time-to-90 km/h into a 14 m/s blow
was 20% shorter tucked. The sat-up hand reached 90 at 35.5 s in a 40 s window —
it was reading the asymptote, two km/h under its own ceiling. A 1.7 km/h change
in that ceiling took it from 35 s to 9 s and the ratio from 0.28 to 0.84, while
what the tuck actually buys (1.75 → 1.85 km/h into the blow) did not move.
**Never assert on a time-to-speed near a craft's ceiling.** Quote the lead at
two fixed times instead; that is the claim, and it is stable.

The check that settles both: after restaging, run the rewritten test against
the BASE branch too. If it passes there as well, it is a better test. If it
only passes on your tree, you fitted it to your change.
