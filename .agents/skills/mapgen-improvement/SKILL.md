---
name: mapgen-improvement
description: "Use when improving the LEVEL GENERATOR (engine/mapgen/) — the rules engine that builds every stretch of shore, the water beside it and the course along it fresh from its seed. Owns the module split (rules.ts data / generate.ts search / compile.ts geometry / shore, geology, course, biomes), the R-rules and where each is stated, and above all the LOOP: write, generate, ANALYZE (`make analyze` scores the level and names what is wrong with it), fix, reflect on whether the analyzer measured the right thing, LOOK with `make level`, iterate on that seed until it is clean, then take another seed. Also the invariants (determinism, sub-seed rejection, docs sync) that are load-bearing and easy to undo by accident."
---

# Improving the Level Generator

A change here lands on **every level on every seed at once** — every seed a
player shares, every level in every test sweep, every campaign level the
future ladder is built from. That leverage cuts both ways: a regression you
cannot see on the seed you happened to draw is still shipping on the other
several thousand.

Which is why the centre of this skill is not the rules. It is the LOOP.

**Before starting, read this skill's lessons** —
`node scripts/skill-lessons.mjs mapgen-improvement --list`, then the ones this
task touches (`--scope=…`, `--concepts=…`). Load **`skill-reflection`** at
both ends of the session, and **`write-code`** beside this one.

---

## THE LOOP

```
   1. write code
   2. generate a level          make analyze SEED=7    (builds it and scores it)
   3. run the analytics         …read the FINDINGS, not the score
   4. improve the generator     fix the worst finding
   5. reflect on the ANALYSIS   was that a defect, or a check measuring wrong?
   6. LOOK                      make level SEED=7      (the plan, every gate labelled)
   7. iterate on this seed      until it comes up clean
   8. take a different seed     and do it all again
   9. when several seeds hold   make analyze over a sweep, make sim, then commit
```

The two halves of every pass, and neither is optional:

```sh
make analyze SEED=7          # MEASURE: every finding, with the gate or the place it names
make level SEED=7            # LOOK: depth shading, the shore, solids, gates numbered, ramps, the wind arrow
```

`make level` (`scripts/level-map.mjs`) draws the plan — the sea bed shaded by
depth, the shoreline, every skerry and boulder, every gate NUMBERED in course
order (`G1`…), every ramp before its air gate, the start, the wind arrow —
and prints a table saying what each gate is: kind, offshore distance, depth
under it, spacing from the last, and for an air gate the ramp's angle and
the run-up it has. A claim about "the second air gate on seed 7" is a claim
about a row in that table. Engine only: no build, no browser, a couple of
seconds. Both halves are Node; the PNG comes out of `scripts/lib/png.mjs` and
`draw.mjs`.

**Step 5 is the one that is easy to skip and the one that makes the rest worth
doing.** An analyzer is only as honest as its checks, and the fastest route to
a clean sweep is to measure things that were never going to fail. Every time a
finding comes up, ask which of three things it is:

| The finding is… | Do |
| --- | --- |
| A real defect | Fix the GENERATOR. This is the normal case and the point of the tool. |
| A check measuring the wrong thing | Fix the CHECK, in `engine/analysis/`. Say why in the comment. |
| A real property of the game, scored as a fault | Move the threshold in `budgets.ts` — **and only with a MEASUREMENT behind it.** |

Telling the first row from the second: **instruments agreeing on a LOCATION is
evidence, and a finding that appears on every seed at the same VALUE is the
measurement bug.** Two checks firing at one gate are two views of one defect;
two checks reporting 1.50 m on every seed are one check reading the clamp.

That third row is where honesty goes to die. A threshold moved because a seed
failed it is a threshold that will be moved again next time. A threshold moved
because `make sim` shows four craft clearing those ramps with zero dives is a
threshold with evidence under it — write the evidence into the comment, so the
next session can judge it instead of inheriting it.

**Never widen a budget to make the exit code green.** The exit code is
information. A sweep that reports a dozen findings is a working instrument
pointing at a queue of work; the same sweep reporting zero after somebody
doubled the tolerances is a broken one — and the generator REJECTS on the
analyzer's verdict, so a widened budget ships the level it was meant to refuse.

### If it can be measured, the ask comes with a CHECK

**When somebody asks for something to be added or fixed here, and no existing
check can tell whether it is right, writing that check is part of the job —
not a follow-up.** Ship the change and the instrument together, in the same
pass.

The reason is that this generator has no other memory. A level is built fresh
from its seed every time, so a quality nobody measures is a quality that
survives exactly until the next tuning pass moves a number underneath it.
"Skerries should stand in the outside of the bends" without a check is a
number somebody will smooth out in six weeks, on a seed that looked better for
it, with nothing to say it got worse.

So, for any ask:

1. **Name the property in one sentence** — "every gate has water under it",
   "the ramp has room to build speed", "the course goes out to sea somewhere".
2. **Ask whether an existing check already covers it.** Extend the check if it
   nearly does; a new one if it does not.
3. **Decide the shape of the check before the threshold.** Most defects are a
   floor or a ceiling (depth, run-up, clearance). Anything with a RIGHT AMOUNT
   is a BAND — gate spacing, course length, the offshore band, the share of
   air gates: a course with no air gates is as wrong as one that is all air
   gates, and only a band says so.
4. **Put the threshold in `analysis/budgets.ts` with the reason next to it.**
5. **Then build the thing** — and use the check to tell you when it is right,
   which is the entire point of having built it first.

A property that genuinely cannot be measured — "does this shore look like the
Bothnian coast" — is what `make level` and the screenshots are for. Say so out
loud when that is the answer, rather than inventing a number that stands in
for it badly; a check measuring a proxy nobody believes is worse than no
check, because it will be optimised against.

---

## The modules, and their jobs

| File | Job |
| --- | --- |
| `types.ts` | **The level as everyone else sees it.** `Level`, `Gate`, `Ramp`, `Solid`, `Course`, `Wind`, `WaterBody`. Shared with the craft, the collision engine, the renderer and the labs — an exported shape here is changed with the orchestrator told first. |
| `rules.ts` | **The rule book.** Every constraint and vocabulary number as DATA, each an R-rule stated once and mirrored verbatim in `docs/level-generator.md`. Tuning the generator means editing this file. |
| `biomes.ts` | **The countries.** One row per `BiomeId`: what the shore is made of, the relief, the water's density and temperature band, the wind band. Only `taiga` is built; the other ids are reserved so a seed never re-rolls when a country is added. Nothing else in `mapgen/` names a country. |
| `route.ts` | **THE RACING LINE, drawn first (R24), and the OCEAN LEG in it (R25).** A free walk in the plane with bounded curvature that turns, doubles back and steers away from itself. Everything else in a level is built around it. |
| `river.ts` | **The water that runs on past the race (R26).** A meandering walk inland from the most inland station of the route, thinning from the corridor's own half-width to a creek nothing can ride. Stamped into the same field as the route, so nothing downstream knows it is not the route. |
| `basin.ts` | **The water carved round it (R15)** — the corridor, the open sea, the islands cut out of both — baked into ONE signed `offshore` field, plus `traceCoast`, which is where `Level.shore`'s coastlines come from. |
| `geology.ts` | **The ground under the water and behind the shore.** The bed's profile and the land's step, both as functions of the offshore distance the basin baked; R21's character as a field over the plan. |
| `course.ts` | **The race, laid ON the route.** Gates by distance, the air gates and their ramps with their windows cut straight, the start behind gate 1. There is no search for a line: the corridor was drawn to hold R1 and R5. |
| `generate.ts` | **The search.** Draws a route, the basin round it, then a course, validates against the rules, retries bounded, rejects a whole attempt and re-rolls a sub-seed rather than ever shipping a violation. `generateLevel(seed, opts?) → Level`. |
| `compile.ts` | **The geometry.** Bakes the two heightfields (`ground`, `offshore`; cell 4 m), the surface classifier, the solids and the course into the `Level` — the single geometric truth read by physics, renderer, bot and labs alike. |
| `index.ts` | The block `engine/index.ts` re-exports. |
| `fauna.ts`, `weather.ts` | Placeholders with a header comment: what will live there. Not this session's. |

And the scoreboard, which is NOT in `mapgen/` on purpose:

| File | Job |
| --- | --- |
| `engine/analysis/index.ts` | `analyzeLevel(level) → { findings, ok }`, and the checks about the COURSE. It reads `mapgen` AND `game`, so it sits above both — a check about the craft's clearance imports the real hull margin rather than keeping a copy. |
| `engine/analysis/coast.ts` | The other half: the checks about the SHORE and what stands on it (R15, R16, R17, R21). Split by subject, not by size — none of them knows a gate exists. |
| `engine/analysis/report.ts` | The `Finding`, the `Report` both halves push onto, and the two formatters. |
| `engine/analysis/reach.ts` | The two checks about where a level goes BEYOND the coastal band: R25's ocean leg (found by walking the path, not read off a route — a `Level` carries no route) and R26's river. |
| `engine/analysis/budgets.ts` | **Every threshold, as data.** `rules.ts`'s opposite number: that one says what may be BUILT, this one says what the result has to COME OUT like. |

Keep the splits. A placement decision in `compile.ts`, a geometric fudge in
`generate.ts`, or a bare threshold inside a check instead of in `budgets.ts`,
is how these modules rot.

**The generator's budget and the analyzer's are OPPOSITE.** The generator
runs in the game, on a phone, every time a level starts, and then its
heightfields are queried thousands of times a second for as long as the run
lasts — it has to stay fast. The analyzer runs here and inside the generator's
reject loop, so it may be dearer than what it measures, but not by so much
that the loop stops being a loop: a seed is well under a second, a sweep of
eight a few seconds. A new check that makes a sweep take a minute needs to get
cheaper.

---

## The rules of the shore

The generator's job is not just legality, it is PLAUSIBILITY — a level has to
read as a stretch of Bothnian coast somebody laid a course along. Each of
these is also a CHECK, which is the point: a rule that is only prose gets
undone by the next tuning pass without anybody noticing.

- **The shore is the level; the land is a backdrop.** Land is only meaningful
  within ~100 m of the shore, is clamped low (≤ ~25 m) and fades to a plateau
  beyond — no towering cliffs; this is the Baltic, not a fjord (that is a
  reserved biome). → the land-extent check
- **The course follows the shore, within reach of it.** Every gate within 100
  m of the shoreline (`offshore ≤ 100`), the path staying 15–100 m out, so
  the shore is always in the frame and the sea is always building. → the
  offshore band check
- **There is water under the craft, everywhere on the line.** Depth ≥ 1.5 m
  along the whole path, and no solid within the hull's margin of it — a
  skerry beside the line is drama, a skerry on it is a wall. → the depth and
  clearance checks
- **An air gate is EARNED.** A ramp 25–40 m before it, 60 m of clear water to
  build speed before the ramp, and the ring where a launch from that ramp at
  that craft's speed actually goes. → the run-up and the ring-height checks
- **Gates come at a rhythm.** Every 80–150 m; a course of 1.2–2.0 km; two or
  three air gates. → the spacing and length bands
- **The sea builds seaward.** The wind is drawn with a seaward bias so waves
  grow as the course swings out; `offshore` is what the wave model reads as
  FETCH, so a course that never leaves the shore never meets a swell.

When something looks wrong on the plan, ask which rule of the shore it breaks
before reaching for a number.

---

## The knobs

A COUNTRY first (`biome`, only `taiga` today), then what a seed draws for
itself: the wind (2–12 m/s, seaward-biased), the hour, the water's
temperature (8–18 °C for the taiga) and density (1005 — brackish). None of
these is a slider anybody was asked about; they say which DAY on which COAST a
seed is, and `generateLevel(seed, opts?)` carries them on the `Level`.

Analyze at the extremes, not only at the defaults: the strongest wind the
biome allows is where a ramp's run-up stops being clear water, and a rule
that breaks at a band's end is the most common way a rule stops being one.

---

## Extending the vocabulary

A new level ingredient follows the settled pattern, in order:

1. Its type in `types.ts` (with the orchestrator told), and its placement
   rules in `rules.ts` — data first; if the constraint can't be expressed
   there, the design isn't ready.
2. Placement in `generate.ts` / `course.ts` / `shore.ts`, and the validation.
3. Geometry in `compile.ts` — the `Level` carries what physics, bot and
   renderer need, and it is the ONLY channel.
4. An R-rule stated in prose in `rules.ts`'s header AND
   `docs/level-generator.md`.
5. An invariant test across seeds in `tests/mapgen_test.ts`, over the shared
   corpus in `tests/support/levels.ts`.
6. **A CHECK in `engine/analysis/`, with its thresholds in `budgets.ts`.** A
   test says the rule held on the corpus; a check says how well it is
   holding on whatever seed anybody is looking at — and the generator rejects
   on it, so it is what makes the feature part of the loop rather than a
   thing that was added once.
7. Physics (`collision.ts` for anything the hull can touch — the `collision`
   skill), the bot (it has to be able to TAKE the thing — `bot-improvement`),
   and rendering (`gates.ts`, `rocks.ts`, `terrain.ts`).
8. A row on `make level`'s plan and table.

Skip 4, 5 or 6 and the rule exists only as behaviour — the next tuning pass
undoes it without knowing it was ever a rule.

---

## Invariants — load-bearing, and easy to undo by accident

- **`generateLevel(seed)` is a pure function of the seed.** Every draw comes
  from a PRNG derived from it (`engine/lib/prng.ts`). Shareable seeds, the
  sim digests and the test corpus all hang off it. So does the analyzer: a
  report that differs between two runs of the same seed means something is
  reading a clock or a global.
- **Reject, never repair.** A candidate that violates a rule is retried; a
  failed attempt re-rolls with a DERIVED sub-seed, bounded, and the whole
  attempt is thrown away rather than patched. A "fix it up afterwards" pass
  is how subtle violations ship. And the sub-seed derivation is part of the
  contract: change how it is derived and every seed re-rolls.
- **The analyzer is the generator's gate.** `generate.ts` rejects on
  `analyzeLevel(level).ok`, so a budget is a rule with teeth. A check that
  fires on every seed is a generator that never terminates — the attempt
  bound is what turns that into a loud failure instead of a hang, and
  `tests/mapgen_test.ts`'s seed population is where it shows first.
- **Two heightfields, one cell size, one truth.** `ground` and `offshore` are
  both 4 m cells, and everything downstream samples them bilinearly
  (`sampleField`). Anything that has to land ON a cell searches the field or
  carries the index it was built with; `Math.round(x / cell)` is off by a
  cell at the far bound.
- **The `offshore` field is a DISTANCE, signed.** Positive out to sea,
  negative inland, metres from the nearest shore point. The wave model reads
  it as fetch, the course rules bound it, `make level` shades it — a field
  that is only a mask breaks all three.
- **A ramp is a plane the probes ride on, hinged at the water.** Its rear
  edge is at sea level, its angle is what launches the craft, and the ring
  it serves stands where a launch from it goes. Move the ramp's numbers in
  `rules.ts` and the ring height moves with them — that coupling is a check.
  Its WIDTH is coupled the other way: R9's run-up corridor is
  `ramp.width / 2 + solidMargin`, so widening a deck changes what
  `courseKeepOut` refuses and therefore where `laySolids` puts stone. The
  routes and courses stay bit-identical and the ROCKS move, which is why a
  ramp change is read off sim TALLIES over a wide sweep and never off a
  seed's row.
- **A PER-RUN DIAL goes in `pace.ts` beside R32, never in `rules.ts`.** A
  knob a difficulty setting will move (the speed class, the ramp's width)
  is four edits: a `GenerateOptions` field, a `Level` field carrying what
  was actually built (the analyzer is handed a `Level` and nothing else), a
  case in `rulesAtPace`, and the clamp applied ONCE in `generateLevel`.
  `rules.ts` is AT the §20.5 cap with no headroom, so the dial's band and
  its rule's prose live in `pace.ts`; and `rulesAtPace` must keep returning
  `LEVEL_RULES` ITSELF when every dial is stock, because the placer's
  keep-out reads that table and a copy re-rolls every seed. Most consumers
  need no threading at all — anything reading the built `Ramp` follows the
  dial for free.
- **Vocabulary numbers are a coupled system.** Gate spacing, the bot's
  aiming lookahead, the craft's top speeds and the run-up length all agree
  with each other. Lengthen the offshore band and the fetch — and so the
  sea — grows with it. That is what the sim sweep is for.
- **Levels must stay finishable by all four craft.** `tests/simulation_test.ts`
  is the contract.
- **A COUNTRY change is gated by its biome row.** Everything a new or changed
  country asks of the generator is a field on its `biomes.ts` row that the
  taiga's row holds at its neutral value, so no taiga seed re-rolls. Prove it
  rather than trust it: digest the corpus's seeds on `origin/main` and on the
  branch (a worktree with `node_modules` symlinked), and diff.

---

## Shipping

- **`make analyze` over a sweep of seeds before and after**, and the finding
  tally in the PR. That tally is the honest summary of a generator change:
  which classes went away, which appeared, which are still open.
  - **Compare TALLIES, never seeds.** Any change to the rules re-rolls the
    search, so seed 7 after is a different level from seed 7 before — its
    findings, its length and its gate count all move for reasons that have
    nothing to do with what you did. A seed-to-seed diff is noise wearing a
    number. The same goes for `make sim`: read the closing line over a wide
    sweep, not a row.
- **Both `make sim` tables** (before/after) in the PR — the `commit` skill's
  contract for generator changes. Bots must keep finishing and keep hitting
  gates; dives and groundings must not grow.
- **`make level` at more than one seed** and put the pictures in front of the
  user. A change that looked fine on seed 3 has been wrong on the next seed
  more than once.
- `docs/level-generator.md` updated if any rule moved (the verbatim list, and
  the scoring table if a check changed).
- A `.changes/unreleased/` fragment: generator changes are player-visible by
  definition.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth recording here:
a tell on the plan, a lever that reliably fixes a look problem, a coupling
between a rule number and the craft — and, specifically for the analyzer, any
check that turned out to be measuring the wrong thing, because that is the
failure mode this whole instrument has.
