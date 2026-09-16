---
title: A guide drawn from the HULL to its target shrinks to a stub exactly when it matters — anchor world guidance to the course's own stations instead
date: 2026-09-14
scope: pwa/src/game/guide-line.ts, pwa/src/game/guide-plan.ts
concepts: [hud, guide-line, course, gates, readability]
---

Anything drawn in the world to say "go that way" is tempting to build from
the craft outward — start at the bow, end at `aimPoint`. It reads fine in a
screenshot taken mid-leg and is wrong in motion: the line shortens as the
rider closes on the mark and is at its shortest at the checkpoint, which is
the one moment the next leg's bend is worth seeing. The dashes also crawl,
because a pattern laid at fixed distances from a moving hull slides over the
water every frame.

Lay it on `Course.path` instead: the checkpoint behind the rider to the one
ahead and on down the line, with the dashes at MULTIPLES of their own stride
along the path (`guide-plan.ts` measures the window, `guide-line.ts` draws
it). The mark then stands still in the world, the rider passes over it like
a lane marking, and crossing a checkpoint hands over a whole new leg instead
of a stub. Gate stations are measured once per level with
`distanceAlong(..., after)` chained gate to gate — the `after` argument is
what keeps a circuit's second lap on the second loop of the path (R30)
rather than snapping back onto the first, and it anchors the craft's own
station for the same reason.

AND THE TAIL HANGS OFF THE CHECKPOINT BEFORE LAST, not off the one just
taken. Clamping the window's near end to the last crossed mark looks right
written down — "the leg being ridden" — and is wrong in motion for one
frame's worth of the most conspicuous reason there is: at the instant of the
crossing the rider IS standing on that station, so the clamp cuts the whole
tail off under the hull and it grows back over the next `BEHIND` metres. One
mark further back costs nothing drawn, because the tail everywhere else along
the leg is decided by `here - BEHIND` and the clamp is not in play. The
general shape: a window clamped to a landmark the rider passes THROUGH
collapses at the passing, and the passing is the moment it is being read.
