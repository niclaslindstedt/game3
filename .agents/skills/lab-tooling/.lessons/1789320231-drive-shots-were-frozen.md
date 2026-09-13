---
title: A `shot=1` URL FREEZES the run on its first frame, so a key held over it drives nothing — a drive shot boots with `start=1` and raises the flag itself
date: 2026-09-13
scope: scripts/screenshot.mjs, pwa/src/App.tsx
concepts: [screenshots, url-contract, drive, frozen]
---

`--drive W:4` had been photographing the start line for as long as it
existed: the lab's base params carry `shot: "1"`, `App.tsx` reads that as
`frozen` from the first frame, and a frozen loop takes no steps however long
a key is held — the picture that came back was the still the app drew on
boot, with the HUD reading 0'00"00 and 0 km/h, and nobody had looked at the
clock in the corner. The fix is one line: the drive branch boots with
`start=1` in place of `shot=1` (both name a run, only one freezes it), holds
the key over a moving frame, and sets `window.__SH_READY__` itself once the
hold is over, which is what it already did.

The general rule: a lab that wants the run to MOVE before its picture must
not name `shot` in the URL; `shot` is for a scene stood at a moment and
photographed there.
