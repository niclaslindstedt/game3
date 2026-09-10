---
title: The measured rows in `docs/riding.md` go stale silently — re-measure the baseline off a stashed tree rather than trusting a documented number
date: 2026-09-10
scope: docs/riding.md, engine/game/defs/craft.ts
concepts: [docs, tuning, measurement]
---

`docs/riding.md`'s catalog table carries MEASURED columns (top speed, 0–50,
rest draft, tightest radius, the settled turn) that no test holds. Nothing
fails when they drift, so they drift.

This session read the dart's tightest radius as 39 m from that table, measured
15 m after the change, and nearly reported a 2.6× move as the size of the
roster change. Measuring the actual baseline — `git stash push`, run the
bench, `git stash pop` — gave 24 m, so the real move was 37%. The doc's 39
had been stale since some earlier pass.

So: any claim about "how much this changed" that sources its BEFORE from a
doc is a claim about the doc, not about the code. Take the before yourself,
with the same bench that takes the after, and refresh every measured row the
change touches in the same PR — the tightest radius, the settled turn, the
sheet's measured columns, and the draft.
