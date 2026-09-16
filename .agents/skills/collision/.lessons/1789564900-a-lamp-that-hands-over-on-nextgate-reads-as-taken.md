---
title: A mark lit off `nextGate` says "taken" on the very step a miss is charged — a run that advances past a checkpoint needs a SECOND reading on the water, not a louder HUD
date: 2026-09-16
scope: pwa/src/game/gates.ts, engine/game/course.ts
concepts: [gates, marks, missed, hud, buoys, legibility]
---

A miss in `stepCourse` charges the gate AND advances `nextGate` on the same
step, so anything lit off `nextGate` alone hands over at that instant. The
buoy lantern did, which meant a rider crossing a gate's plane a metre
outside its buoys watched the pair go dark — the reading for "you took
that one" — while `MISSED CHECKPOINT` came up over the nose in the same
frame. The bug report was not "the warning is wrong"; it was "the buoys and
the text disagree about how close to the checkpoint I have to get". Two
surfaces, two different numbers, one checkpoint.

**Look for this wherever a mark reads one field and its label reads
another.** The fix is not to move the lamp back onto the missed gate — the
run really has moved on, and the amber lantern is where the rider is
GOING. It is a second, differently coloured reading spending the SAME
number the label does (`progress.activeMissedGate`, exported by the engine
and never re-measured in the renderer), so the two cannot drift: the red
comes up on the step the miss is charged and goes out on the step the
rider is back inside the opening, whatever that rule happens to be. Paint
it in the HUD's own `PALETTE.hudBad` so the marks on the water, the
warning's type and the arrow read as one thing.

**A checkpoint behind the rider cannot be judged from a chase camera.**
Every scene shot in this game looks forward, so `make screenshots
SCENE=missed` photographs an empty sea and says nothing. `--camera drone`
is the plan view from 36 m up with the craft centred, which puts a gate
15 m astern in the bottom of the frame — that is the shot that shows the
change, day and night, and the one that showed the marks were a dull
weathered brown before it. Pick a CLEAR sky for the night frame: at the
level's own dawn hour the haze from that height whites the whole plan view
out and nothing in it can be judged.
