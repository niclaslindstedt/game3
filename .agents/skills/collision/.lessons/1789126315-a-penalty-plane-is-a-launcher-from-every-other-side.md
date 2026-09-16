---
title: A ramp's wrong-side launch is fixed with a depth threshold AND minimum-translation, never either alone
date: 2026-09-11
scope: engine/game/collision.ts
concepts: [ramp, contact, penalty, repro, sweep]
---

"Riding into X throws me 50 m in the air, spinning" was a RAMP whose deck
was a one-sided plane over its whole plan footprint: a hull meeting it
through the end face under the raised lip got `stiffness × lipHeight`
straight upward — 30 m of air on an 8 m ramp, 137 m on a 14 m one, at every
speed and on every craft. (The general rule this taught is now an invariant
in `SKILL.md`; what follows is the ramp's own fix.)

**The fix needs both halves.** Minimum-translation alone — push the probe
out through whichever face is the shallowest way back out of the wedge — is
the robust part, and it holds at any penetration depth where a fixed "within
0.6 m of the edge" band silently falls back to the deck normal once a hull
gets deeper. But min-translation ALONE regressed the ±30°-off-axis graze
near the hinge, where the deck stands centimetres up: a probe 0.2 m under a
0.36 m deck is genuinely nearest the flank, so it got deflected and capsized
where it used to climb aboard. Keeping the depth threshold
(`contact.rampWallBelow`) in FRONT of the min-translation test restored
those columns byte-for-byte. A probe barely under a surface is riding it;
only a DEEP probe needs asking which wall it came through.

**Byte-identical `make sim` is the strongest evidence a contact fix is
surgical.** The bot rides ramps from the correct side, so a fix confined to
the wrong-side path must leave every table and every determinism digest
untouched. If the digests move, the fix reached the normal path and the
sweep did not show you where.
