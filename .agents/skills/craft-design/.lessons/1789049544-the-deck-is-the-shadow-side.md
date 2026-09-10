---
title: Under a low sun the deck is the SHADOW side of the craft, so a few per cent of a sunset sky mirrored on it outweighs its own colour — keep the deck's finish well under the shell's, or the teal goes pink at every chase angle
date: 2026-09-10
scope: pwa/src/game/craft-surface.ts, pwa/src/game/craft-styles.ts
concepts: [chase-view, colour, lighting, mirror, finish]
---

The chase camera looks down on the deck from behind, and at dawn and dusk
the sun is ahead, so what it sees of the deck is the side the key never
reaches: a dark teal lit by the hemisphere alone, a few hundredths in linear
light. The surface's sky mirror (`craft-surface.ts`) is written to physics —
four per cent face-on, most of the sky at grazing — and a physically small
share of a bright sky is still more light than that deck has, so at the
deck's first pass (finish 0.85, weighed linearly) the whole deck came back
pale pink under every low sun and pale cyan at noon, while the white shell
beside it looked right. The wash was not the highlight: a debug build that
wrote Fresnel, gloss and the reflected sky's luminance into the three colour
channels put it on the mirror in one shot, where three rounds of retuning
the specular had moved nothing. The fix is in the FINISH table, not the
mirror: the deck is satin (0.35), the finish weighs both terms SQUARED, and
the shell stays at one — that is what lets the deck keep the colour the
styles are built on while the gel coat beside it takes the sunset. Judge any
change to a finish at `--hour 20.6` and `--hour 5.2` before noon; noon
forgives what a sunset does not.
