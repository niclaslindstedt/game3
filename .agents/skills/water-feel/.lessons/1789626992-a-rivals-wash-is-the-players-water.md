---
title: A rival's WASH is on the player's sea, so a run with a field cannot be replayed without the field
date: 2026-09-17
scope: engine/game/wash.ts, engine/game/rivals.ts, pwa/src/game/ghost-run.ts
concepts: [wash, rivals, determinism, replay, ghost]
---

`SeaState.washes` holds EVERY rider's trail, and `surfaceAt` reads all of them
for anybody — so the eleven hulls of a race are not just scenery beside the
player, they are eleven wave sources in the water his probes read. The
consequence for anything that replays a recording: a run that had a field can
only be ridden again by stepping the whole field again. Taking the rivals off
and relying on the RNG stream lining up is not enough, and it fails quietly —
the craft simply ends up somewhere else a few hundred steps in.

MEASURE IT RATHER THAN ARGUE IT. On a campaign tricks rung, ride the recorded
run with its field, then ride its tape on the same run with `dropField` called
on it: 4 m off the line inside ten seconds, 140 m by twenty, most of a
kilometre by the buzzer. A synthetic case shows the divergence; only the real
rung shows how fast it compounds, and that is what decides whether a feature
can live with it.

Before the wash landed, emptying the field WAS enough, and the trick was
subtle enough to look right: build the run with its field so the grid's own
draws off `state.rng` are made, then empty `state.rivals` so nothing is
stepped. That bought a one-hull replay of a twelve-hull run. `dropField` is
still the right call for a run that has not been ridden yet — it now lifts the
field's trails off the sea with the field, so the ghost feels no wakes nobody
is laying — but no drop can hand back the wakes a RECORDING was ridden
through.

So a feature that replays a run either pays for the whole field or refuses a
run that had one. The ghost refuses: `state.rivals.length > 0` and it keeps no
tape (`ghost-run.ts`), which is one rule that explains a race, a campaign rung
and a free ride at once. `tests/ghost_test.ts` holds both halves — the stream
contract with the recording's trails lifted by hand, and the water, where the
same tape over the same shore lands somewhere else.
