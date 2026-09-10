---
title: DETAIL high is the wood and its mirror — a few per cent of the frame's pixels — and a picture stop is judged by a pixel diff per weather, never by its cost
date: 2026-09-10
scope: pwa/src/game/settings-video.ts, pwa/src/game/cloud-field.ts, pwa/src/game/water-shader.ts
concepts: [options, video, detail, sky, reflection, flora, screenshots, performance]
---

Measured on seed 38 at 1280×720, `screenshot.mjs --detail medium` against
`--detail high`, pixels moved by more than 24/765: under rain 3 % of the
sky half and 2 % of the sea half; clear noon 6 % and 2 %; fair-weather
cumulus 5 % and 2 %; the river scene, shore on both sides, 12 % and 5 %.
The diff image is the wood on the shores and its strip of reflection along
the waterline, and nothing else — not the sky, not the rings, not the
water under the craft. For that the top stop bills 42 % more triangles,
2.25× the mirror's pixels and twice the rain.

Two halves of that bill bought NOTHING, and the code said why once it was
read for it: the cloud chart (`dressSky`) never deals more than two sheets
(a ceiling and its scud, or a veil and its cumulus), so `SKY_LOOK.high`'s
third layer had never compiled — `tests/video_test.ts` now holds the top
stop to exactly the most the chart deals — and the water read the mirror
1.5 mip levels down whatever its size, so a bigger texture was the same
smear; the blur is on the ladder now (`REFLECTION_LOOK.blur`).

The rule: a stop's promise is checked by diffing it against the stop under
it, per weather, because a lever can be dead on every sky but one (the
rings are nothing under a clear sky; the sheets are nothing under a clear
sky). A structural profile cannot see any of this — draws and tris move
only for the flora — and a cost that moves without a picture moving is the
page inventing work to sell. `scratchpad/pixdiff.mjs`-style: load both
PNGs into a canvas in the preinstalled Chromium, count pixels over a
tolerance by frame half, paint the movers magenta and LOOK at where they
are.
