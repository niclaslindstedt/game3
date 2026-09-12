---
title: Never pipe the OPEN-half lesson printout through `head` — use `--list` first, then read the fragments that matter
date: 2026-09-12
concepts: [tooling, measurement]
---

`node scripts/skill-lessons.mjs <skill>` prints the whole set oldest first,
and on a skill carrying fifteen-plus fragments that is thousands of words. The
tempting shape is `| head -120`, which reads the OLDEST third and silently
drops the newest — and the newest fragments are the ones most likely to be
about the code as it stands today.

It cost a full session: `craft-physics` carried a fragment saying in its title
that Euler pitch wraps at ±90° and to integrate the body rate instead, the
session truncated past it, and then spent hours sweeping tuning dials whose
every variant came back pinned near ∓90° — reading a saturated instrument as
"this knob does nothing" three times over before finding the lesson that
already said so.

The order that works: `--list` first (one line per fragment — title, scope,
concepts, word count, and it fits), then read the specific fragments the task
touches, narrowed with `--scope` / `--concepts`. If the full text is genuinely
wanted, let it all through; never a `head` on it.
