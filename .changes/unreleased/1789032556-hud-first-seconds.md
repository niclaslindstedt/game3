---
type: Fixed
title: The HUD was missing for the first seconds of every run
---

The first animation frame after a shore is built carries a timestamp from before the build began, so the frame's elapsed time came out more than a second negative and everything counted in seconds off it ran backwards. The readouts did not appear until that debt was paid back — and never at all in a screenshot. The frame time is now clamped at both ends.
