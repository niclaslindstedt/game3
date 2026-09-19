---
name: campaign
description: "Use when working on THE CAMPAIGN — the pinned levels and the ladder they make: adding, moving or re-naming a level in `pwa/src/game/campaign-levels.ts`, changing what a finish pays or what a lock asks for (`campaign.ts`), the card (`menu-campaign.tsx`), the plate at the end of a campaign run, or a generator change that has moved a pinned shore (the version contract in `engine/mapgen/versions.ts`). Owns the curation loop — `make rate CAMPAIGN=1`, `make difficulty CAMPAIGN=1`, the sim on the level — and the rule that a pinned shore's digest is rewritten only for a level deliberately moved. Not whether a level is any GOOD in the first place (`level-rating`), and not the card's chrome (`menu-system`)."
---

# The campaign: the pinned shores, ridden for points

The campaign is the sibling rally game's championship retyped for water:
four SHORES (the warm mangrove coast, then the cold taiga, then the polar
arctic, then the limestone karst), nine LEVELS each — one race, one tricks
run, all the way up, so the race both opens and closes a shore; the circuit
is the third rung's race and the eighth is six minutes of tricks —
every level a SEED on a generator VERSION under a pinned DAY, ridden against
the race's grid with hull contact off, paying the podium three, two and one
for the whole field. The next level opens behind a podium (a MEDAL on a
tricks level), the next shore behind the table. `campaign.ts`'s header says
why each of those is the shape it is.

**Read this skill's lessons first** — `node scripts/skill-lessons.mjs
campaign --list`. Load **`skill-reflection`** at both ends, **`write-code`**
beside this one for any code change, **`level-rating`** whenever a level is
being chosen or judged, **`mapgen-improvement`** when a generator change is
what moved a shore, and **`menu-system`** for anything about the card
itself.

## Where everything lives

| Thing                                                     | File                                          |
| --------------------------------------------------------- | --------------------------------------------- |
| The levels: seed, version, digest, day, medals            | `pwa/src/game/campaign-levels.ts`             |
| The policy: building a level, standing a run up, the points, the locks, the table, the stored board | `pwa/src/game/campaign.ts` (storage-free above the line) |
| The card: the shores, the nine boxes, the table           | `pwa/src/game/menu-campaign.tsx`              |
| The plate at the end of a campaign run                    | `run-news.ts`'s `campaignResultFor`           |
| Where a finish goes to the board and a restart rebuilds the level | `App.tsx` (`ridingRef`, `settle`, `tryNewGame`) |
| The generator's versions and the digest                   | `engine/mapgen/versions.ts`, `digest.ts`      |
| The field ordered for the sheet, the contact rule         | `engine/game/rivals.ts`'s `fieldOrder`, `RunRules.contact` |
| Tests                                                     | `tests/campaign_test.ts` (the policy), `tests/generator_version_test.ts` (every level rebuilt and held to its digest) |

## The curation loop — adding or moving a level

```
   1. make rate COUNT=48 BIOME=<coast> [ARGS=--tricks | TRACK=circuit]   the pool
   2. shortlist on the AXES, not the index                              level-rating's brief
   3. make difficulty SEED=<seed> BIOME=<coast> ...                     LOOK at it
   4. edit campaign-levels.ts: seed, mode, track (laps), day, name, blurb, medals
   5. make rate CAMPAIGN=1           every rung asks more? no pair the same shore twice?
      — it prints the DIGEST each level builds to; write it into the level
   6. npm run sim on the level        does the bot finish it? what does it score?
   7. make difficulty CAMPAIGN=1      the sheets, in the PR
   8. npx vitest run tests/generator_version_test.ts tests/campaign_test.ts
```

**The day is the cheapest lever.** An hour, a season, a sky and a wind
cost nothing that has to be re-verified and carry a third of the index
(`RATING.weight`), so when two rungs sit level, move the day before the
seed: a seed change re-rolls the shore, the sheet, the sim time and the
name. Every shore's finale is its darkest and windiest level for that
reason. And a pinned hour is held to R13 the way a dealt one is —
`daylightWindow` for the coast and the season, so a run never STARTS in
the dark (`tests/campaign_test.ts`). A polar coast in the midnight sun has
no window at all, and every hour of its clock is legal.

**The medals are set against the bot.** Ride the tricks level with the bot
on every craft, UNDER ITS PINNED DAY — which `npm run sim` cannot do
(`simulateStage` takes no hour, no season, no sky and no mode), so it is a
scratch probe over `campaignGame`. Bronze stands about a FIFTH of the
roster's median score (the bot never flips, so its total is air time
priced), and from there the ladder is 1 : 3 : 6 on every level in the
campaign. A medal is the DOOR to the next rung while the podium is what
the rung pays, so a door a rider had to out-ride eleven machines to get
through would be the lock twice. Write the four scores in the PR.

**A coast that FREEZES rates on the season the run pins, not the one the
seed was dealt** — `rateLevel` lays the run's season over the level before
it builds the sea, the way `createGame` does. On the arctic that is the
difference between an open sea and a channel cut through two metres of ice
(R37): the sea axis collapses to a lead's chop, so a winter rung reads
about 0.05 lower on the index than the same shore in autumn. The index has
no term for the channel itself, so `make difficulty` and `make level
BIOME=arctic ARGS=--season=winter` are what actually judge one.

**A level is named for what it is like, never for where it is** — the
water, the light, the shape of the ask. `tests/campaign_test.ts` refuses
the obvious place words, and `tests/biome_test.ts` holds the tree.

## The version contract, and the digest

Every level names the generator version it was curated under and carries
the digest of the shore that came out. `tests/generator_version_test.ts`
rebuilds every one and compares. When it goes red there are exactly two
cases, with opposite fixes:

- **You moved the level** (a new seed, a new swell, a new track, a
  deliberate move onto a newer version): run step 5 above and write the
  new digest down. The picture was meant to change.
- **The rules moved under a level that did not**: NEVER regenerate the
  digest. Add a row to `GENERATOR_VERSIONS`, keep the old behaviour on the
  old row as an optional trait read through `generatorTraits(opts.version)`
  at the one place it differs, and leave the level where it stands — or
  move it onto the new version as a curation, one level at a time. Bumping
  every level because the suite went red is the implicit re-roll the scheme
  exists to prevent, and it wipes every player's board.

And **delete a version nothing names any more**, row and trait branches
together — the test refuses a museum.

## What a change here obliges

- `make rate CAMPAIGN=1` and `make difficulty CAMPAIGN=1` in the PR, and
  the sim on any level that moved.
- `docs/getting-started.md`'s campaign paragraph names every level;
  a renamed level is renamed there.
- A new word on the card goes in `strings.ts`; a new mark in
  `menu-glyphs.tsx` and on `make glyphs`'s sheet.
- A changed board shape (`CampaignProgress`) needs a case in
  `tests/campaign_test.ts` for what an older blob does to it — the board is
  a player's save, and dropping it is a bug the way dropping a record is.
- Anything the player sees → a `.changes/unreleased/` fragment.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth a fragment
here: a rung that read one way on the index and another in the game, a
lock a player found a way round, a re-roll the digest caught.
