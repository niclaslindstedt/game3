---
title: A picture row stored as ONE WORD has to expand its levers at all four doors — the menu, the URL, the probe AND mergeSettings — or every already-stored blob keeps the disagreement the row was created to end
date: 2026-09-11
scope: pwa/src/game/settings-video.ts, pwa/src/game/settings.ts, pwa/src/game/url-params.ts, pwa/src/game/video-probe.ts
concepts: [options, settings, video, storage, migration]
---

DETAIL stores no stop of its own: it stores its levers and reads the stop back
with `detailOf`. WATER is the other shape — the stop IS the stored word,
because `WATER_LOOK` has to be keyed by one — and when levers were moved onto
it, three of the four doors were obvious (`menu-options.tsx`'s `onPick`,
`settingsFor` in `url-params.ts`, `promoteVideo` in `video-probe.ts`) and the
fourth was not.

`mergeSettings` is the one that bites. It reads every lever individually, on
purpose, so a renamed stop drops one row rather than a rider's whole picture.
Left that way, a blob written before the move carries the levers at the OTHER
row's stop, `mergeSettings` honours them, and the new row is a word that
disagrees with the sea it names until the rider presses it — which is exactly
the fault the move was meant to fix, preserved for everyone who already played.
The fix is one line: expand the stop over them (`Object.assign(settings.video,
WATER_PRESETS[settings.video.water])`) and DELETE those levers' individual
`on(...)` reads, since nothing could ever set them independently anyway.

So the rule: a lever belongs to exactly one row, and a row that stores a word
owns its levers at load time too. Hold it with a test that feeds `mergeSettings`
a blob with the stop at one end and the levers at the other
(`tests/menu_system_test.ts`), and a test that asserts the two rows' key sets do
not intersect (`tests/video_test.ts`) — the second is what catches a lever
quietly added back to both.
