---
title: The colour the distance fades into is the SKY IN THAT DIRECTION, not an authored grey — and under a lid it is the ceiling a few degrees up, not the ceiling overhead
date: 2026-09-10
scope: pwa/src/game/sky.ts, pwa/src/game/sky-looks.ts
concepts: [sky, fog, weather, horizon, light]
---

`Preset.fog` is the one colour in the model that is not LIT — it is what
erases the far shore. Authored beside the horizon rather than out of it, it
stops answering to the light: a burning sunset gets a pale grey headland
ruled across it, because the rungs' haze tone is duller and less saturated
than the horizon band it stands in front of. `opened()` now pulls it most of
the way to `p.horizon` (`FOG_IS_SKY`, 0.78); the remainder is the honest part
of the difference, since haze really is a little paler than the sky.

Under a LID the target is neither end of the ceiling. Read at
`deck.overhead`, a rain deck (near white up there) turns the shore into a
paper cut-out brighter than the sky above it; read at `deck.rim`, a squall's
shore comes back as bright as the gust front's lit strip, which is the one
place in that sky with daylight in it. The air that does the erasing is lit by
the piece of ceiling directly over it, so the target is `deckToneAt(deck,
RIM_BAND · DECK_HAZE)` — a few degrees up. Rain then whites out at the horizon
the way a wet day does, and a squall's headland is a dim silhouette.
