---
title: A card that waits on a worker must be the size it WILL be — give the picture its own PLATE and size the plate, never the picture
date: 2026-09-16
scope: pwa/src/game/seed-preview.tsx, pwa/src/styles.css
concepts: [start-card, seed-preview, layout, viewports, screenshots]
---

The start card is up and pressable for hundreds of milliseconds before the
seed's chart arrives, and the box under the SHORE row was sized by its
CONTENTS: a word's height while waiting, a square chart's afterwards.
Measured on the built site, the card went 440 → 629 px at 1280×720 and the
head's NEXT moved 94 px UP the screen — the card is centred, so growth pushes
every button away from the press already aimed at it.

The fix is a WRAPPER that is sized while the picture is not. The square
(`width: 100%; max-width: min(14rem, 22vh); aspect-ratio: 1`) belongs on a
plate the waiting word sits inside; the svg fills what it was given
(`width/height: 100%`). The slot's height is then a function of the column and
the viewport alone, which is the only kind that cannot change when a reply
lands — and the desktop override moves with it, because it is the PLATE that is
half again as big at `min-width: 48rem`, not the chart. A guessed `min-height`
in its place is always too small to be the reservation it claims to be.

VERIFY BY MEASURING BOTH STATES, not by photographing the card. Every lab shot
is the SETTLED card — `scripts/screenshot.mjs` waits on `.seed-preview` with a
2.6 s settle — so the state that jumps is never in a picture and never in a
diff. A scratch playwright script that reads `getBoundingClientRect().height`
of `.menu-card-start` when `.seed-preview` first exists and again once
`.seed-preview-map` does, at both reference viewports, prints the regression as
two numbers. `page.route` on `**/seed-preview-worker*.js` with a `setTimeout`
before `route.continue()` holds the worker back long enough to photograph the
waiting card too.
