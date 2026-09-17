---
title: A button over a RUN cannot be wired on `onClick` — `click` is the primary pointer's alone, and a ridden craft has that finger spoken for
date: 2026-09-17
scope: pwa/src/game/hud-press.ts, pwa/src/game/hud-actions.tsx, pwa/src/game/minimap.tsx, pwa/src/game/update-button.tsx
concepts: [touch, pointer-events, hit-testing, buttons, multi-touch, hud]
---

CAMERA, RESET, the minimap and the new-build mark were all `onClick`, and all
four were dead to a rider holding the handlebar or the throttle — which is
every rider who reaches for them. `click` is an ACTIVATION event synthesised
from the PRIMARY pointer, the first finger on the glass. On a phone riding
this game that finger is always in a thumb zone, so a tap on a button is a
NON-PRIMARY pointer, and the browser hands it `pointerdown` and `pointerup`
and nothing else. Chromium at 390×844 with touch on, on the built site:

```
button alone   pointerdown(primary=true)  pointerup  click
zone held      pointerdown(primary=false) pointerup  —        ← all four
```

iOS is stricter still (it suppresses the compatibility cascade for a
multi-touch gesture outright), so this is the floor and not the worst case.

**This is not the clearance question, and neither is evidence about the
other.** The zone lesson is about glass in FRONT of a button eating the
touch; here the hit test lands, the button hears the touch, and the action
never runs. Both failures read identically to the player — "it swallowed my
tap" — so probe for BOTH: `elementFromPoint` down the centreline answers the
first, and a listener tally under a HELD finger answers this one. The tally
is the cheap one and nobody had run it.

The fix is `hud-press.ts`: fire on `pointerup` inside the button's own box,
and swallow the `click` that may follow within 700 ms. The swallow is
load-bearing rather than defensive — measured, a LONE tap delivers
`pointerdown`, `pointerup` AND `click(non-primary)`, so without it every
ordinary tap on CAMERA would step two rungs. A mouse is deliberately left on
the click path: it has a real activation path (drag-off cancel, the secondary
buttons, Enter and Space on a focused button arriving as clicks) and
reimplementing that from pointer events loses more than it fixes.

**Prove a press moves ONE rung by racing it against the keyboard.** A tap that
fires twice and a tap that fires once both land somewhere on a cyclic ladder,
so counting taps proves nothing. One C press is known-single: screenshot it
beside one tap, and beside two C presses. Three distinct framings with the tap
matching the single press is the whole proof, and it takes one script.
