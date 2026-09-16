---
title: A renderer rule keyed on `progress` silently blinds the scene that photographs it — restage the scenario's `nextGate` in the same change
date: 2026-09-16
scope: pwa/src/game/scenarios.ts
concepts: [scenarios, gates, buoys, screenshots, staging]
---

`scenarios.ts`'s `mark` scene stands the craft a standoff off the rounding
mark with `nextGate: mid.index` — the middle gate, because nothing used to
care which gate the run owed. The moment a lamp is keyed on the owed
checkpoint (`buoys.ts`'s `markOf`/`buoyLamp`), that staging photographs a
DARK can, and the scene's own stated question — "does a lantern read at
range" — can no longer be answered. Nothing fails; the sheet just quietly
stops showing the thing it exists to show.

So: when a change makes the renderer read `progress`, grep `scenarios.ts`
for the scenes that photograph it and restage their `moment.nextGate`.
Here the join is published — `Gate.mark` names the solid — so the fix is
`level.course.gates.find((g) => g.mark === rock.id)`, never a distance
match of the scene's own.

The same trap waits for any scene shot at a gate: `gate`, `missed` and
`mark` all set `nextGate` explicitly, and a new reading off the run's
progress has to be staged in each of them or photographed in the one state
that does not show it.
