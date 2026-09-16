---
title: A card that waits on a worker must be the size it WILL be, and the slot's height has to come from the LAYOUT, never from what is in it
date: 2026-09-16
scope: pwa/src/game/seed-preview.tsx, pwa/src/styles.css
concepts: [start-card, seed-preview, layout, viewports, screenshots]
---

The start card is up and pressable for hundreds of milliseconds before the
seed's chart arrives, and the box under the SHORE row was sized by its
CONTENTS: a word's height while waiting, a square chart's afterwards.
Measured on the built site, the card went 440 → 629 px at 1280×720 and the
head's NEXT moved 94 px UP the screen — the card is centred, so growth pushes
every button away from the press already aimed at it. `min-height: 9.5rem`
was in there for exactly this and was simply too small to be the reservation
it claimed to be; a guessed height always is.

The fix has two halves, and the second is the one that hides:

- **Give the picture its own PLATE and size the plate, not the picture.** The
  square (`width: 100%; max-width: min(14rem, 22vh); aspect-ratio: 1`) moved
  off the `svg` onto a wrapper the word waits inside; the svg fills what it
  was given (`width/height: 100%`). The slot's height is then a function of
  the column and the viewport alone, which is the only kind that cannot
  change when a reply lands. The desktop override moves with it — it is the
  PLATE that is half again as big at `min-width: 48rem`, not the chart.
- **A text line reserved with `min-height` needs its `line-height` stated
  too.** Rendering the reading's `<p>` always, empty until there is one, with
  `min-height: 1em`, left 5 px of jump: an empty box is `min-height` and a
  filled one is the INHERITED line-height (~1.5), which is not 1em. Pin both
  to the same number (`line-height: 1.4; min-height: 1.4em`) and it is zero.

VERIFY BY MEASURING BOTH STATES, not by photographing the card. Every lab
shot is the SETTLED card — `scripts/screenshot.mjs` waits on `.seed-preview`
with a 2.6 s settle — so the state that jumps is never in a picture and never
in a diff. A scratch playwright script that reads
`getBoundingClientRect().height` of `.menu-card-start` when `.seed-preview`
first exists and again once `.seed-preview-map` does, at both reference
viewports, prints the regression as two numbers. `page.route` on
`**/seed-preview-worker*.js` with a `setTimeout` before `route.continue()`
holds the worker back long enough to photograph the waiting card too.
