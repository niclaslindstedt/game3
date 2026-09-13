---
title: `make sim` is blind to any control the BOT caps itself out of — an unmoved digest is not evidence a rider-facing change is safe or that a rider-facing bug is absent
date: 2026-09-13
scope: engine/game/, engine/sim/bot.ts
concepts: [sim, measurement, bench, game-feel, air]
---

`sim/bot.ts` deliberately caps its air lean at `flight.pumpRise` and its air
steer at `flight.whipRise` so a levelling loop never earns a stroke. So a
whole control — both strokes, and anything else gated behind an input the
bot holds under a threshold — is exercised zero times in sixteen runs. A
change that rewrote when a stroke may be earned moved not one of the
sixteen digests, and the bug it fixed cost a human rider most of a barrel
roll off every wave he turned on.

Read the table both ways. An unmoved digest across a change like this is a
strong POSITIVE — it says the roster's balance cannot have regressed — and
it says nothing at all about whether the change was needed or whether it
works. And the reverse: `make sim` will never surface a control-feel bug in
anything the bot refuses to ask for. Only a bench that holds the input a
HUMAN holds will.

Before quoting `make sim` on a control, check `bot.ts` for a cap on the
input that control is read off. If there is one, the honest instrument is a
scripted bench, and the sim's job is to prove you did not break the parts
the bot does use.
