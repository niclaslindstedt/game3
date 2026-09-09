---
title: The chase camera looks DOWN on the craft, so height reads as contrast, not as height — a saddle taller in elevation stays invisible at chase range until its top is a lighter colour
date: 2026-09-09
scope: pwa/src/game/craft-styles.ts
concepts: [chase-view, colour, saddle]
---

From the chase rig (two metres up, five back) the craft is seen from above
and behind: the saddle's height, the coaming's lip, the hood's swell all
foreshorten to a few pixels, and a dark saddle on a dark footwell mat reads
as one black patch however tall it is. What separated the parts on screen was
colour, not geometry: the `seatTop` insert a clear step lighter than `seat`,
the `rail` band near-black against the pale topside, the `tray` mats darker
than the deck. Judge a proportion in the sheet's SIDE and BOW cells; judge
whether it READS in the built app's landscape frame — and when it doesn't,
reach for the paint before the shape. The freeboard is not the builder's to
fix either: `restY` floats the hull where the physics says (about 0.3 m of
rail over the water at rest), and a hull drawn taller to look right is a hull
that hovers.
