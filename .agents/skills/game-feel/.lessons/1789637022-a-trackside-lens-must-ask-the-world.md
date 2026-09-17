---
title: A camera planted off a RECORDED pose has to ask the world whether it can stand there, and to cap anything that scales with the moment's length
date: 2026-09-17
scope: pwa/src/game/camera-tv.ts, pwa/src/game/replay-shots.ts
concepts: [camera, replay, framing, tv, placement]
---

The TV camera is the first camera in this game that is NOT hung off the craft:
it is planted out on the water off a pose the run wrote down, before the craft
has got anywhere near it. Nothing else then stops it landing somewhere absurd,
and both ways it can are invisible in the code and obvious in one frame.

- **It lands inside a skerry, or up the beach.** What comes back is a dark
  polygon filling the screen, which reads as a broken renderer rather than as
  a badly chosen angle. The stand has to ask: water under it (`bedAt` below a
  draft) and no solid within its radius. Try the seaward side, then the other,
  then push further OUT — the SIDE is a decision about the shot and the
  standoff is only a decision about the lens — and when nothing is clear,
  refuse and let the chase boom keep the frame. A shot that lands on the boom
  is a shot nobody notices.
- **It lands four hundred metres away.** The placement scales with the ground
  the craft covers during the moment, and a "flight" is not always a jump: a
  hull thrown clear by the tornado is off the water for ten seconds at 63 m/s
  and reaches the collector as one `launch` and one `land`. Cap the moment's
  own length AND cap how far ahead the stand may go.

**Measure the framing, do not eyeball it.** A throwaway probe that rides a run,
plans the shots, stands each lens and prints the RANGE and solved fov at the
cut, the beat, the middle and the hand-back is a dozen lines and answers in
two seconds; a screenshot of the same fault reads as "empty sea" and says
nothing about why. `cut 59m/14° beat 61m/14° mid 114m end 147m` is a shot whose
subject runs away from the lens, and the table says so where the picture did
not.
