---
title: Judge a search rule on the geometry that SHIPS, never on the artefact the drawer handed over — and a tolerance that has to grow past the rule's own margin is the tell that you are not
date: 2026-09-10
scope: engine/mapgen/course.ts, engine/mapgen/circuit.ts
concepts: [air-gates, search, rejection, beam, circuit, measurement, performance]
---

`layCourse`/`layCircuitCourse` straighten an air gate's window into a CHORD
(R9), and that chord is a different line from the one every rule before it
was checked against. Three rules have now been caught reading the wrong
one:

- **R9's own beam** was read at the hinge, off the CURVE. Over 24 seeds
  that was 59 rejections of the dearest kind — found after the level was
  built, compiled and analyzed. Reading the chord left 2, and it has to run
  AGAIN in the final loop beside `chordOk`, because straightening one
  window moves every window after it.
- **R29's `turn`** and **R31's roundings** were judged on the raw loop the
  drawer returned. A straightened window takes a corner's worth of turning
  out of a lap and pulls the line in toward whatever that corner was drawn
  round, so both passed on laps a rider meets as a straight past a rock.
  Fixed by re-asking both of the finished lap in `layCircuitCourse`: that
  costs a COURSE (another shuffle usually moves the window) rather than a
  basin.

**The tell is in the budget.** Keeping the seeds green needed
`ANALYSIS.circuit.turn` at 1.2 rad, which put R29's floor under 2π — a rule
about counter bends passed by a plain circle. When a tolerance has to grow
past the margin the rule itself is written with, the check is reading a
different geometry from the one the rule is about; move the check, not the
number. With the measure moved, 0.3 rad covers the real difference (the
seam, counted once a lap by the analysis and stepped over by the search).

Read the reason tally as a whole after such a fix: `the basin cannot carry
a course` goes UP because the same failures are now found for a tenth of
the price. Mean build fell 726 → 588 ms even as that count rose.
