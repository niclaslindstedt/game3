---
title: Moving the feet aft along the tray without moving the pelvis over them flattens the rider along the deck — the torso solver pays for the reach
date: 2026-09-12
scope: pwa/src/game/rider-pose.ts
concepts: [pose, stance, rider, craft-design]
---

`poseRider` leans the torso forward until both shoulders can reach their
grips. That solver is why a change to where the FEET stand is never only a
change to the feet: move `ankleZ` aft and the bars are further away, so the
lean grows to close the gap and the figure ends up stretched flat along the
deck instead of standing on it. It looks like a broken pose and is the
solver doing exactly what it is told.

Whatever moves the feet aft has to bring the pelvis with them. `STANCE.standBack`
holds the pelvis behind the ankles, which is right for a stand-up being ridden
normally and wrong the moment the feet are already at the back of the tray:
cutting it (`standRearBack` = 0.25 at a full stand) puts him UPRIGHT OVER his
feet with the arms extended, which is both what the pose should look like and
where the weight belongs.

Judge it from the `close` camera in daylight, not from `chase` — a reared or
unusual attitude puts the hull between the chase camera and the rider, and
the figure that matters is hidden behind the hull bottom:
`node scripts/screenshot.mjs --scene <name> --camera close --viewport desktop
--weather clear --hour 12`.
