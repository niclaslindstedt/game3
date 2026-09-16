---
name: level-rating
description: "Use when judging whether a generated level is any GOOD and how HARD it is rather than merely correct — choosing or replacing a CAMPAIGN rung, reading a generator change as what it did to the whole seed population, or calibrating one of the rating's scales. Owns `engine/rating/` (the eight axes, the difficulty index, the ladder scorer), `make rate` (the table, `--stats`, `CAMPAIGN=1`) and `make difficulty` (the schematic). Three loops: calibrating a scale from a measured population, shortlisting a ladder, and reading a rules change as a distribution. Not whether a level is BROKEN (`make analyze`, `mapgen-improvement`), and not the campaign's own table and locks (`campaign`)."
---

# Rating a level, and reading a ladder

`make analyze` asks whether a level is BROKEN, and the generator will not
hand one out that is. This asks the question that starts where that one
stops: of two shores that both pass every rule, which asks more of the
rider, and what does it ask FOR — the sea, the corners, the air, the rocks,
the distance, the wind, the dark, the sky. `engine/rating/index.ts`'s
header is the model; this is how it is used.

**Read this skill's lessons first** — `node scripts/skill-lessons.mjs
level-rating --list`. Load **`skill-reflection`** at both ends,
**`write-code`** beside this one for any code change, **`campaign`** when a
level is about to be pinned, **`mapgen-improvement`** when the answer turns
out to be a change to the generator, and **`simulate-run`** whenever a
level is about to move — the bot is the only thing that knows whether the
ladder climbs in the game rather than on paper.

## What the tools say

```sh
make rate SEEDS=7,38                       one row a seed: the raw readings, the eight axes, the index, what it LEADS on, its digest
make rate COUNT=48 BIOME=mangrove          a sweep to shortlist from
make rate COUNT=48 ARGS=--tricks           the same seeds built as tricks runs (R35)
make rate COUNT=24 TRACK=circuit           …or as circuits
make rate SEEDS=38 ARGS="--hour 21 --weather squall --wind 13"   under a pinned day
make rate COUNT=48 ARGS=--stats            the POPULATION per axis: min, quartiles, max, the share pinned at 1 and at 0
make rate CAMPAIGN=1                       the committed ladder audited as a set
make difficulty SEED=38 BIOME=mangrove     the schematic: the line by its corners, the sea along it, the rocks in reach, the panel
make difficulty CAMPAIGN=1                 one sheet per committed level
```

**Eight axes, each 0..1, none better than another.** Five are the SHORE's
(sea, corners, air, rocks, length) and three the DAY's (wind, dark, sky).
The index folds them on `RATING.weight`, about two thirds shore and one
third day. Every SCALE in `RATING.scale` is a normaliser read off a sweep —
a number a raw reading is divided by to land the population in 0..1 — and
not a rule.

**The character is the axes, not the index.** `leads` in the table is
the one word a shore's character is read as, and a ladder is built out of
the axes as much as the index: six shores that all lead on the sea are the
same shore six times however well they climb.

## Loop A — calibrating a scale

```
   1. make rate COUNT=48 ARGS=--stats     on BOTH coasts, as races, as tricks runs, as circuits
   2. read `at 1` and `at 0`              the share of the sweep pinned to either end
   3. move the scale, or the measurement  the decision below
   4. re-sweep and read it again
   5. LOOK at the extremes                make difficulty SEED=<best>, SEED=<worst>
```

| What `--stats` shows              | What it means                                                                 |
| --------------------------------- | ----------------------------------------------------------------------------- |
| An axis mostly at 1               | It measures nothing: raise the scale, or change the law (the sea went to a square root when a linear scale pinned a third of the sweep) |
| An axis mostly at 0               | A wish, not a measurement — the reach is too short (rocks were counted inside a berth R6 already guarantees is empty) or the generator cannot build it |
| Two axes moving together          | One is a restatement of the other; drop or re-aim it                          |
| An absurd max                     | A measurement bug, always: a ten-metre chord read as a hairpin (`CORNER_SPAN`) |

**Which to move — the scale or the measurement — is settled by LOOKING.**
Draw the seeds at both ends and ask whether the picture agrees with the
number. Two real ones: the corners axis read every level as tight until
the radius was read over sixty metres of chord rather than twenty; the
rocks axis read every level as clear until the reach stopped at the berth
the rule already enforces.

## Loop B — shortlisting a ladder

The failure this exists to prevent: sort the sweep by the index, keep the
top six. Every one is a good shore and the campaign is terrible, because
they score for the same reasons and are the same shore six times.

Hold a shortlist to a BRIEF instead, and read the index as a pass mark:

- every rung asks MORE than the one under it, by enough to feel
  (`LADDER.step`) and not so much it is a wall (`LADDER.wall`)
- no two rungs the same shore twice (`LADDER.apart`, on the closest PAIR)
- every kind of ask led on somewhere: a sea rung, a corners rung, a rocks
  rung, an air rung, a dark one
- the formats interleaved: a race, a tricks run, a circuit
- as few `make analyze` errors as the slot allows — the sweep prints them

**Try the day before the seed.** An hour, a season, a sky and a wind are
the cheapest levers the game has; a seed change re-rolls the shore. Then
confirm in the game — `npm run sim` on the candidate — because a rung the
index loves and the bot finishes quicker than the one below it is not a
harder rung. `make rate CAMPAIGN=1` reads the committed set and names the
flat rung and the duplicate pair; `campaign` owns the rest of pinning it.

## Loop C — reading a change to the generator

A rules change lands on every seed at once, so one seed cannot say what it
did. The population can.

```
   1. make rate COUNT=48 ARGS=--stats > before.txt    on a clean tree
   2. make the change
   3. make rate COUNT=48 ARGS=--stats > after.txt
   4. diff the two, per axis
   5. LOOK at a seed whose index moved most, before and after
```

Read the DISTRIBUTION, not the mean: a median that moved is the change
doing its job, a tail that grew is the interesting part, an axis that
stopped varying is a rule that has become deterministic. Same seed count,
same coast, same kind of level both times — the generator is deterministic,
so anything else is noise you introduced. And if the change moved a
campaign shore, `campaign`'s version contract is the next thing to read.

## Where everything lives

| Thing                                            | File                                    |
| ------------------------------------------------ | --------------------------------------- |
| The axes, the scales, the weights, the ladder scorer | `engine/rating/index.ts`            |
| The table and the sweep                          | `scripts/rate-level.mjs`                |
| The schematic                                    | `scripts/difficulty-preview.mjs` over `scripts/lib/level-draw.mjs` |
| Tests                                            | `tests/rating_test.ts`                  |

**Adding an axis.** It belongs here only if it is a different KIND of ask
from the eight — not a second reading of one of them — and it comes with
its scale read off a sweep and a `--stats` run in the PR. The weights sum
to one (`rating_test` holds it), so a ninth axis takes weight from the
others by an argument, not by a default.

**Never restate a number another module owns.** R23's floor is
`rulesAtPace(...).course.radius`, R12's band `LEVEL_RULES.wind.speed`, the
sky's heaviness `HEAVINESS` — read, never copied.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth a fragment
here: a scale that pinned after a generator change, an axis that turned
out to restate another, a picture that disagreed with a number.
