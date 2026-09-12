---
title: The "every event is answered" guard was a hand-written array and silently missed three new events — it is keyed off `GameEvent["kind"]` now, so keep it that way
date: 2026-09-12
scope: tests/audio_test.ts, pwa/src/game/audio/route.ts
concepts: [route, events, tests, guards]
---

`tests/audio_test.ts` exists to catch exactly one fault first in its own
header — "AN EVENT NOTHING ANSWERS" — and its `EVERY_EVENT` was a literal
array somebody had to remember to extend. Three new engine events (`trick`,
`combo`, `bail`) landed in a previous PR, made no sound at all, and the whole
suite stayed green: the guard cannot fire on a variant it was never told
about.

It is now `EVERY_EVENT_BY_KIND`, typed
`{ [K in GameEvent["kind"]]: Extract<GameEvent, { kind: K }> }`, with
`EVERY_EVENT` derived from `Object.values`. A new variant does not COMPILE
until a sample is written, which is the only version of this guard that
actually holds. If you ever find yourself widening that type or dropping a
key to make a build pass, you have deleted the test.

`tornado` is the one kind with no rung — it is a wind, and what is heard is
the sea it throws the hull out of — so it sits in `SILENT_KINDS` with its
reason beside it rather than being quietly left out of the list. Any future
deliberate silence goes there the same way: named, not omitted.
