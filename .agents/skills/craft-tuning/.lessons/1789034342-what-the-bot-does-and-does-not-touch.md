---
title: The bot holds full throttle and leans, so a rev-range knob is invisible in `make sim` and a knob riding on `lean` moves every craft that has one
date: 2026-09-10
scope: engine/game/defs/craft.ts, engine/sim/bot.ts
concepts: [sim, bot, tuning, roster]
---

Trap 1 in this skill in two concrete directions, both measured this session.

**Invisible:** `boost` (forced induction, torque rising with the square of
engine speed above an onset) changed the marlin's sweep numbers by
essentially nothing. The bot holds the throttle wide open, the pump load is
∝ rpm² regardless of hull speed, so the engine sits near the limiter where
the blower is fully in. The knob is real and a human feathering the throttle
out of a turn feels it — but `make sim` cannot credit it, and the PR has to
say so and probe it by hand instead.

**Over-visible:** `trimRange` rides on the `lean` input, and the bot DOES
lean (back on a ramp, level in the air). So giving every craft a trim range
moved every craft — the reference craft, whose every other knob was 1.0,
lost 4% of its pace and gained dives, purely because the bot was now trimming
the nozzle up off every ramp. Ranges came down from 6–9° to 4–7° and it
returned to baseline.

So before adding a per-craft knob, ask which INPUT it hangs off and whether
the bot writes that input. `throttle` and `lean` it writes constantly;
`reverse` it never writes at all (deliberately — see `botInput`).
