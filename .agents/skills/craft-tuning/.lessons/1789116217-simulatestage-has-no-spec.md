---
title: `simulateStage` takes a craft ID and no spec override, so a per-craft catalog A/B must edit the catalog — passing a `spec` is silently ignored
date: 2026-09-11
scope: engine/sim/simulate.ts, engine/game/defs/craft.ts
concepts: [sim, measurement, tuning, roster]
---

`SimOptions` has `craft?: CraftId`, `level`, `track`, `wind`, `profile`,
`assist`, `maxSeconds` — and nothing that replaces the SPEC. An extra
`spec:` property on the options object is dropped without complaint, so a
sweep written that way measures the catalog's craft once per row and prints
identical numbers.

It cost a round this session on the otter's `bowRise`: three values, three
byte-identical dive counts and pace figures. The tell is the one
`craft-physics` already names for the probe cache — agreement to the last
digit, where a knob that genuinely does nothing still moves it through the
chaos of a wave field.

Two ways through. For a knob read per STEP (`sponsonBite`, `riderAuthority`,
`ridePlate`, the bucket) assign `state.craft.spec` after `createGame` and
drive `step` yourself — that works and is how the carve and sheet benches
sweep. For anything `hullProbes` reads at layout time (the dimensions,
`deadrise`, `cog`, `displacement`, `bowRise`) you need a distinct `spec.id`
too, and for a full bot-ridden run through `simulateStage` there is no seam
at all: edit `defs/craft.ts` between runs, in separate processes.
