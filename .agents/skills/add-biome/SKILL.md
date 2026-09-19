---
name: add-biome
description: "Use when a NEW COAST is asked for — a fifth biome, a shore on a kind of water the game does not build yet, 'add a biome for …'. The whole of what a coast IS in this repo, as one checklist: the engine's row and its animals, the app's six tables (the water, the shore, the grade, the skies, the cover, the birds) and the two cries, the four suites that hold them to one list, every lab's help text, the docs, the changelog — AND THE CAMPAIGN'S EIGHT LEVELS on the new shore with their banner and their routes, which is the step a coast is most often shipped without. Owns the order the steps go in and the measurements each one owes; what each half is made of is `nature`'s, `atmosphere`'s, `water-look`'s and `campaign`'s."
---

# Adding a biome: a coast is not a coast until it is ridden

A biome is a KIND of coast, never a place — a cold skerry coast, a warm
flat one, a wall of ice, a limestone one on blue water — and it is named
in a dozen tables that cannot import each other's reason to exist. This
skill is the one list of them, in the order they have to be filled, with
the measurement each step owes before the next. It routes to the skills
that own the halves: **`nature`** (the row, the shore, the sea life, the
cover, the birds), **`atmosphere`** (the skies), **`water-look`** (the
optics), **`sound-effects`** (a new cry), **`campaign`** and
**`level-rating`** (the eight levels), **`playtest`** (the photographs).
Load **`write-code`** beside all of them and **`skill-reflection`** at
both ends.

**Read this skill's lessons first** —
`node scripts/skill-lessons.mjs add-biome --list` — and `nature`'s under
`--concepts=biome`, which is where the coasts before this one left their
numbers.

## The quality bar

A coast is DONE when all of the following hold, and not before:

- **It is a different place at riding pace.** The chase camera at
  `SCENE=cruise` on three seeds under its own clear sky reads as this
  coast and no other — the water's colour, the shore's stone, the trees'
  shape, the birds' silhouettes. A coast a rider tells apart only by the
  card's word is a palette, not a biome.
- **It builds.** Sixteen seeds of sixteen through `make analyze
  BIOME=<id> COUNT=16`, and the rate is written in the row's comment.
- **It is alive.** Every animal, every plant and every bird on its
  rosters is placed on at least one corpus seed (the four suites below
  say so), and the open water past the buoys has a bird and an animal in
  it — the `sea` block and the `offshore` band.
- **It is ridden for points.** Six pinned levels on `campaign-levels.ts`
  in the rung order, rated as a ladder, with a banner and six routes
  committed. A coast on the start card and not in the campaign is a coast
  three of the four modes cannot ride.
- **It names no place.** `tests/biome_test.ts` sweeps the tree.

## The loop

Every step is make → observe → judge → revise, and the observation is
named. Do them in this order — the later ones read the earlier ones.

### 1. The id and the engine's row

- `engine/mapgen/types.ts` — add the id to `BiomeId` (the reserved names
  are there so a campaign location never changes its name; a new coast
  may take one of them or add its own).
- `engine/mapgen/biomes.ts` — the row, and the id on `BIOME_IDS`. Write it
  from a real coast's MEASURED facts (temperatures by dated month, the
  density, the latitude, what stands how high) and say in the comment
  what each number is a fact about. The taiga's row stays all ones.
  `mouth` and `head` never go under 1 (`nature`'s lesson: the race
  pinches, the creek goes under the cell).
- **Observe:** `make level SEED=7 BIOME=<id>` and two more seeds — the
  quilt (R21) as shading, every solid as a mark. Then `make analyze
  BIOME=<id> COUNT=16` and put the pass rate in the row's comment beside
  `shore.sand` and `boulderField`; a coast under 16/16 is retuned there,
  never by widening R21.
- **Count the rock per kind** before writing a claim about it: twenty
  lines over `generateLevel` × 16 seeds, tallied by `solid.kind` and
  divided by the seed count, this coast beside the taiga. The multipliers
  in the row are a request, and the placer's budgets decide what arrives.

### 2. The animals

- `engine/game/defs/fauna-<id>.ts` — the coast's own rows, folded into
  `FAUNA` in `defs/fauna.ts` beside the others, its ids on `FaunaId`, and
  the coast's `fauna` list in its row (reuse a shared animal — the
  loggerhead, the bottlenose, the orca — by id rather than a second row).
  Every band against the field it is sampled from: `offshore` to 800 m,
  `temperature` covering the water the row DEALS, and a legendary at the
  far end so riding out is worth it.
- A row that comes up without a breath is a `shark` (the sunfish, the
  swordfish); a `fish` never `bask`s and never `breath`es but the tarpon.
- `pwa/src/game/fauna-styles.ts` — a `STYLES` entry per new id, seen from
  ABOVE: the dorsal, the pectorals, the tail span and only the markings a
  back shows.
- **Observe:** `make level`'s sea-life line on a few seeds (every rung of
  the rarity ladder met over a handful of seeds), and
  `tests/fauna_test.ts`'s two exact lists (who breaches, who is legendary)
  updated with the row order.

### 3. The app's six tables

Each is keyed by `BiomeId` and throws on a coast without a row, and
`tests/biome_test.ts` holds every one of them to `BIOME_IDS`:

| Table | File | Judged by |
| --- | --- | --- |
| The water: three tones, the ramp, the window, the clarity | `pwa/src/game/water-optics.ts` | `make screenshots SCENE=cruise BIOME=<id> WEATHER=clear`, and `tests/water_optics_test.ts`'s claim about this coast against the others' (hue, saturation, clarity) |
| The shore: the slab, the field, the sand, the bed, the bank, the floor, the stone | `pwa/src/game/shore-paint.ts` | `SCENE=rest` — the one shot where paint is judged rather than glanced at |
| The grade over the whole picture | `pwa/src/game/colour-grade.ts` | the same two shots; `tests/biome_test.ts`'s row-against-row claim |
| The six skies and the four seasons | `pwa/src/game/sky-looks.ts` (`SKY_LOOKS`, `SEASON_LOOKS`) | `make sky BIOME=<id>` — every word painted, the wet ones this coast's own weather |
| The cover | `pwa/src/game/flora-defs-<id>.ts`, spread into `FLORA` by `flora-defs.ts`; new tall trees on `PERCH_TREES` | `make flora BIOME=<id>` — the ladder side by side; `SCENE=river` for the bank |
| The birds | `pwa/src/game/bird-defs-<id>.ts`, spread into `BIRDS`; ids on `BirdId`; paint in `bird-shapes.ts`'s `BIRD_STYLES`; a voice or `null` in `audio/bird-voice.ts`'s `BIRD_CALLS`; a new cry in `audio/bird-bank.ts` with a description | `make birds BIOME=<id>`; `SCENE=birds`; `tests/audio_test.ts` holds every call to the bank |

A sibling roster file is HANDED the parent's constants (`karstFlora(TREE_LINE)`),
never imports them back — the cycle reads the constant as `undefined` and
the first sign is a band test three files away.

Then the words: the coast's name on the card in `strings.ts`
(`COAST_NAMES`, and the `startCoastHint` sentence), and `url-params.ts`'s
comment on `?biome=`.

### 4. The suites, the corpus, the labs

- `tests/support/levels.ts` — a corpus for the coast (`<ID>_SEEDS`,
  `<id>For`), four seeds on a stride of its own.
- `tests/biome_test.ts` — the id on the built list; a row-against-row case
  in "what makes the coasts N" for each thing this coast is (the water,
  the sun, the shore, the sea, the river, the grade, the sky) and a corpus
  case; the signature species held to this coast alone.
- `tests/birds_test.ts`, `tests/flora_test.ts` — the coast's plan flown and
  planted over its corpus, its own rows only, and the exact lists (the
  divers, the wing-driers, the tree perches) extended.
- `tests/water_optics_test.ts` — the coast's water against the others'.
- Every lab's `--biome` help text (`scripts/*.mjs`: `taiga|mangrove|…`).
- **Run:** `npx vitest run tests/biome_test.ts tests/fauna_test.ts
  tests/birds_test.ts tests/flora_test.ts tests/water_optics_test.ts
  tests/audio_test.ts tests/determinism_test.ts` — the last one because the
  catalog grew, and it must NOT move: a new coast re-rolls no existing seed.

### 5. Look, then the sim

`make build`, then with `CHROMIUM_PATH=/opt/pw-browsers/chromium`:
`make screenshots SCENE=cruise BIOME=<id>` (a dealt sky and a clear one,
`WEATHER=clear HOUR=11`), `SCENE=rest`, `SCENE=offshore`, `make flora
BIOME=<id>`, `make birds BIOME=<id>`. Judge against the bar above and
retune the tables — most of a new coast's revisions are here, and a
coast shipped off its numbers alone is a coast nobody looked at.

`make sim BIOME=<id>` — the bot rides four seeds on four hulls; every run
finishes or the coast's water is wrong somewhere the tests do not reach.
The table goes in the PR.

### 6. THE CAMPAIGN'S EIGHT LEVELS — never skip this

A coast is ridden in the campaign, RACE, TRICKS and TIME TRIAL only
through its pinned shore (`new-game.ts`'s `pinnedFor`, `menu-levels.tsx`);
the start card's COAST row is FREE ride's alone. So a coast without a
`CampaignShore` is a coast three modes cannot reach, and it has shipped
that way before. Load **`campaign`** and **`level-rating`** and run their
loop for the new shore:

1. `make rate COUNT=48 BIOME=<id>`, `… ARGS=--tricks`, `… TRACK=circuit` —
   the pool, three ways.
2. Shortlist on the AXES: a shore whose rungs all lead on the sea is
   one shore eight times. Every shore leads on what its coast HAS — the
   swell on the warm one, the ice on the polar one, the rock and the
   short steep sea on the limestone one.
3. `make difficulty SEED=<seed> BIOME=<id> …` — look at each candidate.
4. `pwa/src/game/campaign-levels.ts` — a `CampaignShore` in the rung order
   (one race, one tricks run, all the way up: the circuit is the third
   rung's race, and the finale is six minutes of tricks on the worst water
   the coast has), its id on `CampaignShore.id`, appended to `SHORES`
   behind the last shore's table; every level with `version`, its pinned
   day inside `daylightWindow` for the coast and season, and `medals` on
   the four tricks rungs (two, three, four and six minutes) picked off the
   neighbouring shores' at the same length on the 1 : 3 : 6 step
   (`campaign`'s lesson: never re-derived from the bot).
5. `make rate CAMPAIGN=1` — every rung asks more than the last, no pair the
   same shore twice, and the DIGEST each level builds to, written into it.
6. `make difficulty CAMPAIGN=1` — the sheets, in the PR.
7. `make routes` (pure Node) and, on a built site, `make coasts` — the
   shore's eight routes into `shore-routes.ts` and the banner `pwa/public/previews/
   coast-<id>.jpg` with its receipt in `coast-shots.ts`; both are
   GENERATED and `tests/shore_preview_test.ts` holds them to the table.
8. `npx vitest run tests/campaign_test.ts tests/generator_version_test.ts
   tests/shore_preview_test.ts` — the shore list, the ladder's end
   (`ladderAfter` on the last finale), the place-word sweep on the names.
9. `docs/getting-started.md`'s campaign paragraph names every level; the
   `campaign` skill's header counts the shores.

## The traps

- **A coast on the card and not in the campaign** (above). The tests do
  not catch it: `biome_test` holds the tables, `campaign_test` holds the
  shores that exist, and nothing holds the two lists to each other.
- **A place name.** `Mediterranean shag`, `Atlantic puffin`, `Florida
  manatee` — a species' name can carry a place, and `biome_test`'s regex
  reads the whole tree. Name the species by its other common name or its
  Latin one; name the coast for what it IS (a taiga, a mangrove, a karst).
- **A row written the way the coast LOOKS.** Beach nearly everywhere, no
  boulder field, a wall from the waterline: each fails R21's quilt on half
  the seeds and the search's last reason hides it. Sweep sixteen, read
  `nature`'s lessons on the apron and the quilt, keep the field.
- **A band written from intuition.** `offshore` to 250 m empties the outer
  half of every level; a temperature floor a degree over what the coast
  deals empties a season. Print the field, then write the band.
- **The exact lists.** `fauna_test` (who breaches, who is legendary),
  `birds_test` (who dives, who dries), `biome_test` (the built ids) are
  `toEqual` lists in ROW ORDER, and a new row is a red suite until it is
  in them — which is the point; extend them, never loosen them.
- **The two typechecks.** `npx tsc --noEmit -p tsconfig.json` AND `-p
  pwa/tsconfig.json`; the app's tables are only in the second.
- **Judging from the numbers.** A `#1e8ccb` is not blue until the grade,
  the sky and the bed have had it; the cruise shot under a clear sky is
  the verdict, and the dealt sky on a rainy seed is not a fair one.

## What the change obliges elsewhere

- `.changes/unreleased/` — one fragment, the coast and its campaign in one
  sentence each (the `changelog` skill).
- `docs/level-generator.md` (the biomes bullet, R13's latitudes and
  densities, the sea-life tables, the knob table), `docs/configuration.md`
  (`?biome=`), `docs/architecture.md` (`biomes.ts`), `docs/water.md`
  (densities), `docs/getting-started.md` (the campaign), `README.md` (the
  coasts in the two opening paragraphs), `AGENTS.md` (the slice, the labs'
  `BIOME=` line, the four "where" rows that name the coasts' files).
- `nature`'s `SKILL.md` — the built coasts in `biomes.ts`'s row and the
  catalog's count.
- A lesson here for anything this coast taught the next one.

## Checklist

- [ ] `BiomeId`, `BIOME_IDS`, the row with its measured facts and its 16/16
- [ ] `fauna-<id>.ts` folded in, `FaunaId`, `STYLES`, the two exact lists
- [ ] water, shore, grade, skies + seasons, cover, birds — and the cries
- [ ] `COAST_NAMES`, `startCoastHint`, `url-params.ts`, every lab's help
- [ ] corpus + the five suites green, `determinism_test` unmoved
- [ ] built and LOOKED at: cruise (clear), rest, offshore, flora, birds
- [ ] `make sim BIOME=<id>` — every run finishes; table in the PR
- [ ] six campaign levels, rated as a ladder, digests written, medals set
- [ ] `make routes`, `make coasts` — routes and banner committed
- [ ] campaign, generator-version and shore-preview suites green
- [ ] docs, README, AGENTS.md, nature's skill, the fragment
- [ ] `skill-reflection` for every skill loaded

## Skill self-improvement

Record lessons under `.agents/skills/add-biome/.lessons/` in the
`skill-reflection` format; that skill decides at session end what gets
promoted into this file. Never append lessons here directly.
