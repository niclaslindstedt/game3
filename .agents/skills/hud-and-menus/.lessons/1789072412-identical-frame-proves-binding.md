---
title: Prove a binding landed by what it CHANGES — the DOM when the press is rendered, an identical frame hash on one seed when it is not
date: 2026-09-10
scope: pwa/src/game/input.ts
concepts: [input, keys, screenshots, verification, determinism]
---

**First ask whether the DOM reports the press at all.** A key that changes
what is RENDERED — the HUD's own switch, a card coming up — is settled by a
scratch probe in `previews/` reading `document.querySelector(".hud-speed")`
after `page.keyboard.press("KeyH")`, with a reload afterwards to prove the
answer was STORED rather than held in a frame's state. The hash below is for
the presses the DOM does not report.

A run is deterministic per seed, so a scripted input sequence photographed at
the same moment gives the same PNG bytes every time. That turns the engine's
determinism into an assertion about the key map: drive the same URL twice with
the same scripted inputs, changing only the key code held, and `md5sum` the two
frames.

Verifying `↑` had become lean-forward: held `KeyW` for a fixed stretch, then
held one lean key for three seconds and shot the frame, once per key.
`ArrowUp` and `ShiftLeft` came back with an IDENTICAL hash, while neutral and
`ArrowDown` each differed — which says `↑` and Shift reach the same
`KeysHeld` field, and says it without any way to read `GameState` from the
page (nothing exposes it; `window.__SH_READY__` and `__SH_COST__` are all
there is).

Cheaper and stronger than eyeballing two pictures of a hull, and it is the
whole verification for a key whose effect the HUD does not report — lean, the
reset edge, a camera rung. Look at the images too, once, to confirm the
DIRECTION is the intended one: a hash proves two keys agree, never that they
agree on the right thing.
