---
title: Anything on screen that reads `craft.heading` turns round under a backflip — take the direction off the VELOCITY, with the nose worth a couple of m/s as the tie-break at rest
date: 2026-09-16
scope: pwa/src/game/guide-plan.ts, engine/game/course.ts
concepts: [guide-line, heading, flight, tricks, aimPoint]
---

`c.heading` is derived through `toEuler`, which folds the pitch back at ±90°
and swings the heading a clean 180° to compensate. `craft.ts` already says so
where it reads the rider's own way — but the READOUTS did not, and a mark
that asks "what is ahead of the nose" reads every lip on the shore as being
BEHIND the rider for half of every flip. The guide line, whose whole window
ended at the engine's `aimPoint` (a ±90° cone off that same heading), blinked
out for up to 2.8 s at a time in a tricks run: 5% of frames had no aim at
all, 72% of those airborne — which is to say it disappeared during the trick.

Two things to carry forward. First, the direction of travel is the VELOCITY,
which does not care how the hull is spinning; the nose is worth about 2 m/s
added to it, which decides a hull sitting still (velocity alone at rest is
the wave orbit under the hull and its sign turns over with every crest, so a
300 m mark would change ends twice a second). Second, a per-frame query that
can legitimately answer "nothing" must never be the thing that switches a
surface OFF — let the plan fall back to something the rider always has (here,
their own stretch of the course's line), and keep the query for what it is
actually good for.

The cheap repro is headless and takes seconds: ride `botInput` through
`createGame({ seed, mode: "tricks" })` and count the frames whose window is
empty or a stub. Note that the bot is NOT a tricks rider — `nextGate` never
advances with `rules.course` off, so it mills around the first buoy — which
is fine for exercising the branch and useless for judging what a run looks
like. For a PICTURE, drive `scenarios.ts` headlessly to find a `--t` where
the old rule loses the line AND the craft is within ~35 m of the racing line,
then shoot that exact moment with `--camera drone`: the chase camera is too
low and the plates too small to tell a missing line from a faint one.
