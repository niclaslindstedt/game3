---
title: R9's beam was measured on the curve the window replaces instead of on the chord it becomes — a search rule read off the wrong geometry is a rejection paid for a whole build later
date: 2026-09-10
scope: engine/mapgen/course.ts
concepts: [air-gates, search, rejection, beam, performance]
---

`layCourse` straightens an air gate's window into a CHORD, so the heading a
rider rides the run-up on is the chord's. `acrossTheSea` was reading the
path's heading at the hinge — the curve's — and passing windows the
analysis then failed with `R9.beam` after the level had been built,
compiled and analyzed. Over 24 seeds that was 59 rejections of the dearest
kind; reading the chord instead left 2.

Two things fall out of it, and the second is easy to miss:

- The check has to run AGAIN in the final loop beside `chordOk`, because
  straightening one window moves every window after it.
- Fixing it makes `the basin cannot carry a course` go UP (the same
  failures, found for a tenth of the price) — so read the reason tally as a
  whole rather than one line of it. Mean build fell from 726 ms to 588 even
  as that count rose.

And it changed a tuning number the old measurement had settled:
`search.courseTries` was 8 with a note that the curve was flat past four.
With the beam read honestly, and with R25's leg taking a third of the
course out of the running for a jump, 40 is where it flattens now (24 seeds
built at 630 ms against 21 at 770).
