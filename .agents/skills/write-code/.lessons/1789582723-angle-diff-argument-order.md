---
title: `angleDiff(a, b)` is `b - a` — the reference angle goes FIRST, and getting it backwards is a clean sign flip no symmetric test catches
date: 2026-09-16
scope: engine/lib/math.ts
concepts: [maths, conventions, tests]
---

`engine/lib/math.ts`'s `angleDiff(a, b)` returns the signed shortest `b - a` in
(-π, π]. Reading it as "the difference between a and b" and writing
`angleDiff(heading, reference)` gives the NEGATIVE of what you meant.

It is worth its own lesson because of how it fails: a pure sign flip is
invisible to any test whose cases are symmetric about zero, and to any
round-trip that inverts with the same mistake. A new `windQuarter(level, from)`
shipped as `angleDiff(from, level.seaHeading)` and passed "reads dead onshore as
zero"; what caught it was the one case that was not symmetric — a quarter of
-π/2 pushed through `windFromQuarter` (which wraps to 0..2π) and read back.

So when a new function is a signed angle RELATIVE to something, write the
reference first (`angleDiff(reference, measured)`) and include at least one
asymmetric case in the test: a negative angle taken through a wrap. "It came
back as zero" proves nothing about the sign.
