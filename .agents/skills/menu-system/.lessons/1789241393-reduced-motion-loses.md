---
title: A `prefers-reduced-motion` rule must be stated at the same weight as the rule it overrules — a bare class loses to a two-class animator silently, and being LATE in the file does not save it
date: 2026-09-12
scope: pwa/src/styles.css
concepts: [reduced-motion, animation, styles, splash, loading]
---

`@media (prefers-reduced-motion: reduce)` does not raise specificity. A block
listing `.mark-wave-wipe { animation: none }` is `(0,1,0)` and loses outright
to `.mark-wave-once .mark-wave-wipe { animation: mark-wipe … }` at `(0,2,0)`,
however much later in the file it sits. The app's wave had been drawing itself
on regardless of the setting since it was written, on the attract card, the
front door's wordmark and the loading card alike, and nothing said so.

It fails SILENTLY in the worst direction the day a delay is added: with
`animation-delay` on the animator and `fill: both`, the dead rule leaves the
mark parked on the wipe's FIRST frame — a faint ghost that never fills —
rather than merely moving when it should not.

So: write the reduced-motion selector at the weight of the rule it is
overruling (`.mark-wave .mark-wave-wipe`, `(0,2,0)`, after it), not at the
weight that reads tidiest. And when a card's motion is stopped, check what it
PARKS at: `animation: none` leaves the element at its natural value, which has
to be the animation's LAST frame for the information to survive. Here both
halves of the wipe park at `transform: none`, which is the window over the
whole shape — the mark standing finished, which is what the setting asks for.

Verify it: `newPage({ reducedMotion: "reduce" })`, then assert
`document.getAnimations().length === 0`. A screenshot alone cannot tell a
parked animation from one caught at the right moment.
