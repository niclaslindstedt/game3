---
title: The probe layout is cached by `spec.id`, so an in-process A/B of a hull-geometry knob silently measures the FIRST variant three times
date: 2026-09-10
scope: engine/game/hull.ts
concepts: [probes, hull, tuning, measurement]
---

`hullProbes(spec)` memoises on `spec.id` alone (`cache` in `hull.ts`). Any
bench that builds variants with `{ ...craftById("skiff"), someGeometryKnob: x }`
gets the layout built for the FIRST `x` on every subsequent call, and the
readings come back identical to three decimal places — which reads as "the
knob does nothing" rather than as a broken measurement.

It bit this session on `bowRise`: three values, byte-identical results, and
the wrong conclusion drawn for a round. The tell is suspiciously EXACT
agreement — a knob that genuinely does nothing still moves the last digit
through the chaos of a wave field, so identical-to-the-decimal is a cache,
not a null result.

Give each variant a unique id (`id: \`bow${x}\` as CraftSpec["id"]`), or run
each variant in its own process (edit the catalog, run the lab, edit again —
which is what `make sim CRAFT=<id>` between edits does correctly).

This applies to any knob `hullProbes` reads: the dimensions, `deadrise`,
`cog`, `displacement`, `bowRise`. Knobs read per STEP rather than at layout
time (`sponsonBite`, `ridePlate`, `riderAuthority`, `boost`, the bucket) are
unaffected and A/B fine in one process.
