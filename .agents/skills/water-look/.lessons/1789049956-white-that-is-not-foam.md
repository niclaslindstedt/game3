---
title: Before touching the foam, prove the white IS foam — a storm's pale sheets were the squall's fog and the mirror of the low sky on wave backs, and the whitecap rule was dead because its crest gate sat at three sigma
date: 2026-09-10
scope: pwa/src/game/water-mesh.ts, pwa/src/game/water-shader.ts
concepts: [foam, whitecaps, storm, fog, mirror, reference]
---

"That foam does not look like foam" on `--scene storm --hs 20` under a
squall was not foam at all. Two checks settle it in minutes: shoot the same
sea under `--weather clear` (the sheets turned sky-blue, so they were the
SKY), and rebuild once with the glint's gain at zero (identical, so not the
glint). What was left: the squall's short fog over water a twenty-metre
sea holds far from the lens, and the mirror handing every reflected ray
that dips under the skyline the dome's fog colour. On a real sea that ray
lands on the next wave's back, which is dark water — the shader now mixes
those rays toward the body (`MIRROR_UNDER`), and the clear storm reads as
grey swell instead of white sheets. The squall's fog is the sky preset's
own and stays.

The foam itself had two real faults, found only after that:

- A steep face alone was painted white. A swell is steep over its whole
  face and rolls in green; what goes white is the top going over. The
  breaking term is gated to the crest (`BREAK_CREST_*`), the shallows keep
  their own rule.
- The whitecap crest gate was `0.75·Hs` to `1.15·Hs`. Hs is four standard
  deviations of the surface, so that is three sigma and above: at 18 m/s
  not one crest capped. A quarter to a half of Hs is where crests stand.
  And judge the height against the sea HERE (`seaShares`, inlined), not the
  level's headline Hs, or a sheltered bay never caps at all.

Lace, not paint: at a full share the tile's darkest holes stay open on the
water, a thin share is half see-through aerated water, and the tile is read
in wind space stretched downwind so foam is streaks the wind combed.
