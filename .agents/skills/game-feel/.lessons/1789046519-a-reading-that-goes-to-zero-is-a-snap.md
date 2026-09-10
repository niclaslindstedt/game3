---
title: "\"No weight\" is a reading that goes to ZERO at a state change, not a rate that is too high — and a mass pays for itself with the bounce"
date: 2026-09-10
scope: pwa/src/game/camera.ts, pwa/src/game/camera-rigs.ts, pwa/src/lib/sprung.ts
concepts: [camera, flight, landing, springs, jolt, measurement]
---

Reported as "too twitchy when it goes airborne and lands — no inertia". The
instinct is to lower a follow rate; every rate in `camera.ts` was already
eased. The twitch was the FLIGHT ROD, which was not eased at all:
`gamma` was recomputed each frame as `airborne ? atan2(vy, planSpeed) : 0`,
so the frame a probe touched water the reading went to zero and a boom hung
out over a falling craft arrived level in ONE frame. Measured as the second
difference of the lens height (the right column — travel and on-screen wander
both read the sea and say nothing): **3.70 m at the landing, 0.10 m after**.
Look for this shape wherever a reading is gated on a boolean: easing the
VALUE does nothing when the TARGET jumps.

A sprung mass (`lib/sprung.ts`) pays twice. It cannot be stopped, so at the
landing it swings THROUGH the horizontal — the boom dips under its natural
angle, the lens drops and comes back up. That is the landing's punctuation
for no extra mechanism, and its size is a share of what the rod wound on to,
so a hop off chop barely shows it and a long drop gives the landing weight.
ζ = 0.55 at 1.15 Hz put the dip at ~3.5° (0.4 m of lens) over a second, which
read as "subtle"; ζ = 1 removes it and the landing is a stop again.

Two things the spring needs that the ease did not: clamp the raw path angle
short of the vertical at BOTH ends (no plan speed under a vertical drop means
`atan2` runs to 90°, and a rod stood straight up puts lens, hull and aim on
one line — the shot tumbles), and `drop()` it wherever the rig restands.

Assert both directions: the first bounce test (peak standoff > settled)
passed on the OLD code too, whose standoff decayed past that anyway. What
separates a mass from an ease is the landing frame itself — a mass is still
wound over the craft there (standoff SHORT), an ease is already home.
