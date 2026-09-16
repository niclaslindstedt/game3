---
name: campaign
description: "Use when working on THE CAMPAIGN — the twelve pinned levels and the ladder they make: adding, moving or re-naming a level in `pwa/src/game/campaign-levels.ts`, changing what a finish pays or what a lock asks for (`campaign.ts`), the card (`menu-campaign.tsx`), the plate at the end of a campaign run, or a generator change that has moved a pinned shore (the version contract in `engine/mapgen/versions.ts`). Owns the curation loop — `make rate CAMPAIGN=1`, `make difficulty CAMPAIGN=1`, the sim on the level — and the rule that a pinned shore's digest is rewritten only for a level deliberately moved. Not whether a level is any GOOD in the first place (`level-rating`), and not the card's chrome (`menu-system`)."
---

# The campaign: twelve shores, ridden for points

The campaign is the sibling rally game's championship retyped for water:
two SHORES (the warm mangrove coast, then the cold taiga), six LEVELS each,
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
| The twelve levels: seed, version, digest, day, medals     | `pwa/src/game/campaign-levels.ts`             |
| The policy: building a level, standing a run up, the points, the locks, the table, the stored board | `pwa/src/game/campaign.ts` (storage-free above the line) |
| The card: the shores, the six boxes, the table            | `pwa/src/game/menu-campaign.tsx`              |
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
name. Both shores' finales are their darkest and windiest levels for that
reason.

**The medals are read off the bot.** Run the tricks level through the sim
on every craft; bronze stands a little over the roster's median score
(the bot never flips, so its total is air time priced), silver about a
flip a jump on top, gold two. Write the run's numbers in the PR.

**A level is named for what it is like, never for where it is** — the
water, the light, the shape of the ask. `tests/campaign_test.ts` refuses
the obvious place words, and `tests/biome_test.ts` holds the tree.

## The version contract, and the digest

Every level names the generator version it was curated under and carries
the digest of the shore that came out. `tests/generator_version_test.ts`
rebuilds all twelve and compares. When it goes red there are exactly two
cases, with opposite fixes:

- **You moved the level** (a new seed, a new swell, a new track, a
  deliberate move onto a newer version): run step 5 above and write the
  new digest down. The picture was meant to change.
- **The rules moved under a level that did not**: NEVER regenerate the
  digest. Add a row to `GENERATOR_VERSIONS`, keep the old behaviour on the
  old row as an optional trait read through `generatorTraits(opts.version)`
  at the one place it differs, and leave the level where it stands — or
  move it onto the new version as a curation, one level at a time. Bumping
  all twelve because the suite went red is the implicit re-roll the scheme
  exists to prevent, and it wipes every player's board.

And **delete a version nothing names any more**, row and trait branches
together — the test refuses a museum.

## What a change here obliges

- `make rate CAMPAIGN=1` and `make difficulty CAMPAIGN=1` in the PR, and
  the sim on any level that moved.
- `docs/getting-started.md`'s campaign paragraph names the twelve levels;
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
