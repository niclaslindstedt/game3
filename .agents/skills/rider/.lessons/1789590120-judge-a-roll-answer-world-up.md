---
title: A change to how the rider answers the hull's ROLL is invisible in every view this repo can draw — the rig has to be redrawn WORLD-up, or the question cannot be asked at all
date: 2026-09-16
scope: pwa/src/game/rider-pose.ts, scripts/craft-preview.mjs
concepts: [pose, roll, lean, craft-sheet, tooling, dynamics]
---

Every picture of the rider — the `make crafts` sheet, `make screenshots`, the
scratch grid this skill's loop describes — is drawn in the CRAFT's frame: the
deck is the page's horizon. In that frame a torso welded to the deck and a
torso holding the world's vertical are the same picture, because what changed
is the angle between the body and a vertical that is not on the page.

So a scratch sheet for anything on the roll axis takes one more step than the
STANCE grid does: rotate every vertex of the whole rig (hull AND rider) by
`-roll` about z before projecting it, one cell per heel, and draw the world's
vertical through the pelvis as a rule. Then the cell says what it is for. The
stern view is the one to use — it is the chase camera's axis.

Two traps in the measuring half:

- **Separate the carve from the wave.** `STANCE.rollPerMetre` is 1.8 rad/m,
  so `riderRight` swamps everything: over a bot run the torso sits FURTHER
  off the world's vertical than the hull does, and a window picked on `|roll|`
  alone is a carve, which is the hang-into-the-turn working correctly and says
  nothing about a wave. Pick the window on small `|riderRight|`, and report
  `|roll + sway|` beside the whole-body figure.
- **Hold the hull, do not step it.** Setting `state.craft.roll` and calling
  `observe` twice a frame for a second settles the springs on their REST with
  no lag in the reading, which is the number a share is argued about.

Measured that way, `uprightShare` 0.45 took the wave-driven part of the torso's
angle from p50 9.6° / p90 22.7° to 5.6° / 14.2° on seed 19.
