---
title: A HUD dressing keyed on `daylight` dips the chrome in broad daylight — wire it to the LAMP (`lampsAt`), which is also a dimmer here, not a switch
date: 2026-09-11
scope: pwa/src/game/snapshot.ts, pwa/src/styles.css
concepts: [hud, night, sky, contrast, snapshot]
---

`HudSnapshot.daylight` is the obvious switch for a dark HUD and it is the
wrong one: those bands are about the SKY, not about how much light is on the
water. `DAY_ABOVE` is 10°, and a taiga WINTER level at 62°N — seed 38 — never
gets the sun above 8.9°, so its whole day reads `"dusk"`. A dressing on that
word dims the HUD at the brightest hour that seed ever sees, against a pale
overcast sea, which is exactly the background the white chrome was mixed for.

Key it on `lampsAt(sun.elevation)` instead — the craft's own lamp switch, the
same number `sky.ts` hands the beam as `Preset.lamps`. Then the instruments
and the light the rider is riding by can never disagree. Note what does NOT
port from the sibling rally game here: its cluster dips on one frame because
its headlamps snap to main beam, while `lampsAt` ramps over the four degrees
either side of the horizon, so ours has to ramp too — a stepping cluster
beside a fading lamp reads as two machines. In CSS that means one 0..1
custom property on `.hud` (written by `hud.tsx` off the snapshot) with every
dipped token a `color-mix` or a `calc` along it, rather than an attribute and
two blocks of overrides.

Two things worth carrying into the CSS itself: make `--hud-plate` bare
channels (`8 42 56`) so every plate keeps its own alpha off one number, and
restate `--hud-shadow: rgb(var(--hud-plate))` inside `.hud` — a `var()` in a
custom property resolves where it is DECLARED, so `:root`'s alias keeps the
day navy however far the HUD's own plate ramps.
