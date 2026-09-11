# Simulation and the bot

Handling, water and generator changes in this repo are **measured**, not eyeballed. The measuring stick is a headless simulation harness that drives the real engine — `createGame`, `step`, the same functions the browser calls — with a bot on the bars and no renderer attached.

## The bot (`engine/sim/bot.ts`)

A deterministic player stand-in that reads the same `GameState` the HUD reads and produces the same `CraftInput` a thumb produces. It must never reach into the physics' internals: everything it knows it reads off the state and `engine/game/limits.ts` (`topSpeedOf` is how it knows what "flat out" looks like). It is a pure function of the state — `tests/determinism_test.ts` calls it twice on the same state and asserts the same answer — and it decides on every step: the harness calls `botInput` before every `step`.

Its decision rule, in order, every step:

1. **Which gate.** The first one AHEAD: the walk starts at the next gate in course order and goes forward past every gate the craft is already past by more than `giveUpPast` = 6 m, taking the last if every gate left is behind. A gate already behind — a ring sailed over, a buoy passed on the wrong side — is a gate to pay for, not to turn back for; the course charges it (`missedGate`) and the run carries on. The walk never goes backwards, and that is the point: a gate's plane is infinite, so on a course with corners in it (R22) a craft well before a corner is already "past" the plane of the gate after it, and a bot that turned back for the nearer of two such gates rode out to sea in a widening spiral until the run timed out.
2. **Where to aim.** A water gate's centre — except that a water gate with an air gate after it is crossed where the ramp's AXIS crosses its line (`throughOnAxis`, clamped a hull's beam inside each buoy, and the centre when the axis is parallel to the line), so the craft arrives at the ramp already on the axis with the whole leg to settle; a rider looks two gates ahead and the bot does the same sum. For an air gate: the ramp's approach point, `rampApproach` = 110 m before the hinge on the ramp's axis, until the craft is within `rampCommit` = 15 m of it (or past it); then a **pure pursuit** on the axis — a point `axisAhead` = 14 m (or `axisAheadTime` = 0.35 s of the craft's plan speed, whichever is further) ahead of the craft's own projection onto the axis, offset short of the line by `axisSettle` = 1 s × the speed it is already closing at, so a nimble hull arrives on the axis rather than swinging through it. Past the ring (`giveUpPast`) the craft is off the axis and aims at the approach point again.
3. **A rock in the way.** Off the axis (on it, the ramp's run-up is clear by R9), the line to the aim is probed every 6 m out to `lookAhead` = 40 m (or the aim, if nearer) for a solid within a beam of it (`solidNear`); the aim moves off the first one found by its radius plus `dodge` = 9 m, to whichever side the rock is not on.
4. **The bars.** Afloat: `steer = clamp(error · steerGain − yawRate · min(yawLead, eta))` with `steerGain` = 2.2 per rad of bearing error, `yawLead` = 0.7 s, and `eta` the time to the aim point at the current speed — a hull already coming round is steered less, or it weaves down the straight the way a rider who only looks at the buoy does. The lead is a TIME rather than a plain gain because a constant cannot tell a buoy two seconds away from one two hundred metres away: far out the swing already in the bank is anticipated in full, and the last correction before a buoy is committed to. `yawRate` is the BODY rate turned into the world and read about the vertical (`rotate(q, ω).y`), not `wy`: `wy` is the rate about the hull's own mast, and a hull leaned over on a wave face has its mast pointing sideways, so a roll rate reads there as a yaw rate that is not one. The two have the same average magnitude over a run (0.260 against 0.263 rad/s) and differ only in the peaks — enough that in a metre of sea the body reading saturated the damping term on its own and put the nozzle hard over twice a second on a straight. On a ramp's deck the bars are held straight (a hull steered up a ramp leaves it rolled). In the air the bars roll the hull, not the course: `steer = clamp(−roll · airRollGain + wz · airRollDamp − wy · airYawDamp)`, `airRollGain` = 3, `airRollDamp` = 0.6, `airYawDamp` = 1.2 — level for the landing, and a yaw rate carried off the lip held so it does not turn the whole flight.
5. **Reading the water.** Afloat and off the deck, the bot looks at the point the hull reaches in `shoalAhead` = 2.6 s at its speed (never nearer than 12 m) and reads the level's `ground` heightfield there: water shallower than `shoalDepth` = 2.5 m is a shore coming, and the bars are turned toward deeper water — down the gradient of the level's `offshore` field, with `steerGain` on the heading error — gate or no gate. A rider sees the beach; no line through a buoy runs up a shore. This overrides the gate steer for that step.
6. **The throttle.** Wide open. The easing knob is shipped OFF: `easeTo` = 1 (no easing) past `easeAngle` = 0.9 rad of bearing error, because on a jet the thrust IS the steering and easing for a big correction only makes the correction slower; the knob is there for a craft that would rather scrub speed. On the run at a ramp, afloat and once lined up (`alignedWithin` = 0.12 rad), a pace governor holds the speed the ring asks for: `throttle = min(throttle, clamp(paceFloor + (v_target − v) · paceGain, paceFloor, 1))`, `paceGain` = 0.35 per m/s of shortfall, floored at `paceFloor` = 0.3 — never lower, since a shut throttle is a hull that will not turn onto the axis. The target is `launchSpeedFor(gate, cog.y, topSpeed)`: the hinge speed at which the centre of gravity leaves the lip on a ballistic arc through the ring — `v_lip² = g·d² / (2·cos²a·(lipY + cog.y + d·tan a − ringY))`, plus the climb up the deck, `v² = v_lip² + 2·g·lipY`, and 4 % over for the deck's friction, clamped to 4 m/s..top speed; a ring higher than any arc reaches (a drop under 5 cm), or one with no ramp, reads as flat out. The analysis (R18) re-derives the same number for every craft in the catalog, which is why it is exported from `@engine`.
7. **The lean.** On the deck (`onRamp`), or on the next air gate's ramp footprint (`onRampDeck`), full lean back. In the air, a PD toward `airPitch` = 0.08 rad (a touch nose-up lands flatter through the slam): `lean = (airPitch − pitch) · airGainP − pitchRate · airGainD`, gains 2.5 and 0.9. The bot never holds the lean back through the lip's `pullWindow`, so it never earns the backflip's pull.
8. **Giving up.** After two seconds of run, the bot fires `reset` when it is on the ground at under 0.5 m/s, WEDGED (a hit's cooldown running, under 0.8 m/s, afloat), or IDLE — no gate taken for `giveUpAfter` = 40 s of run clock since the later of `progress.lastGatePassedAt` and `progress.lastResetAt`. A rider that lost does not ride on into the next county, and a reset that lands it somewhere it still cannot get out of resets again forty seconds later, not never. A capsize is not a reset: the engine rights the hull where it lies (`TUNING.capsize`), and the bot waits.

The profile is data (`BotProfile`); `RIDER_BOT` is the default and the profile every table in this document is measured with. A slower or faster rider is a new profile, not a code fork. There is no artificial handicap and no knowledge a player lacks: the bot reads the bearing, the gate, the ramp, the rocks and the shallows the HUD and the eye can see — the state, the level's own geometry and `limits.ts`, never a force or a probe. The `bot-improvement` skill owns the loop.

## The harness (`engine/sim/simulate.ts`)

`simulateStage({ seed, craft?, level?, wind?, profile?, maxSeconds? })` stands up a run (`createGame`, `quiet`), steps it with the bot until the run finishes or `maxSeconds` (default `SIM_SECONDS` = 360) of sim time have passed, and returns a `RunReport`:

| Field                                                           | What it is                                                                                                  |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `seed`, `craft`                                                 | The run's inputs.                                                                                           |
| `finished`                                                      | Whether the last gate was taken before the timeout.                                                         |
| `time`                                                          | The run clock at the finish (or the timeout), s, penalties included.                                        |
| `gates`, `gatesPassed`, `gatesMissed`                           | The course's gate count; how many were taken; how many were skipped and charged.                            |
| `courseLength`                                                  | The path's length, m — so a pace can be quoted across seeds whose courses differ.                           |
| `topSpeed`                                                      | The highest `craft.speed` seen, m/s.                                                                        |
| `airTime`                                                       | Seconds with nothing on the hull touching anything.                                                         |
| `launches`, `dives`, `hits`, `groundings`, `resets`, `capsizes` | Counts of those events.                                                                                     |
| `maxHs`                                                         | The biggest significant wave height met, m — `seaSummary` at the craft's offshore distance, every 30 steps. |
| `events`                                                        | The whole event log.                                                                                        |
| `digest`                                                        | The determinism fingerprint (below).                                                                        |

**The digest** is an FNV-1a hash mixed, every 30 steps, with the craft's `x`, `z` and `speed` (rounded to centimetres and cm/s, low byte), and with the final `x`, `y`, `z` at the end; printed as eight hex digits. The same 30-step cadence samples `seaSummary` at the craft's offshore distance for `maxHs`. The same seed, craft and level always produce the same digest — `tests/simulation_test.ts` and `tests/determinism_test.ts` both assert it, and a different seed (which gusts differently) produces a different one. It is strictly stronger than "finishes": a change that is deterministic but DIFFERENT moves it, so a deliberate physics change shows up as a changed digest in the sim table, in its own diff.

## The CLI (`scripts/simulate-run.mjs`, `make sim`)

```sh
make sim                                  # seeds 1, 7, 38, 123 × every craft
make sim SEEDS=38,39 CRAFT=marlin          # specific seeds, one craft
npm run sim -- --craft skiff,dart         # a comma list
npm run sim -- --max 500                  # give a run longer than 360 s to finish
npm run sim -- --json examples/sim-report.json   # the rows, events dropped
npm run sim -- --assist 0                 # ride the BARE physics, neither arcade hand
npm run sim -- --ramp-assist 0            # ...or the ramp's hand alone, off
npm run sim -- --help                     # every flag with its default
```

`--assist` is the run's arcade dial (`GameState.assist`, `TUNING.assist` — the arcade's hand in `docs/riding.md`), and it moves BOTH hands: the landing caught at the end of a flight and the slide taken out of a run up a ramp. `--ramp-assist` moves the ramp's alone (`GameState.rampAssist`), for a before-and-after over that one. Both default to what the game ships with, so the table measures the game as it is played. `--assist 0` is the physics underneath all of it, and it is how a before-and-after over either assist is taken; it is also the comparable baseline for a roster read taken before the assist existed. The bot flies its own landings (an air PD on the pitch, which folds the assist away in proportion to the lean it is holding), so the two tables are closer than the flight bench in `docs/riding.md` is — but they are not the same table, and a balance claim should say which one it was read off.

The default seeds are the ones `examples/seeds.md` describes, so the table CI prints is a table somebody has looked at the plans of. The run cap is `--max` = `SIM_SECONDS` (360 s of sim time per run), stated once in `engine/sim/simulate.ts` and read by the CLI and `tests/simulation_test.ts` alike; `make sim ARGS="--max 500"` passes anything else through. An unknown flag exits 2 (`scripts/lib/cli.mjs`).

The table, one row per seed × craft:

| Column                               | Meaning                                         |
| ------------------------------------ | ----------------------------------------------- |
| `fin`                                | `yes` / `NO` — the run finished inside the cap. |
| `time`                               | Run clock, s, penalties included.               |
| `gates`                              | Taken / total.                                  |
| `miss`                               | Gates skipped and charged 5 s each.             |
| `top`                                | Top speed, km/h.                                |
| `air`                                | Seconds airborne.                               |
| `lnch`, `dive`, `hit`, `grnd`, `rst` | Launches, dives, hits, groundings, resets.      |
| `maxHs`                              | The roughest water met, m.                      |
| `digest`                             | The fingerprint.                                |

The report's `capsizes` count has no column; it is in the `--json` rows.

The footer is one line per craft over every seed it rode: runs finished, mean PACE over the runs that finished (course length over time, km/h — pace rather than time, because the seeds build courses of different lengths and times across them cannot be added), top speed, air per run, and the totals of launches, dives, hits, groundings, resets and missed gates; then `N/M runs finished`. **CI's `simulate` job is this command, and it exits non-zero when a craft finishes NO seed at all** — a hull that cannot get round any course is a broken hull, not a slow one.

At the current numbers (`make sim`, the default four seeds, engine 0.1.0):

```
skiff   4/4 finished · pace 49.8 km/h · top 89 km/h · air 4.1 s/run · launches 9 · dives 0 · hits 1 · groundings 1 · resets 4 · missed 1
marlin  4/4 finished · pace 58.6 km/h · top 114 km/h · air 7.2 s/run · launches 17 · dives 0 · hits 3 · groundings 0 · resets 4 · missed 2
otter   4/4 finished · pace 39.9 km/h · top 87 km/h · air 4.5 s/run · launches 11 · dives 1 · hits 3 · groundings 0 · resets 7 · missed 4
dart    4/4 finished · pace 53.4 km/h · top 76 km/h · air 3.6 s/run · launches 9 · dives 0 · hits 0 · groundings 0 · resets 2 · missed 4

16/16 runs finished
```

The cap is 360 s rather than 120 because a course-first level (R24) runs in every direction relative to the swell: the same skiff rides seed 3 (wind 8.5 m/s) at 40 km/h and seed 2 (13.5 m/s) at 25, and the slowest of the twelve runs over seeds 1 to 3 — the dart on seed 2 — finishes at 316 s. A hull meeting a head sea on half its legs is a slow run, not a broken one.

**The workflow rule: run it before and after, read the diff, paste both tables in the PR.** A handling, water or generator change is not reviewed on the prose.

## How to read a regression

Columns move for reasons, and the reasons are what the diff is for:

- **`fin` turns `NO`, `rst` climbs, `time` climbs past the cap** — the bot cannot ride the level. A reset every forty seconds with no gate between them is the idle timer firing (`giveUpAfter`): the bot is stood somewhere it cannot leave, and `make level SEED=` shows what is between it and the next gate. After a generator change, the level got harder than the rider (a ramp aimed at nothing, a gate in the rocks — `make level SEED=` shows it); after a handling change, the craft got harder than the rider (it will not turn onto a ramp's axis, it dives on every landing — `make ride` shows it); after a bot change, the rider got worse. The counts say which.
- **`miss` climbs with `air` steady** — rings are being sailed over or under: the launch pace is off. R18 places rings for the catalog's design lip speed, so a change to a craft's `cog.y`, its top speed or `launchSpeedFor` moves this first.
- **`top` falls, `time` climbs, pace falls in the footer** — the hull lost speed: drag, the pump, the planing lift, or a heavier sea (`maxHs` says whether the water changed).
- **`dive` climbs** — landings got worse: the slam, the bow's lift, the rider's air authority, or the ramps' angle.
- **`hit` and `grnd` climb** — the line got worse or the rocks moved: a bot or a generator change, not usually a hull one.
- **`air` falls with `lnch` steady** — lower or shorter flights: the launch speed, the ramp geometry, or the aero.
- **Only `digest` moves** — something changed and nothing measurable did. Expected for any physics edit, however small, and for any extra draw off `state.rng` (the wind draws every step; a new draw anywhere shifts every digest). Unexpected after a "no functional change" refactor: that is a determinism regression, and `tests/determinism_test.ts` will say the same.

One seed cannot show a distribution; four seeds × four craft is the floor, and `SEEDS=` widens it. The `simulate-run` skill owns the reading.

## What the tests pin down

`tests/simulation_test.ts`: every craft finishes the synthetic shore inside a minute, takes the ramp, hits nothing and misses at most one gate; the skiff threads the ring and dodges the skerries; sixty seconds of chop, a gale with a ridden reset, and a placed flight into a capsize onto a beach all stay finite; the bot finishes three generated seeds (1, 2, 3 on the skiff, `SIM_SECONDS` cap) at 18–100 km/h of pace with at most two resets and every gate taken or paid for; the same seed digests the same twice. `tests/determinism_test.ts`: a scripted run replays identically, the bot's digest repeats, a different seed differs, the bot is a pure function of the state, and nothing in `engine/` reads a clock, a global random source or the console (`tests/imports_test.ts` holds the same from the import graph's side).

## Screenshots close the loop

The sim says whether the bot finished; it does not say whether the ride LOOKS right. `make screenshots SCENE=` drives the built app to the same staged moments (`pwa/src/game/scenarios.ts`) at the two reference viewports, and `make ride SCENARIO=` draws the same moments through the engine alone — the `playtest` and `test-scenario` skills own those halves.
