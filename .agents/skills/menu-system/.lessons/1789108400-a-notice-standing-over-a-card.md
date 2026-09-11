---
title: Anything that has to stand OVER a card needs a z-index of its own — the menu is a full-screen wash, so the corner it lands in is dimmed and unpressable without one
date: 2026-09-11
scope: pwa/src/App.tsx, pwa/src/styles.css, scripts/screenshot.mjs
concepts: [surfaces, shell, layout, viewports, screenshots, update]
---

Putting the new-build notice over the front door as well as over a run is
three small things, each with a trap.

**The layer.** `.hud` is `inset: 0` with no z-index and `.menu` is 1500, so a
notice rendered before the menu is painted UNDER the card's wash: visible,
dimmed, unpressable. One class (`.hud-over-card`, 1600), applied only on the
menu so a run's corner keeps the stacking it had. Pick the number against the
whole ladder rather than "big enough": the loading card (1800) and the attract
card (2000) are the app covering its own screen, and a notice over a cover is
a notice over nothing — staying BELOW those two is the design.

**One mount, not two.** The HUD hosts the notice when it is up and a
standalone corner box when it is not, so the box's condition must be exactly
the negation of the HUD's own (`!hudUp`, the whole predicate, `snap !== null`
included) or both draw for the frames before the first snapshot.

**Any fixed corner is under a card at 390×844.** `.menu-card` is
`max-height: 100%` in a 1rem gutter, so a card long enough to need the height
(OPTIONS) reaches within a few pixels of every corner, and moving the mark
only changes which page it overhangs. Hold the line at over the card's EDGE,
never over a control, and read that off the shots.

The lab had a matching hole: `--update` was spliced into the SCENE url only,
so `--surface menu --update` photographed a card with no notice and looked
like the feature had not landed. A flag naming a piece of chrome has to reach
every surface that chrome stands over.
