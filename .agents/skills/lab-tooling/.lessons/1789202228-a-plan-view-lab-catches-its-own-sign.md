---
title: A lab that overlays furniture on a RENDER TARGET must flip z — clip +y is the target's first row, so world +z is UP in the cell while canvas +y is down
date: 2026-09-12
scope: pwa/src/tools/wake-preview.ts, scripts/wake-preview.mjs
concepts: [tooling, harness, render-target, screenshots, verification]
---

A lab that draws a game render target and then inks its own furniture over
the top — a craft's plan, a rule, an axis — is doing two coordinate
mappings that must agree, and they do not by default. The mark material
places a vertex at clip `(plan - box.xy) / box.z`; clip +y is the TOP of a
render target, which is the FIRST row of the canvas it is copied off. So
world +z reads UP in the cell while canvas +y is down.

Get it wrong and nothing errors: the overlay is mirrored about the cell's
centre, so the craft lands a map-offset the wrong side of where it is and
every mark astern of it reads as DETACHED and forty metres away. That looked
exactly like a broken effect, and two rounds went into the effect before the
lab was suspected.

What caught it was furniture that could be checked against itself: a dashed
heading axis drawn astern of the transom. A mark that is supposed to come
out of the nozzle either lies on that line or it does not, and the answer is
a glance. Draw the axis (or any other self-checking guide) in the FIRST
version of a plan-view lab, not after the first confusing sheet — and when a
brand-new lab and the thing it measures disagree, suspect the lab.
