---
type: Fixed
title: The distance answers to the light again
---

The far shore no longer glows brighter than the sky behind it. The sky's own
shader was writing its colours without the linear-to-sRGB conversion every
other material makes, so it came out about half as bright as it was authored —
which read not as a dark sky but as a headland lit from nowhere. The haze the
distance fades into is now the sky in that direction, so a sunset's shore burns
with the sunset and a squall's is a dim silhouette under the gust front.
