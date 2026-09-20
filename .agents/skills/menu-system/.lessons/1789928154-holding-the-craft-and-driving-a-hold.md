---
title: A hold with no receipt cannot be told from a broken one — and driving a seven-second hold headless needs POLLING, because a card over a live sea runs at well under wall clock
date: 2026-09-20
scope: pwa/src/game/menu-hold.ts, pwa/src/game/craft-picker.tsx, pwa/src/game/craft-turntable.ts, pwa/src/game/menu-main.tsx
concepts: [hold, developer, timers, verification, screenshots, craft-card, turntable]
---

The seven-second hold was reported as no longer triggerable. It still fired;
what it had stopped doing was SAYING SO, and that is the same thing to
everybody who is not reading the source.

**A hidden door still owes an answer the moment it opens.** The hold sat on
the front door's RACE tile, which draws nothing while held (right — a door
meant to stay hidden cannot advertise itself to everybody who rests a thumb
on it) and whose only lasting receipt was a chip in the foot strip the player
had to look away to notice. Seven seconds of nothing, then nothing: a feature
with no answer reads as a feature that broke. It is on the CRAFT CARD's
turntable now, and the move pays twice. Nothing presses a picture, so there
is no click to swallow on the way out and the whole `takePress` /
`armed`-across-the-release dance went with it — that subtlety only ever
existed because the hold was on a button whose ordinary job was to start a
run. And the hull is ALREADY TURNING, so the card can answer by turning it
differently: two revolutions on a raised cosine, eased in and out, back to
the steady spin. Put the curve in the DOM-free module beside the hold rather
than in the three.js stand — the stand only integrates it, so the receipt is
a thing the suite reads.

**A ONE-SHOT timeout whose callback re-checks against another clock must
re-arm.** `setTimeout(…, left)` then `tickHold(hold, performance.now(), …)`
is two clocks, and a browser may deliver a wake a fraction early or have
coarsened `performance.now()` under it. A callback that finds 6999 ms and
simply RETURNS leaves nothing scheduled and an effect whose deps have not
changed — a finger held all afternoon and a hold that never fires. `holdWait`
is where that rule now lives, in the tested module: a wake `tickHold` refuses
is by definition one that still owes time, so the wait after it is never zero
and the loop cannot spin.

**Do not assert a hold's length against the SESSION's wall clock.** The card
stands over a live bot-ridden sea, and headless on a software rasterizer that
runs well under real time: a 7000 ms hold measured as flipping the setting
after **11.3 s** of wall clock. Two sessions read that as a broken hold and
went hunting. Poll for the change (a cheap `evaluate` every 120 ms, a 20 s
ceiling) and report WHEN it flipped; only "never" is a failure. The same slack
applies to anything else here timed in seconds.

**THE CRAFT CARD CANNOT BE FILMED HEADLESS, so a short figure on it is
verified in the suite and not in the lab.** Four probes went looking for the
flourish and all four failed, each in its own way: a `drawImage` copy of the
stand's canvas reads back ALL ZEROS (no `preserveDrawingBuffer`) and prints a
confident 0.00 rather than failing, so it reports a dead spin for a turning
one; comparing PNG BYTES is swamped by compression (a steady spin and a
whipping one differed by 4%); a `requestAnimationFrame` sampler got six
frames in fourteen seconds; and `page.screenshot({ clip })` on the stage —
which does work, decoded back INSIDE the page through an `Image` onto a 2D
canvas — costs about TWELVE SECONDS a shot, because the card stands over a
live bot-ridden sea with a second three.js context beside it. The whole
figure is 2.6 s. Nothing sampled four times slower than the event can see it.
So the shape of the receipt belongs in the DOM-free module where the suite
reads it outright (`flourishRate`: the turns it sweeps, zero at both ends,
never negative, an order of magnitude past the steady spin), and the stand is
left with arithmetic short enough to read. What the lab CAN still answer here
is the hold itself, because a setting flipping is one cheap `evaluate`.
