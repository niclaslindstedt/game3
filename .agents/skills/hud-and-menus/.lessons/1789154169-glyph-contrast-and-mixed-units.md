---
title: A centred stroke on a small glyph eats it — use `paint-order: stroke fill`; and an SVG mark positioned in viewBox units will strike through a rem-sized label on a smaller plate
date: 2026-09-11
scope: pwa/src/game/minimap.tsx, pwa/src/styles.css
concepts: [minimap, svg, hud, layout, portrait, contrast]
---

Two traps from making the map's own marks readable, both of which look right
on a desktop plate and wrong on a phone.

**Contrast.** The craft icon has to be findable over near-black deep water, a
pale shore AND the route's white ribbon, and no single fill colour survives
all three — so the glyph carries its own ground: a soft dark plinth disc
under it, and a light outline at its edge. The outline has to be
`paint-order: stroke fill`, or half its width is spent eating the eight-unit
hull it is separating and the icon reads as a white blob with a coloured
middle. Same reason a wide pale "surf" stroke on the shoreline is drawn
BEFORE the land fill: the land covers its landward half and what is left is
exactly the half that belongs in the water.

Direction needs its own mark. A hull this small is nearly symmetric fore and
aft, so the bow gets an arrowhead — and it must be struck in a DIFFERENT ink
from the outline, or it merges with it and reads as the halo bleeding round
the nose.

**Mixed units.** A mark drawn in the face's viewBox scales with the plate; a
label set in `rem`/`vmin` does not. So the smaller the plate the more of it
the label takes, and a scale rule that cleared its word by a comfortable gap
at 1280×720 was struck straight through it at 390×844. Anything placed in
viewBox units above or below HUD text needs its clearance chosen at the
SMALLEST plate `--hud-map`'s clamp allows, not at the design viewport.
