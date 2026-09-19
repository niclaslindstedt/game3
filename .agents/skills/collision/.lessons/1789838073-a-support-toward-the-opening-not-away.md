---
title: Growing an opening by the body's own size takes the support TOWARD the opening's centre, not along the offset — and a sim whose digest holds while its gate count moves is the proof the trajectory never changed
date: 2026-09-19
scope: engine/game/course.ts, engine/game/hull-contact.ts
concepts: [gates, course, reach, shell, sim, digest]
---

Judging a checkpoint against the craft's centre of gravity charges five
seconds for a rail that went past the buoy. The fix is to grow the opening
by `craftReach` — the support of the hull's shell plus the rider along a
direction — and two things about it are easy to get backwards:

- **The direction is INWARD.** The offset says the craft is `off` metres
  that way from the centre; the part of it nearest the opening is therefore
  the one on the NEAR side, so the support is taken along `-offset`. Taken
  along `+offset` a hull passing clear OVER a ring is credited with the
  rider's helmet — which stands even further above the hoop — and "flew two
  metres over the gate" counts as threaded. Caught by writing the over and
  under cases as one test with the same 4.2 m offset and opposite signs;
  a symmetric test would have passed either way.
- **The support is DIRECTIONAL, never a radius.** `hullShell(spec).reach`
  is right there and is a sphere, so it is the tempting call — and it hands
  a hull crossing a ring nose-first half its LENGTH of extra aperture when
  what it is actually blocking is half a beam. Read the shell's `points`
  against the direction instead; the shell is already oriented and laid out
  off the hull's own tables, so nothing about the machine is restated.

Reuse `hullShell` rather than describing the hull again, but know what it
deliberately leaves out: it stops at the DECK, because a rider is no wall
to a hull coming alongside. A ring is the case where he is exactly the
thing that goes through, so the rider is this function's own term.

**A moved gate count with an UNMOVED digest is the signal to look for, not
a contradiction.** A miss and a take both advance `nextGate`, so the bot
aims at the same mark either way: on the seeds where nothing else diverged,
`make sim` came back with the same digest, two more gates, and a time
exactly 10.0 s lower for the two penalties no longer charged. That row is
the strongest evidence a scoring change is scoring-only — if the digest had
moved there too, the change had reached the riding.
