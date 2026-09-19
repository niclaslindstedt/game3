// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A COAST IS NAMED IN SEVEN PLACES, and this is the test that holds them to
// one list. The engine's row (`engine/mapgen/biomes.ts`) says what a coast
// IS; the app says what it LOOKS like in five tables that cannot import
// each other's reason to exist — its water (`water-optics.ts`), its shore
// (`shore-paint.ts`), its skies and seasons (`sky-looks.ts`) and the grade
// its whole picture is finished with (`colour-grade.ts`) — and two rosters
// whose rows each name the coasts they belong to (`flora-defs.ts`,
// `bird-defs.ts`). A coast added to `BIOME_IDS` and missing from any of them
// is a level that throws on load, or a shore with nothing growing on it;
// the cases below make each of those a red test instead. What the grade
// itself CLAIMS is `tests/colour_grade_test.ts`'s.
//
// And a biome is a KIND of coast, never a place. The second half of the
// file holds the rows to what makes the four coasts four — the cold one
// is cold, brackish, sheltered and grey-green; the warm one is warm, salt,
// swell-swept and turquoise; the polar one is at the freezing point, a wall
// of ice over black water that is a sheet of ice in its winter; the
// limestone one is warm, salt, steep, full of rock and the bluest water
// there is — and holds the tree to the rule that nothing in it names a
// country, a sea or a shore that exists.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BIOME_IDS,
  BIOMES,
  DECLINATION,
  FAUNA,
  LEVEL_RULES as R,
  SEASONS,
  WEATHER_IDS,
  biomeOf,
  daylightWindow,
  declinationOf,
  flowAt,
  generateLevel,
  isBiomeId,
  isFaunaId,
  landHeight,
  sampleField,
  type Level,
} from "@engine";

import {
  ARCTIC_SEEDS,
  KARST_SEEDS,
  LEVEL_SEEDS,
  MANGROVE_SEEDS,
  arcticFor,
  karstFor,
  levelFor,
  mangroveFor,
} from "./support/levels.ts";
import { BIRDS, birdsOf } from "../pwa/src/game/bird-defs.ts";
import { COLOUR_GRADES, gradeOf } from "../pwa/src/game/colour-grade.ts";
import { FLORA, floraOf } from "../pwa/src/game/flora-defs.ts";
import { SHORE_PAINT, shorePaintOf } from "../pwa/src/game/shore-paint.ts";
import { SEASON_LOOKS, SKY_LOOKS, looksOf, seasonsOf } from "../pwa/src/game/sky-looks.ts";
import { WATER_OPTICS, waterOpticsOf } from "../pwa/src/game/water-optics.ts";

const ROOT = process.cwd();

describe("the built coasts", () => {
  it("are the four the game opens on, the taiga first", () => {
    expect(BIOME_IDS).toEqual(["taiga", "mangrove", "arctic", "karst"]);
    expect(isBiomeId("taiga")).toBe(true);
    expect(isBiomeId("mangrove")).toBe(true);
    expect(isBiomeId("arctic")).toBe(true);
    expect(isBiomeId("karst")).toBe(true);
    // Reserved, not built: a row nobody has written is a level that throws.
    expect(isBiomeId("atoll")).toBe(false);
    expect(isBiomeId(null)).toBe(false);
    expect(() => biomeOf("fjord")).toThrow(/not built/);
    expect(() => generateLevel(1, { biome: "delta" })).toThrow(/not built/);
    expect(Object.keys(BIOMES).sort()).toEqual([...BIOME_IDS].sort());
  });

  it("have every app-side half, and no app-side half is for a coast nobody built", () => {
    for (const table of [WATER_OPTICS, SHORE_PAINT, SKY_LOOKS, SEASON_LOOKS, COLOUR_GRADES]) {
      expect(Object.keys(table).sort()).toEqual([...BIOME_IDS].sort());
    }
    for (const id of BIOME_IDS) {
      expect(() => waterOpticsOf(id)).not.toThrow();
      expect(() => shorePaintOf(id)).not.toThrow();
      expect(() => gradeOf(id)).not.toThrow();
      expect(() => looksOf(id)).not.toThrow();
      expect(() => seasonsOf(id)).not.toThrow();
      // Every sky the engine can name is painted on every coast — `Looks`
      // is total — and every sky the coast OFFERS is one the engine names.
      for (const w of WEATHER_IDS) expect(looksOf(id)[w], `${id} ${w}`).toBeDefined();
      for (const w of biomeOf(id).weathers) expect(WEATHER_IDS).toContain(w);
      expect(biomeOf(id).weathers.length).toBeGreaterThan(2);
    }
    expect(() => shorePaintOf("fjord")).toThrow(/fjord/);
    expect(() => looksOf("fjord")).toThrow(/fjord/);
    expect(() => gradeOf("fjord")).toThrow(/fjord/);
  });

  it("each grow a cover, fly a roster and carry sea life of their own", () => {
    for (const id of BIOME_IDS) {
      expect(floraOf(id).length, `${id} cover`).toBeGreaterThanOrEqual(8);
      expect(birdsOf(id).length, `${id} birds`).toBeGreaterThanOrEqual(5);
      expect(biomeOf(id).fauna.length, `${id} sea life`).toBeGreaterThanOrEqual(6);
      for (const f of biomeOf(id).fauna) expect(isFaunaId(f)).toBe(true);
    }
    // Every row in every roster belongs to a built coast, and to at least
    // one — a row on no coast is a body built for nobody.
    for (const spec of FLORA) {
      expect(spec.biomes.length, spec.id).toBeGreaterThan(0);
      for (const b of spec.biomes) expect(BIOME_IDS).toContain(b);
    }
    for (const spec of BIRDS) {
      expect(spec.biomes.length, spec.id).toBeGreaterThan(0);
      for (const b of spec.biomes) expect(BIOME_IDS).toContain(b);
    }
    const offered = new Set(BIOME_IDS.flatMap((id) => biomeOf(id).fauna));
    for (const spec of FAUNA) expect(offered.has(spec.id), spec.id).toBe(true);
    // The four rosters are four: each coast's signature species grow on
    // it alone.
    const rosters = BIOME_IDS.map((b) => [b, new Set(floraOf(b).map((s) => s.id))] as const);
    const alone = (coast: string, id: string): boolean =>
      rosters.every(([b, set]) => set.has(id) === (b === coast));
    for (const id of ["spruce", "birch", "reed"]) expect(alone("taiga", id), id).toBe(true);
    for (const id of ["redmangrove", "sabal", "coconut"]) {
      expect(alone("mangrove", id), id).toBe(true);
    }
    for (const id of ["saxifrage", "strandedice", "kelp"]) {
      expect(alone("arctic", id), id).toBe(true);
    }
    for (const id of ["posidonia", "coastpine", "cypress", "olive"]) {
      expect(alone("karst", id), id).toBe(true);
    }
    // …and nothing with a trunk grows on the polar coast at all.
    for (const spec of floraOf("arctic")) {
      expect(["bush", "tuft", "reed", "stone"], spec.id).toContain(spec.look.form);
    }
  });
});

describe("what makes the four coasts four", () => {
  const taiga = biomeOf("taiga");
  const mangrove = biomeOf("mangrove");
  const arctic = biomeOf("arctic");
  const karst = biomeOf("karst");

  it("is the water: cold and brackish against warm and salt against the freezing point", () => {
    expect(taiga.water.density).toBeLessThan(mangrove.water.density);
    expect(arctic.water.density).toBeGreaterThanOrEqual(mangrove.water.density);
    // An enclosed sea in a dry climate is the saltiest water in the game.
    expect(karst.water.density).toBeGreaterThanOrEqual(mangrove.water.density);
    for (const season of ["spring", "summer", "autumn", "winter"] as const) {
      expect(taiga.water.temperature[season].max).toBeLessThan(
        mangrove.water.temperature[season].min,
      );
      expect(arctic.water.temperature[season].max).toBeLessThan(
        taiga.water.temperature[season].max,
      );
      // Sea water freezes at −1.8 °C, and a coast never deals water colder.
      expect(arctic.water.temperature[season].min).toBeGreaterThanOrEqual(-1.8);
      // Warm-temperate: between the cold coast and the warm one, in every
      // season, and swimmable in all of them.
      expect(karst.water.temperature[season].min).toBeGreaterThan(
        taiga.water.temperature[season].max,
      );
      expect(karst.water.temperature[season].max).toBeLessThan(
        mangrove.water.temperature[season].max,
      );
      expect(karst.water.temperature[season].min).toBeGreaterThan(12);
    }
    // The winter water is under the freezing point of fresh water, which is
    // the sea R37 puts a sheet on.
    expect(arctic.water.temperature.winter.max).toBeLessThan(0);
    // …and every animal a coast offers can be met in its water at least
    // one season of the year, or the row is a promise the coast never keeps.
    for (const id of BIOME_IDS) {
      const bands = Object.values(biomeOf(id).water.temperature);
      for (const f of biomeOf(id).fauna) {
        const spec = FAUNA.find((s) => s.id === f)!;
        const met = bands.some(
          (b) => b.max >= spec.temperature.min && b.min <= spec.temperature.max,
        );
        expect(met, `${f} on the ${id} coast`).toBe(true);
      }
    }
  });

  it("is the sun: a northern latitude against a subtropical one against the high arctic", () => {
    expect(taiga.latitude).toBeGreaterThan(55);
    expect(mangrove.latitude).toBeLessThan(35);
    expect(mangrove.latitude).toBeGreaterThan(23.5);
    // Past the polar circle, and by enough to matter: the midnight sun in
    // both summer seasons and no sun at all in a taiga November.
    expect(arctic.latitude).toBeGreaterThan(66.5);
    expect(arctic.latitude).toBeLessThan(85);
    // …and the karst between the taiga and the mangrove: every night dark,
    // no midnight sun, a noon sun that never stands overhead.
    expect(karst.latitude).toBeGreaterThan(mangrove.latitude);
    expect(karst.latitude).toBeLessThan(taiga.latitude);
  });

  it("is the year: the two lower coasts date it alike, and the polar coast dates its own", () => {
    // The taiga's dating is the rule book's own table, and the mangrove
    // keeps it; the arctic's four seasons are the weeks a polar coast can
    // be ridden in — two under the midnight sun, two under a low sun —
    // because the taiga's November is a polar night.
    expect(taiga.declination).toEqual(DECLINATION);
    expect(mangrove.declination).toEqual(DECLINATION);
    expect(karst.declination).toEqual(DECLINATION);
    for (const season of SEASONS) {
      expect(
        daylightWindow(arctic.latitude, R.day.minSun, arctic.declination[season]),
        season,
      ).not.toBeNull();
    }
    expect(daylightWindow(arctic.latitude, R.day.minSun, DECLINATION.winter)).toBeNull();
    // The two summer rows never set; the two winter rows do.
    for (const season of ["spring", "summer"] as const) {
      expect(daylightWindow(arctic.latitude, R.day.minSun, arctic.declination[season])).toEqual({
        min: 0,
        max: 24,
      });
    }
    for (const season of ["autumn", "winter"] as const) {
      const w = daylightWindow(arctic.latitude, R.day.minSun, arctic.declination[season])!;
      expect(w.max - w.min).toBeLessThan(14);
    }
    expect(declinationOf("arctic", "winter")).toBe(arctic.declination.winter);
  });

  it("is the shore: high rock and boulders against low sand and marl against a wall of ice", () => {
    expect(mangrove.relief).toBeLessThan(taiga.relief);
    expect(mangrove.shore.sand).toBeGreaterThan(taiga.shore.sand);
    expect(mangrove.rocks.boulder).toBe(0);
    expect(mangrove.rocks.erratic).toBe(0);
    expect(mangrove.rocks.stack).toBe(0);
    // But never a coast of ONE material: R21's quilt is held on every
    // biome, and the field that breaks the marl up has to be there.
    expect(mangrove.boulderField).toBeGreaterThan(0);
    expect(mangrove.shore.sand).toBeLessThan(1.5);
    // The arctic stands higher than the taiga and comes down as a wall —
    // and there is NO ROCK on it: the wall's foot is the widest "boulder"
    // field of any coast because it is the calved rubble on the apron,
    // and no erratic at all, because an erratic is a rock by definition.
    expect(arctic.relief).toBeGreaterThan(taiga.relief);
    expect(arctic.climb).toBeLessThan(0.25);
    expect(arctic.rocks.erratic).toBe(0);
    expect(arctic.rocks.boulder).toBeGreaterThan(0);
    expect(arctic.boulderField).toBeGreaterThan(taiga.boulderField);
    expect(arctic.shore.sand).toBeLessThan(taiga.shore.sand);
    // The karst stands higher than the taiga and comes down steeper, with
    // MORE rock in its sea than any coast — islets, reefs and stacks — no
    // erratic (no glacier ever came down it), and less beach: a rock coast
    // with pebble coves in it.
    expect(karst.relief).toBeGreaterThan(taiga.relief);
    expect(karst.ceiling).toBe(1);
    expect(karst.headland).toBeGreaterThan(1);
    expect(karst.climb).toBeLessThan(taiga.climb);
    expect(karst.climb).toBeGreaterThan(arctic.climb);
    expect(karst.rocks.skerry).toBeGreaterThan(taiga.rocks.skerry);
    expect(karst.rocks.reef).toBeGreaterThan(taiga.rocks.reef);
    expect(karst.rocks.stack).toBeGreaterThan(taiga.rocks.stack);
    expect(karst.rocks.erratic).toBe(0);
    expect(karst.rocks.boulder).toBeGreaterThan(0);
    expect(karst.boulderField).toBeGreaterThan(0);
    expect(karst.beaches).toBe(true);
    expect(karst.shore.sand).toBeLessThan(taiga.shore.sand);
    // Not a wall coast: the taiga's ramp, and no apron.
    expect(karst.wall).toEqual(taiga.wall);
  });

  it("builds a wall on the polar coast and a slope on the taiga", () => {
    // The steepest ground within the first thirty metres of the waterline,
    // over a corpus of each: a glacier's front against a planed slab.
    const steepest = (level: Level): number => {
      let most = 0;
      const { ground, offshore } = level;
      for (let i = 0; i < ground.data.length; i++) {
        const inland = -offshore.data[i];
        if (inland < 4 || inland > 30) continue;
        const r = Math.floor(i / ground.cols);
        const c = i - r * ground.cols;
        if (c + 1 >= ground.cols || r + 1 >= ground.rows) continue;
        const gx = (ground.data[i + 1] - ground.data[i]) / ground.cell;
        const gz = (ground.data[i + ground.cols] - ground.data[i]) / ground.cell;
        most = Math.max(most, Math.hypot(gx, gz));
      }
      return most;
    };
    const walls = ARCTIC_SEEDS.map((s) => steepest(arcticFor(s)));
    const slabs = LEVEL_SEEDS.slice(0, 4).map((s) => steepest(levelFor(s)));
    // A taiga whaleback can stand at forty-five degrees where it breaks;
    // a glacier front stands at twice that on most seeds, and never under
    // the whaleback's own.
    for (const w of walls) expect(w).toBeGreaterThan(1);
    for (const s of slabs) expect(s).toBeLessThan(1.5);
    expect(Math.max(...walls)).toBeGreaterThan(2);
    // …and the wall stands over the rock coasts' own roof, which is what
    // "a glacier's front" costs to claim: R2's ceiling is the coast's
    // (`Biome.ceiling`), one everywhere but here.
    expect(arctic.ceiling).toBeGreaterThan(1);
    expect(taiga.ceiling).toBe(1);
    expect(mangrove.ceiling).toBe(1);
    const tallest = Math.max(
      ...ARCTIC_SEEDS.map((s) => arcticFor(s).ground.data.reduce((a, b) => Math.max(a, b), 0)),
    );
    expect(tallest).toBeGreaterThan(R.land.maxHeight);
    expect(tallest).toBeLessThanOrEqual(R.land.maxHeight * arctic.ceiling + 1);
    // THE WALL AT THE WATERLINE, BESIDE THE COURSE: on every seed the
    // ground within thirty metres of the sea and within reach of the line
    // the rider is on somewhere stands forty metres up — the front, on its
    // apron — where the taiga's never stands twenty anywhere. Measured
    // beside the course rather than anywhere on the level, because a wall
    // on the far bank of the river's head is a wall nobody sees.
    const atWater = (level: Level, besideCourse: boolean): number => {
      let most = 0;
      const { ground: g, offshore } = level;
      const path = level.course.path;
      for (let i = 0; i < g.data.length; i++) {
        const inland = -offshore.data[i];
        if (!(inland > 0 && inland <= 30)) continue;
        if (besideCourse) {
          const x = g.originX + (i % g.cols) * g.cell;
          const z = g.originZ + Math.floor(i / g.cols) * g.cell;
          if (!path.some((p) => Math.hypot(p.x - x, p.z - z) < 140)) continue;
        }
        most = Math.max(most, g.data[i]);
      }
      return most;
    };
    for (const s of ARCTIC_SEEDS)
      expect(atWater(arcticFor(s), true), `seed ${s}`).toBeGreaterThan(40);
    for (const s of LEVEL_SEEDS.slice(0, 4)) expect(atWater(levelFor(s), false)).toBeLessThan(20);
    // …and the wall is the coast's ORDINARY shore, standing on its apron:
    // the taiga's ramp moves nothing and its apron is nothing.
    expect(arctic.wall.to).toBeLessThan(taiga.wall.from + 0.2);
    expect(arctic.wall.apron).toBeGreaterThan(8);
    expect(taiga.wall.apron).toBe(0);
    expect(mangrove.wall.apron).toBe(0);
  });

  it("is the sea: a sheltered skerry coast against an open swell-swept one against the pack", () => {
    expect(taiga.sea.wind).toBeLessThan(1);
    expect(taiga.sea.swell).toBeLessThan(1);
    expect(mangrove.sea.swell).toBeGreaterThan(taiga.sea.swell);
    expect(mangrove.sea.wind).toBeLessThan(taiga.sea.wind);
    // The ice edge takes most of a swell's height: the least swell of the
    // three, and the only coast that freezes.
    expect(arctic.sea.swell).toBeLessThan(taiga.sea.swell);
    expect(arctic.freezes).toBe(true);
    expect(taiga.freezes).toBe(false);
    expect(mangrove.freezes).toBe(false);
    // An enclosed sea: the biggest wind sea of the four — the north wind
    // comes off the land, and no island takes it off — and next to no
    // swell, because nothing arrives from past a horizon it has not got.
    expect(karst.sea.wind).toBeGreaterThanOrEqual(taiga.sea.wind);
    expect(karst.sea.wind).toBeGreaterThan(mangrove.sea.wind);
    expect(karst.sea.swell).toBeLessThan(taiga.sea.swell);
    expect(karst.sea.swell).toBeGreaterThan(arctic.sea.swell);
    expect(karst.freezes).toBe(false);
    // None is off: the waves are the game on all four.
    for (const id of BIOME_IDS) expect(biomeOf(id).sea.wind).toBeGreaterThan(0.6);
  });

  it("is the land: how steeply a coast comes down is a knob, and never past the reach", () => {
    for (const id of BIOME_IDS) {
      expect(biomeOf(id).climb).toBeGreaterThan(0);
      expect(biomeOf(id).climb).toBeLessThanOrEqual(1);
    }
    // The taiga's row is the rule book's: the hill met over the whole reach.
    expect(taiga.climb).toBe(1);
    // …and a coast that climbs over half of it meets the same hill sooner,
    // at the same height, and is flat from there.
    const hill = 10;
    expect(landHeight(R.land.reach / 2, hill, R.land.reach / 2)).toBeCloseTo(hill, 6);
    expect(landHeight(R.land.reach / 2, hill)).toBeLessThan(hill);
    expect(landHeight(R.land.reach, hill, R.land.reach / 2)).toBeCloseTo(hill, 6);
  });

  it("is the river: a rock channel that runs hard against a lazy estuary with bars in it", () => {
    // The taiga's row is the rule book's own, so no taiga seed re-rolls for
    // the row existing; the mangrove's opens the mouth, holds the width,
    // loops wider, carries less water, and drops bars in the mouth.
    expect(taiga.river).toEqual({
      mouth: 1,
      head: 1,
      taper: 1,
      bend: 1,
      discharge: 1,
      banks: true,
      kink: 0,
      ragged: 0,
      bars: null,
    });
    expect(mangrove.river.banks).toBe(true);
    expect(mangrove.river.kink).toBe(0);
    expect(mangrove.river.ragged).toBe(0);
    // …and the karst's is a GORGE: the race's own water at the mouth (the
    // two multiples a row may never take under 1), closing faster than
    // the rock channel, bending tighter, half its turning on the joints,
    // with banks and no bars.
    expect(karst.river.mouth).toBe(1);
    expect(karst.river.head).toBe(1);
    expect(karst.river.taper).toBeGreaterThan(1);
    expect(karst.river.bend).toBeLessThan(1);
    expect(karst.river.bend).toBeGreaterThan(arctic.river.bend);
    expect(karst.river.discharge).toBeLessThan(1);
    expect(karst.river.discharge).toBeGreaterThan(mangrove.river.discharge);
    expect(karst.river.kink).toBeGreaterThan(0);
    expect(karst.river.kink).toBeLessThan(1);
    expect(karst.river.banks).toBe(true);
    expect(karst.river.bars).toBeNull();
    // …and the arctic's is a CRACK: reaches and corners, ragged walls.
    expect(arctic.river.kink).toBe(1);
    expect(arctic.river.ragged).toBeGreaterThan(0.3);
    expect(arctic.river.bend).toBeLessThan(1);
    expect(mangrove.river.mouth).toBeGreaterThan(1);
    expect(mangrove.river.taper).toBeLessThan(1);
    expect(mangrove.river.bend).toBeGreaterThan(1);
    expect(mangrove.river.discharge).toBeLessThan(1);
    expect(mangrove.river.bars?.count.min).toBeGreaterThanOrEqual(1);
    // A bar keeps the river's own centreline in water: its channel is wider
    // than the cell the walk reads the water off.
    expect(mangrove.river.bars?.channel).toBeGreaterThan(R.grid.cell);
    // The arctic's river is a CRACK: it holds its width, carries little,
    // drops no bars, and has no banks — its sides are the wall's own ice,
    // which the classifier never calls bank on that coast.
    expect(arctic.river.taper).toBeLessThan(1);
    expect(arctic.river.discharge).toBeLessThan(mangrove.river.discharge);
    expect(arctic.river.bars).toBeNull();
    expect(arctic.river.banks).toBe(false);
    for (const seed of ARCTIC_SEEDS) {
      const level = arcticFor(seed);
      for (const p of level.river) {
        const off = sampleField(level.offshore, p.x, p.z);
        expect(off).toBeGreaterThan(0);
        // A probe up onto either side of the crack is never bank.
        for (const side of [1, -1]) {
          const q = level.river[Math.min(level.river.length - 1, level.river.indexOf(p) + 1)];
          const dx = q.x - p.x;
          const dz = q.z - p.z;
          const len = Math.hypot(dx, dz) || 1;
          const kind = level.materialAt(
            p.x + (-dz / len) * side * (off + 6),
            p.z + (dx / len) * side * (off + 6),
          );
          expect(kind).not.toBe("bank");
        }
      }
    }
  });

  it("builds two different rivers out of the two rows", () => {
    /** How much of the mouth's width the river still carries halfway up,
     * and how fast the water leaves the mouth. */
    const shape = (level: Level): { holds: number; current: number } => {
      const river = level.river;
      const mid = river[Math.round((river.length - 1) / 2)];
      const width = (p: { x: number; z: number }): number => sampleField(level.offshore, p.x, p.z);
      const v = { x: 0, z: 0 };
      flowAt(level.flow, river[0].x, river[0].z, v);
      return { holds: width(mid) / width(river[0]), current: Math.hypot(v.x, v.z) };
    };
    const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[xs.length >> 1];
    const cold = LEVEL_SEEDS.map((s) => shape(levelFor(s)));
    const warm = MANGROVE_SEEDS.map((s) => shape(mangroveFor(s)));
    // The estuary holds its width where the rock channel has closed…
    expect(median(warm.map((r) => r.holds))).toBeGreaterThan(
      1.5 * median(cold.map((r) => r.holds)),
    );
    // …and the torrent runs at least twice the drift.
    expect(median(cold.map((r) => r.current))).toBeGreaterThan(
      2 * median(warm.map((r) => r.current)),
    );
    // The bars: coastlines standing whole inside the mouth's reach, on most
    // of the warm coast's seeds. Read off the published level — the bars
    // are islands like any other once cut — so a delta the basin lost is a
    // red test rather than a row nobody reads.
    const bars = mangrove.river.bars!;
    let deltas = 0;
    for (const seed of MANGROVE_SEEDS) {
      const level = mangroveFor(seed);
      const river = level.river;
      const reach: { x: number; z: number }[] = [];
      let d = 0;
      for (let i = 0; i < river.length && d <= bars.reach.max; i++) {
        if (i > 0) d += Math.hypot(river[i].x - river[i - 1].x, river[i].z - river[i - 1].z);
        reach.push(river[i]);
      }
      const near = (p: { x: number; z: number }): number =>
        Math.min(...reach.map((q) => Math.hypot(q.x - p.x, q.z - p.z)));
      const mouth = sampleField(level.offshore, river[0].x, river[0].z);
      const inMouth = level.shore
        .slice(1)
        .filter((line) => line.every((p) => near(p) < mouth + 2 * bars.r.max)).length;
      if (inMouth > 0) deltas++;
      // …and the river still runs past them: R26's own walk is the check,
      // and the corpus passed it to be built at all.
      for (const p of river) expect(sampleField(level.offshore, p.x, p.z)).toBeGreaterThan(0);
    }
    expect(deltas).toBeGreaterThanOrEqual(Math.ceil(MANGROVE_SEEDS.length / 2));
  });

  it("is the grade: one cold cast against a warm split against a polar high key", () => {
    // What each grade DOES is `tests/colour_grade_test.ts`'s; what belongs
    // here is that the three rows are three — a cold coast graded flat and
    // drained, a warm one punchy and saturated, a polar one flatter and
    // more drained still with its blacks lifted furthest — and none of
    // them reachable from another's by a rounding error.
    const cold = gradeOf("taiga");
    const warm = gradeOf("mangrove");
    const polar = gradeOf("arctic");
    expect(cold.contrast).toBeLessThan(warm.contrast);
    expect(cold.saturation).toBeLessThan(warm.saturation);
    expect(cold.lift).toBeGreaterThan(warm.lift);
    expect(polar.contrast).toBeLessThan(cold.contrast);
    expect(polar.saturation).toBeLessThan(cold.saturation);
    expect(polar.lift).toBeGreaterThan(cold.lift);
    // …and the limestone coast punchy and saturated like the warm one,
    // but split against a TRUE blue rather than a teal: its shadow tone
    // sits further round the wheel toward blue than the mangrove's.
    const blue = gradeOf("karst");
    expect(blue.contrast).toBeGreaterThan(1);
    expect(blue.saturation).toBeGreaterThan(1);
    expect(blue.lift).toBeLessThan(cold.lift);
    const hue = (hex: string): number => {
      const n = Number.parseInt(hex.slice(1), 16);
      const r = (n >> 16) / 255;
      const g = ((n >> 8) & 255) / 255;
      const b = (n & 255) / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const d = max - min;
      if (d === 0) return 0;
      const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return h * 60;
    };
    expect(hue(blue.shade)).toBeGreaterThan(hue(warm.shade));
    expect(hue(blue.shade)).toBeGreaterThan(200);
  });

  it("is the sky: the haze is warm water's and sea smoke, and the taiga never deals it", () => {
    expect(mangrove.weathers).toContain("haze");
    expect(arctic.weathers).toContain("haze");
    expect(karst.weathers).toContain("haze");
    expect(taiga.weathers).not.toContain("haze");
    // The lightest and the heaviest sky are on every chart, so the ends of
    // R12's band stay the days they have to be everywhere.
    for (const id of BIOME_IDS) {
      const b = biomeOf(id);
      expect(b.weathers[0]).toBe("clear");
      expect(b.weathers[b.weathers.length - 1]).toBe("squall");
    }
  });

  it("builds a coast a rider can tell from the other two", () => {
    // The corpus itself: the arctic's water is at the freezing point,
    // nothing standing in it or on it is rock (no erratic on any seed —
    // the bergs and the bergy bits are the other kinds), and a crack runs
    // inland from every one of its shores.
    for (const seed of ARCTIC_SEEDS) {
      const level = arcticFor(seed);
      expect(level.biome).toBe("arctic");
      expect(level.water.temperature).toBeLessThan(6.5);
      expect(level.water.density).toBe(arctic.water.density);
      expect(level.river.length).toBeGreaterThan(10);
      expect(level.solids.filter((s) => s.kind === "erratic")).toHaveLength(0);
      expect(level.solids.filter((s) => s.kind === "boulder").length).toBeGreaterThan(4);
      expect(level.fauna.length).toBeGreaterThan(6);
    }
    // The karst's: warm salt water, a sea full of rock — a dozen and more
    // islets, reefs and stacks standing off every seed's shore (MEASURED
    // over sixteen seeds: 26 a level against the taiga's 21) — no erratic
    // anywhere, a river running up into the country from every one, and
    // life in its water.
    const standing = (level: Level): number =>
      level.solids.filter((s) => s.kind === "skerry" || s.kind === "reef" || s.kind === "stack")
        .length;
    for (const seed of KARST_SEEDS) {
      const level = karstFor(seed);
      expect(level.biome).toBe("karst");
      expect(standing(level), `seed ${seed}`).toBeGreaterThan(12);
      expect(level.water.temperature).toBeGreaterThan(13);
      expect(level.water.temperature).toBeLessThan(27.5);
      expect(level.water.density).toBe(karst.water.density);
      expect(level.river.length).toBeGreaterThan(10);
      expect(level.solids.filter((s) => s.kind === "erratic")).toHaveLength(0);
      expect(level.fauna.length).toBeGreaterThan(6);
    }
  });
});

describe("a biome is a kind of coast, never a place", () => {
  /** The source and the docs, minus what is allowed to name a place: the
   * spec (a copy of the sibling's), the changelog and its fragments (a
   * record), the lessons (a record too) and the licence. */
  function sources(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      if (name.startsWith(".") || name === "node_modules" || name === "dist") continue;
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        if (["previews", "tauri", "native", "prompts"].includes(name)) continue;
        sources(path, out);
      } else if (
        /\.(ts|tsx|mjs|md)$/.test(name) &&
        // …and not this file, which carries the words it looks for, nor the
        // identity test, which guards against the sibling game's own name.
        !/CHANGELOG|OSS_GAME_SPEC|LICENSE|biome_test|identity_test/.test(name)
      ) {
        out.push(path);
      }
    }
    return out;
  }

  it("names no country, sea or shore anywhere in the tree", () => {
    // The seas and the countries the two coasts were measured from, and
    // the ones a warm or a cold coast is most likely to be described by.
    // A species' name is not a place (a "Norway spruce" is a tree), so the
    // words are the bare ones a sentence about a place would use.
    const places =
      /\b(Baltic|Bothnia\w*|Sweden|Swedish|Scandinavi\w+|Finland|Finnish|Norwegian|Denmark|Danish|Atlantic|Pacific|Caribbean|Mediterranean|North Sea|Gulf of \w+|Florida|Everglades|Bahamas|Cuba|Skagerrak|Kattegat|High Coast|Svalbard|Spitsbergen|Greenland\b|Barents|Kara Sea|Beaufort|Chukchi|Alaska\w*|Siberia\w*|Canad\w+|Iceland\w*|Antarctic\w*|Ross Ice Shelf|Larsen|Jakobshavn)\b/;
    const hits: string[] = [];
    for (const path of sources(ROOT)) {
      const text = readFileSync(path, "utf8");
      const m = places.exec(text);
      if (m) hits.push(`${path.slice(ROOT.length + 1)}: "${m[0]}"`);
    }
    expect(hits).toEqual([]);
  });
});
