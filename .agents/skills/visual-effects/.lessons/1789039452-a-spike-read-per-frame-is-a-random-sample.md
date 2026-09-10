---
title: A per-STEP spike read once per FRAME is a random sample of itself — and the slower the machine, the more of the feel it drops
date: 2026-09-10
scope: pwa/src/game/rumble.ts, pwa/src/App.tsx, pwa/src/game/audio/ride-bed.ts
concepts: [haptics, rumble, slam, frame-rate, sampling, feel]
---

`CraftState.slam` is written every step and zeroed the moment the hull is riding rather than landing, so at 120 Hz it is a spike a couple of steps wide. Reading it in the frame loop — which is what the chop bed does beside it, and what the vibration table did in its first pass — samples one step in two on a phone holding 60 and one in twenty on a phone that is struggling. That is not "less of the chop on a slow machine": it is a RANDOM fifth of it, and the hardest slap of a crossing is as likely to be missed as any other.

The fix is a two-call surface. `step(craft)` runs inside the step loop and keeps the HARDEST reading since the last payout; `frame(dt)` advances the clock and pays that one out, at most one per gap. Measured against the built app driven headlessly at ~7 fps over 25 s of RUN time (the run clock, not the wall clock — headless Chromium runs the loop at about an eighth of real time): 8 slaps before, 22 after, with the event-driven blows unchanged at 7 because events were never frame-sampled. Keep the pending reading ACROSS frames rather than dropping it, or a slap that lands inside the gap is thrown away instead of felt when the gap closes.

Two things worth knowing before measuring any of this:

- **Ride it with `botInput`, not a held throttle.** A scratch probe holding `throttle: 1` from the start line barely moves (0.1 m/s) and reports a peak slam of 0.01 g; the bot riding the course at pace crosses 0.35 g seven to ten times a second and hits the physics' cap of 7 g. The second figure is the one a threshold is sized against.
- **A held key in headless Chromium needs `window.__SH_READY__` first.** Before that flag the loading card is up, `playerRides` is false and every keystroke is dropped — the craft simply never moves and the probe reports a clean zero, which reads as "the feature does not work".
