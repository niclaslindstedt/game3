---
title: A tile fault is measured as the SLOPE A LINE OF TEXELS CARRIES, not as the step between adjacent lines — the obvious test passes on a tile with a hard seam in it
date: 2026-09-11
scope: pwa/src/game/ripple-tile.ts, tests/ripple_tile_test.ts
concepts: [water, shader, textures, ripples, foam, sampling]
---

The first test written for the ripple tile's wrap compared the mean step
between column 255 and column 0 against a typical interior step, and it
passed at 1.06× on a tile whose seam was plainly visible when drawn. The
measure is wrong: a height step at the seam turns into a large SLOPE on the
one line of texels that straddles it, and a slope field is smooth across the
join even while it is enormous there. The discriminating number is the mean
slope magnitude carried by column 0 against the mean over all columns —
1.90× on the broken tile, 0.96× on the built one.

The lattice needs a different measure again, and a spatial one will not find
it: transform the slope field and take the loudest single component's share
of the total power. Seven sines put 8.2% into one component; a spectral tile
puts 1.9%. Both numbers are in `tests/ripple_tile_test.ts`.

The general rule: **before trusting a new test on a rendering artefact,
run it against the version that has the fault.** A test that passes on both
is worse than no test, because the next session reads it as cover.
