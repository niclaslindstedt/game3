---
title: A wake origin measured from the craft's CoG must use the real transom, not a fixed fraction of hull length, or one craft shows a seam
date: 2026-09-14
scope: pwa/src/game/wake-profile.ts, pwa/src/game/wake.ts, pwa/src/game/spray.ts
concepts: [wake, jet, spray, transom, verification]
---

The craft state stands at its centre of gravity, while the hull's geometric
centre is offset by `spec.cog.z`. The physical distance astern is therefore
`length / 2 + cog.z`; a fixed `length * 0.45` only happens to meet one hull.
Start continuous wake geometry a short distance forward of that edge so its
hard first row is hidden beneath the hull, and give state-driven spray the
same overlap. Verify the seam from the 3× overhead and chase crops: a normal
frame hides a narrow strip of untouched water between the transom and effect.
