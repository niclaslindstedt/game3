---
title: A shape number stated absolutely while the thing it shapes is scaled by another rule makes rejection STRUCTURAL — raise the try budget once to tell that apart from bad luck
date: 2026-09-16
scope: engine/mapgen/river.ts, engine/mapgen/route.ts, engine/mapgen/rules.ts
concepts: [river, route, search, rejection, rules, curvature]
---

R26's meander turned at one radius (`river.radius`, 38 m) while its water was
the corridor's — up to ~95 m of half-width at the mouth. A channel that wide
bending on that radius cannot avoid itself, so when a self-clearance rule was
added, `drawRiver` started returning null for whole classes of route and the
reroll rate went 0.70 → 0.90, past `mapgen_population_test`'s 0.85 bar.

The diagnostic that settled it in one sweep: **raise the walk's try budget and
watch the rejection COUNT.** 16 → 96 tries moved "no river will run inland"
only 184 → 164. Stochastic failure falls off geometrically with tries;
structural failure barely moves. Do that measurement before tuning anything —
it tells you whether you are looking for a luckier draw or for a rule that
contradicts another rule.

The fix was to state the shape against the thing it shapes: the bend radius is
`river.bendWidths` of the LOCAL half-width with the old constant as its floor,
and the self-clearance span is a multiple of that bend's own hairpin rather
than a distance. Reroll rate came back to 0.67.

That needed the width to be known DURING the walk, which it was not: the taper
was keyed on `i / (points.length - 1)` and the length is not known until the
walk ends. Keying it on how far INLAND the walk has got — against the reach
target drawn before the first step — is both computable at every step and the
truer model (a river thins because its catchment shrinks, not because it
wandered).

`engine/mapgen/route.ts` has the same pair of levers done right (a soft push
plus a hard rejection); a walk that keeps being rejected wants the push, but
only after you have ruled out a contradiction like this one.
