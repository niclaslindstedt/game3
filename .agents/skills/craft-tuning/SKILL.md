---
name: craft-tuning
description: "Use when changing WHAT SEPARATES ONE CRAFT FROM ANOTHER — adding a craft, retuning the roster, moving a per-craft number, or answering 'why is one craft best everywhere'. Owns the catalog (`engine/game/defs/craft.ts`: the skiff, the marlin, the otter, the dart), what every per-craft knob buys, the derived expectations (`topSpeed`, `accel0to50`) a test holds the physics to, and the roster sweep with `make sim` that is the only honest test of whether the craft are actually different. Not the LOOK of a craft (`craft-design`) and not the shared hull model (`craft-physics`)."
---

# Tuning the craft against each other

This skill owns **one question**: is each craft in the roster an ANSWER to a
kind of water, or are they four points on one scale with a winner?

The answer is measured, never asserted. `make sim` rides all four over the
same seeds, and **any change to `defs/craft.ts` owes that table, before and
after.**

**Read this skill's lessons first** —
`node scripts/skill-lessons.mjs craft-tuning --list`.

| Load beside this one | For |
| --- | --- |
| `craft-physics` | the SHARED hull model every craft inherits — the forces read the row, the row never branches the model |
| `simulate-run` | reading the `make sim` table and its columns |
| `bot-improvement` | when the bot cannot exploit what you just gave a craft |
| `craft-design` | how a craft LOOKS — a different craft entirely |

## The roster

Four ids, invented names, no real brands. Each is a kind of water and a kind
of rider:

| Id | Character | Owns | Pays |
| --- | --- | --- | --- |
| `skiff` | Light runabout | Quick off the mark, nimble through tight gates | Skittish in chop — light and short, it launches off everything |
| `marlin` | Heavy performance | The fastest top speed, the longest legs on open calm water | Needs room: slow to turn, a wide line through tight gates |
| `otter` | Stable touring | The heaviest and softest over waves — fewest dives, the quiet ride in a head sea | Slow to accelerate, slow to turn |
| `dart` | Stand-up | The lightest and most agile — the tightest line there is | The least stable: rolls easily, lands hard, hates a swell |

Real PWC reference points, so the numbers stay honest: 250–400 kg dry,
60–230 kW, 80–110 km/h, deadrise around 20°. The catalog stays inside those
bands; a craft outside them is a different vehicle.

## Where the numbers live

| Layer | File | What it decides |
| --- | --- | --- |
| The catalog | `engine/game/defs/craft.ts` | how much of each thing THIS craft has |
| The magnitudes | `TUNING.hull`, `.jet`, `.rider`, `.aero`, `.air` | how strong each effect is, for everyone |
| The ceilings | `engine/game/limits.ts` | what any craft may reach — read by the model AND the bot |

`craft.ts` reads the spec's numbers into the shared model. **Nothing in
`craft.ts` or `hull.ts` branches per craft** — a new behaviour is a new field
on the row that the model reads, never an `if (spec.id === …)`.

## What each per-craft knob buys

| Knob | Moves |
| --- | --- |
| `mass` (dry kg) | EVERYTHING — unlike a car on gravel, mass is in the longitudinal model here: acceleration, the hump, the slam, the roll. With `displacement`, the draft |
| `displacement` (m³) | The hull's volume → density = mass/volume decides how it sits; more volume is more reserve buoyancy and a softer ride, at the cost of a bigger wetted area |
| `length`, `beam` | The probe footprint: length is pitch stability (long = calm in chop), beam is roll stability AND planing lift (Savitsky's B²) |
| `deadrise` (deg, 16–24) | Soft vs fast: a deep V slices chop and dives less, a flat bottom planes earlier and slams harder |
| `cog` offsets | Where the weight sits: aft is a nose-up trim and a quicker plane, forward is a bow that buries. Every row carries `z` at the same FRACTION of its own length (12%), because that is what the trim answers to. It is also the roster's steering lever — the nozzle is fixed at the transom, so mass moved aft is arm taken off the bucket, and the marlin's braked corner is the first thing to fail |
| `powerKw`, `maxRpm`, `idleRpm`, `torque` curve | The engine: how much, how high it revs, where the shove lives |
| `nozzleDiameter`, `impellerPitch` | The jet: pitch sets V_j per rpm (top speed), diameter sets the flow (thrust at low speed — the hole shot) |
| `nozzleAngle` (rad) | How hard it turns — the whole of the steering authority under power |
| `cdA` | Aero drag: what caps the top speed once the hull is on the plane |
| `lateralCd` | The keel's bite: how hard it carves vs how much it skids — the marlin's is low, the dart's high |
| `riderMass`, `riderHeight` | The lean's moment arm and the roll's: a tall rider on a light hull is the dart's instability |
| `topSpeed`, `accel0to50` | NOT knobs — EXPECTATIONS (km/h, s) derived from the row, held by `tests/craft_test.ts` within a tolerance |

## The measuring loop

1. **Baseline**: `make sim` on the clean tree — all four craft over the
   default seeds — and `make ride SCENARIO=cruise` for the craft being
   moved.
2. **Move numbers in `craft.ts`.** One axis per change: a craft's identity
   is easier to read when one thing moved.
3. **Re-derive the expectations.** If `mass`, `powerKw`, `impellerPitch`,
   `cdA` or the hull's dimensions moved, `topSpeed` and `accel0to50` move
   with them — run `npx vitest run tests/craft_test.ts`, read the measured
   values it prints, and write the NEW expectation on the row if the
   measured one is the one you meant. The tolerance is the one literal;
   never widen it to make a row pass.
4. **Re-run the sweep.** Read it for the roster's shape (below) and the
   plain columns for regressions.
5. **Probe the feel** for anything the table cannot see — see below.
6. **Paste both tables, before and after, in the PR.**

### Reading the sweep for the roster

A healthy roster, read off `make sim`'s rows grouped by craft:

- the **marlin** has the highest `top` and the best `avg` on the calmest
  seeds (lowest `Hs`);
- the **otter** has the fewest `dive`s and the best `avg` on the roughest
  seeds (highest `Hs`);
- the **skiff** and the **dart** are quickest on the seeds with the tightest
  gate spacing (`make level` says which), and the dart the more agile of
  the two at the cost of more dives;
- **nobody is worst everywhere.**

The tally matters less than that shape. A 0.5% "win" is a coin flip, not an
identity — do not spend rounds chasing one. Two craft within a percent on a
kind of water are equal there.

### Reading the plain columns for regressions

`fin`, `miss`, `dive`, `ground` are the ones a craft change moves and the ones
that matter: a craft nobody can keep on the course is not a fast craft.
`dive` separating by craft is the model working (the dart SHOULD dive more
than the otter); `dive` growing for all four is a physics change wearing a
catalog change's clothes — say which in the PR.

## The traps, in the order they bite

1. **A knob the BOT cannot use never shows up as pace.** The bot aims and
   holds the throttle; a craft whose identity is "rewards feathering the
   throttle over a crest" reads as identical in the table however correct
   the physics is. Before tuning a new catalog property, check that the
   bot's riding exercises it — or say in the PR that it deliberately does
   not, and probe it by hand.
2. **The sea is the strong axis.** A seed's `Hs` moves pace by more than
   any catalog number; compare craft at similar `Hs`, or across the whole
   sweep, never on one rough seed.
3. **`topSpeed` is a closed loop.** Thrust falls as V_in rises, drag rises
   as V², the plane lifts the hull out of its own drag — the top speed is
   where those meet, and no single knob sets it. Moving `impellerPitch` up
   without power to spin it moves rpm down, not speed up.
4. **A heavier craft is not a slower craft, past the hump.** Mass costs
   acceleration and the hump; on the plane the lift carries it and the top
   speed is power against drag. The otter's slowness is its `cdA` and its
   beam, not its `mass` alone.
5. **Density is a draft, and a draft is everything.** `mass / displacement`
   near the water's density is a hull sitting deep, planing late, slamming
   soft; well under it is a cork. Move `displacement` with `mass`, or the
   craft's whole character moves with it.
6. **Sub-1% is noise.** Two craft within a percent on a kind of water are
   equal; re-tuning to flip that is rounds spent on nothing.

## Probing the feel

The table cannot see whether a craft carves or skids, how it takes a crest,
or whether the lean reaches. Stage it (the `test-scenario` skill):

- `make ride SCENARIO=carve` per craft: the roll angle and the speed bled
  through a held turn. The dart rolls most, the otter least; the marlin
  bleeds the most speed for the widest line.
- `make ride SCENARIO=chop` per craft: the pitch amplitude and the slam
  count. The otter's should be the smallest, the skiff's the largest.
- `make ride SCENARIO=cruise` per craft: where the plane starts (the
  planing column crossing 0.5) and the speed it settles at — the hump and
  the top, both against the row's expectations.

`tests/craft_test.ts` is the permanent version of these probes (top speed
and acceleration per row within tolerance; turn radius with vs without
throttle; the off-throttle steering loss); extend it rather than re-deriving
them.

## Adding a craft

A new craft is a row in `CRAFT`, a style in `pwa/src/game/craft-styles.ts`
(load `craft-design`), a place in the sweep (it runs all rows by default),
and its expectations derived by the test. Give it a KIND of water to own and
a kind to be worst on, then prove both. A craft that is never worst at
anything and never best at anything is the one shape a roster cannot use.

## Documentation sync

`docs/riding.md` states the roster and what each knob buys; README's What
names the four craft. Both move with the catalog.

## Skill self-improvement

Record traps and heuristics as lesson fragments under
`.agents/skills/craft-tuning/.lessons/` via the **`skill-reflection`** skill;
it owns pruning, merging and promoting them into this file.
