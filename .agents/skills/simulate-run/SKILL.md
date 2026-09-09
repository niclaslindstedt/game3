---
name: simulate-run
description: "Use to measure the game's ACTUAL balance by running the real engine headlessly — bot-ridden levels across seeds and craft, reporting finish time, gates hit and missed, top speed, air time, launches, dives, hits, groundings, and the biggest sea met. The closing measurement loop of every craft, water or generator change: run it before and after, read the diff, and paste both tables in the PR. Also the owner of what the table's columns mean and which movements are regressions."
---

# Simulate Run

The sim is the balance team's wave tank: it rides the REAL engine —
`createGame`, `step`, the bot — at full speed with no renderer, and reports
what actually happened. Nothing in it models or approximates a rule; it IS
the rules, run fast. **Balancing this game means balancing pace and
feel-as-measured** — do bots finish, do they hit the gates, do they fly the
rings, do they stay off the rocks, how much sea did they meet — not tuning an
economy: there is no XP, no loot here. The regression surface is the table.

**Before starting, read this skill's lessons** —
`node scripts/skill-lessons.mjs simulate-run --list`, then the ones this task
touches. Reading them here and reflecting on them before the commit is the
**`skill-reflection`** skill's job — load it at both ends of the session.

## The tools

- **Engine module: `engine/sim/simulate.ts`** — `simulateStage({ seed, craft,
maxSeconds })`. Deterministic per options; returns a typed `RunReport`
  (finish time, gates hit/missed, top speed, air time, launches, dives, hits,
  groundings, the max `Hs` met, and the **digest** — a hash over sampled
  positions, the determinism fingerprint). The name is the blueprint's; the
  thing it simulates is a LEVEL.
- **CLI: `scripts/simulate-run.mjs`** — runs the sweep and prints the table.
  It is CI's `simulate` job.

```sh
make sim                              # the standard sweep: the default seeds × all four craft
make sim SEEDS=42,99                  # specific seeds (e.g. a bug report's)
make sim CRAFT=otter                  # one craft
npm run sim -- --count 20             # a wider sweep for a tuning decision
npm run sim -- --json report.json     # machine-readable dump
```

The CLI **exits non-zero if any run failed to finish**, so CI's `simulate`
job doubles as a smoke alarm — a tuning change that strands a bot goes red
without anyone reading the table.

## Reading the table

One row per seed × craft:

| Column | Meaning | Healthy movement |
| --- | --- | --- |
| `len` | Course length, m | Inside the rules' band (1200–2000) |
| `time` | Finish time, s | Tracks length; a blow-up means the bot got lost or stuck |
| `avg` | Average pace, km/h | PWC territory — see the band `tests/simulation_test.ts` pins; it falls with the sea |
| `gates` | Gates hit / gates on the course | **all of them** — a miss is a bot that could not aim or a gate that could not be taken |
| `miss` | Gates missed (passed the one after) | **0** — the penalty is real, and a miss the bot takes every time is a generator or bot bug |
| `top` | Top speed, km/h | Differs by craft (the marlin's taller top should show); near the catalog's `topSpeed` on calm seeds |
| `air` | Airborne seconds | **> 0 on every level** — there are always ramps; zero air means the ramps stopped throwing or the bot stopped taking them |
| `launch` | Launches | ≥ the air-gate count; more is the sea throwing the hull, which is fine in wind |
| `dive` | Nose-first landings that buried the bow | Small; growing means the launches got steeper or the bot stopped levelling |
| `hit` | Solid contacts | **≈ 0** — the course keeps the hull's margin from every rock |
| `ground` | Groundings | **≈ 0** — depth ≥ 1.5 m along the path is a rule |
| `Hs` | The biggest significant wave height met, m | Tracks the seed's wind and how far out the course goes; a jump across the sweep is a spectrum change |
| `fin` | Finished | **yes, every row** — a `NO` is a failure, full stop |

The footer aggregates: finished count, average pace, gates hit share, average
air time, total dives, total hits, total groundings — the one-line
before/after comparison.

## The workflow rule

**Run `make sim` before and after every craft, water or generator change, and
paste both tables in the PR description.** This is the contract in
CONTRIBUTING.md and the PR template. A change that makes bots stop finishing
or stop hitting gates is a regression until argued otherwise — and the
argument happens in the PR, over the two tables, explicitly.

## The roster read

`make sim` races all four craft over the same seeds, which is the roster's
balance table for free. Read it for the shape the `craft-tuning` skill
describes: the marlin fastest on the calmest seeds, the otter with the fewest
dives on the roughest, the skiff and the dart quickest through the tightest
gate spacing — and nobody worst everywhere. **Any change to
`engine/game/defs/craft.ts` owes this read**, before and after, in the PR.

## The knob loop

1. **Baseline**: `make sim` on the clean tree (or `--json baseline.json` for a
   wider sweep you'll want to diff mechanically).
2. **Edit the knob** — `engine/game/defs/tuning.ts` (global feel) or
   `craft.ts` (per craft). Never inline in the model; the `engine-system`
   skill owns where numbers live.
3. **Re-run and read the diff.** Did the change move what you intended — and
   nothing you didn't? A planing change that also halves air time is telling
   you the systems are coupled (less lift at the ramp's lip is a lower
   launch); understand why before shipping.
4. **Hold seeds fixed while dialing one knob**, then confirm across the full
   sweep. Runs are chaotic: one different wave early cascades into a
   different run, so a single-seed A/B proves nothing — the standard sweep is
   the decision-grade read.
5. **Check all four craft.** A knob that fixes the skiff's chop can sink the
   otter's — the sweep runs all four by default; keep it that way.
6. Run the sim-driven tests — `tests/simulation_test.ts` pins the contract
   (bots finish with every craft, hit every gate, pace stays in the band,
   digests reproduce), `determinism_test.ts` the fingerprint. If a tuning
   change breaks one of these, **the change is wrong or the test's world
   just moved — decide which explicitly, never silently.**
7. Finish with the `playtest` skill — the simulator measures numbers, never
   fun. A change can pass every band and still feel wrong at 60 fps.

## Caveats — what a bot run does and doesn't measure

- **The bot is a probe, not a proof of fun.** It rides like a competent
  human (see `bot-improvement`); it measures pace, gate-taking, and whether
  the level is rideable — it cannot measure whether a wave feels good.
- **Determinism is the instrument's calibration.** Same seed + craft ⇒ same
  digest. If two runs of the same options diverge, stop tuning: the engine
  has a nondeterminism bug (see `debug-game`), and every measurement is
  noise until it's fixed.
- **The bot and the physics are coupled.** A physics change can look like a
  regression because the BOT no longer suits the craft (e.g. it aims the
  ramp at a speed that now launches short of the ring). Decide whether the
  fix belongs in `tuning.ts` or in `engine/sim/bot.ts` — the
  `bot-improvement` skill — and say which in the PR.
- **The sea is a column, not a constant.** `Hs` varies by seed and by how far
  out the course goes, so pace and dives vary with it. Compare rows at
  similar `Hs` before reading a pace difference as a craft difference.
- **Generator changes are measured here too**: a rules edit that produces
  legal-but-unrideable geometry shows up as misses, groundings and DNFs long
  before a human rides it. Pair with `make level` to look at the levels the
  sweep rode (the `mapgen-improvement` skill).

## Skill self-improvement

Load the **`skill-reflection`** skill before this session commits. Settled
balance reads ("dives above N always trace to X", a column movement that
reliably diagnoses a cause) are exactly what belongs here — recorded as
fragments, promoted into the table above once they hold every time.
