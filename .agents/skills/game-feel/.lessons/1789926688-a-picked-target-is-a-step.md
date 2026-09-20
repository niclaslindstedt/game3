---
title: A target that is PICKED rather than measured is a step, and a step is eased with a DURATION, not with a follow rate
date: 2026-09-20
scope: pwa/src/game/camera-menu.ts
concepts: [camera, framing, menu, easing, jump, motion]
---

Reported as "clicking around the main menu makes the drone view jump". Every
continuous quantity in that shot was already eased — the bearing onto the way
the water lies, the standoff onto what the channel allows, the composed point
onto the craft — and none of them was the fault. The jump was `anchorFor`,
which does not MEASURE a target but PICKS one: four bands round the card,
weighed, best wins. Every page of the door is a different card (30 rem at the
door, 36 at OPTIONS, 40 at the campaign, 52 at the gallery), so a page turn
moves the anchor a tenth of the frame at the least, and a short card flips the
pick from a side band to the floor outright — the rider crossing the frame in
one frame. **Look for this wherever a reading comes out of an `argmax`, a
lookup or a branch: easing everything that feeds it does nothing, because the
step is in the choice.**

The ease it wants is not the one beside it. `x += (want - x) * clamp(rate*dt)`
is a TRACKER — right for a signal that is always moving, wrong for a step,
because it leaves at full speed and the leading edge is the whole of what
reads as a jump. A fixed duration on a smoothstep (`t*t*(3-2t)`, one second)
starts and ends at zero speed, which is what an operator walking a subject
across the frame gives. Keep a floor on what restarts the flight
(`reframeLeast`), or a card settling through a resize observer re-launches it
every frame; under the floor, track the target directly.

**And it cannot be photographed.** In headless each `page.screenshot` is both
the camera and the vsync, and one costs ~9 s here — so the app sees a 9 s dt
and any move under that duration completes inside a single frame. A burst of
shots after a simulated click shows the two endpoints and nothing between
them. The honest measurement is the unit case: run the rig, swap the frame's
card, and assert the rider has barely left on the NEXT frame (a cut lands the
whole walk there — 0.27 of the frame, against 0.002 flown) and has arrived a
second later. That case fails the old code, which is the only thing that
makes it worth having.
