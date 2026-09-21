---
title: The shell's box has TWO failure modes that look identical on a phone, and only measuring a bug shot against a lab shot tells them apart
date: 2026-09-21
scope: pwa/src/styles.css, pwa/src/lib/visible-viewport.ts, pwa/src/lib/viewport.ts
concepts: [layout, viewports, ios, shell, screenshots, debugging]
---

A player's photograph of the game sitting in a band at the top of the screen
with flat `--sea` below has two possible causes, and they need opposite fixes:
the shell LAID OUT short (the viewport unit resolved small), or the shell laid
out correctly and the browser showing only part of it (the visible window
displaced inside the layout viewport by a software keyboard).

They are told apart by measurement, not by reasoning. Shoot the same surface
with `make screenshots --viewport landscape`, find the same HUD feature in
both, convert to CSS px by each picture's own dpr, and subtract. A CONSTANT
offset across two independent features means the page is laid out right and
merely displaced — the cluster sits where a full-height page puts it. A
bottom-anchored cluster that has moved UP toward the band's own bottom edge
means a short layout. One iPhone shot measured 245 px of constant offset on
both the ALTITUDE label and the speed numerals, which is a landscape keyboard
(393 − 148 visible).

The displacement fix must publish only the DISPLACEMENT, never a measured
height. `--shell-height` has to stay a unit: `100vh` reaches the physical
bottom of an iOS screen where `window.innerHeight` stops at the letterboxed
layout viewport, so writing a measured height over it hands back the dead band
the unit exists to escape. Publish `--shell-top` / `--shell-bottom` in px and
let CSS subtract them (`--shell-visible`); both are 0 when nothing is
displaced, so the undisplaced layout is byte-for-byte what it was.

Every `position: fixed` surface needs the same treatment — `#root`, `.splash`
and `.knob-caption` are all laid out against the layout viewport, not against
`#root`, so fixing only `#root` leaves the others behind.
