---
title: A readout sized by a CSS variable owns its whole `transform` — animate the arrival with opacity, and nest anything hung off its edge INSIDE the part that pulses
date: 2026-09-11
scope: pwa/src/styles.css, pwa/src/game/hud.tsx
concepts: [css, hud, animation, layout, custom-properties, sizing]
---

Driving a readout's size from the snapshot (`style={{ "--air-grow": … }}`,
then `transform: translateX(-50%) scale(calc(1 + k * var(--air-grow)))`)
works and is cheap — a `transition` on `transform` smooths the snapshot's
twelve ticks a second into growth rather than a staircase. Two traps come
with it:

- **A keyframe on the same element replaces the WHOLE transform**, centring
  included, so an arrival animation there has to restate `translateX(-50%)`
  and the scale's `calc` — and then it is frozen at whatever `--air-grow`
  was when it mounted. Animate `opacity` only and leave `transform` to the
  size; a fade is the subtler arrival anyway. Set `transform-origin: top
  center` too, or a growing readout pinned under `env(safe-area-inset-top)`
  expands up under the notch.
- **An absolutely-positioned sibling at `left: 100%` is anchored to the
  UNSCALED box.** Put a `scale` pulse on the tile and it eats the gap from
  the inside — half the growth each side — and on a phone the two touch.
  Nest the tag INSIDE the element that pulses (`position: relative` on it)
  and the gap rides the same transform.

Measure both the gap and the badge's line box in the readout's own size
(`--air-size`, declared once and read by the number and the tag), rather
than in the badge's small `em` or a second copy of the clamp: the pair then
keeps its proportions from 1280×720 down to 390×844.
