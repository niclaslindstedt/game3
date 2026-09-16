// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A COAST IS NAMED IN SIX PLACES, and this is the test that holds them to
// one list. The engine's row (`engine/mapgen/biomes.ts`) says what a coast
// IS; the app says what it LOOKS like in four tables that cannot import
// each other's reason to exist — its water (`water-optics.ts`), its shore
// (`shore-paint.ts`), its skies and seasons (`sky-looks.ts`) — and two
// rosters whose rows each name the coasts they belong to (`flora-defs.ts`,
// `bird-defs.ts`). A coast added to `BIOME_IDS` and missing from any of them
// is a level that throws on load, or a shore with nothing growing on it;
// the cases below make each of those a red test instead.
//
// And a biome is a KIND of coast, never a place. The second half of the
// file holds the rows to what makes the two coasts two — the cold one is
// cold, brackish, sheltered and grey-green; the warm one is warm, salt,
// swell-swept and turquoise — and holds the tree to the rule that nothing
// in it names a country, a sea or a shore that exists.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BIOME_IDS,
  BIOMES,
  FAUNA,
  LEVEL_RULES as R,
  WEATHER_IDS,
  biomeOf,
  flowAt,
  generateLevel,
  isBiomeId,
  isFaunaId,
  landHeight,
  sampleField,
  type Level,
} from "@engine";

import { LEVEL_SEEDS, MANGROVE_SEEDS, levelFor, mangroveFor } from "./support/levels.ts";
import { BIRDS, birdsOf } from "../pwa/src/game/bird-defs.ts";
import { FLORA, floraOf } from "../pwa/src/game/flora-defs.ts";
import { SHORE_PAINT, shorePaintOf } from "../pwa/src/game/shore-paint.ts";
import { SEASON_LOOKS, SKY_LOOKS, looksOf, seasonsOf } from "../pwa/src/game/sky-looks.ts";
import { WATER_OPTICS, waterOpticsOf } from "../pwa/src/game/water-optics.ts";

const ROOT = process.cwd();

describe("the built coasts", () => {
  it("are the two the game opens on, the taiga first", () => {
    expect(BIOME_IDS).toEqual(["taiga", "mangrove"]);
    expect(isBiomeId("taiga")).toBe(true);
    expect(isBiomeId("mangrove")).toBe(true);
    // Reserved, not built: a row nobody has written is a level that throws.
    expect(isBiomeId("atoll")).toBe(false);
    expect(isBiomeId(null)).toBe(false);
    expect(() => biomeOf("fjord")).toThrow(/not built/);
    expect(() => generateLevel(1, { biome: "delta" })).toThrow(/not built/);
    expect(Object.keys(BIOMES).sort()).toEqual([...BIOME_IDS].sort());
  });

  it("have every app-side half, and no app-side half is for a coast nobody built", () => {
    for (const table of [WATER_OPTICS, SHORE_PAINT, SKY_LOOKS, SEASON_LOOKS]) {
      expect(Object.keys(table).sort()).toEqual([...BIOME_IDS].sort());
    }
    for (const id of BIOME_IDS) {
      expect(() => waterOpticsOf(id)).not.toThrow();
      expect(() => shorePaintOf(id)).not.toThrow();
      expect(() => looksOf(id)).not.toThrow();
      expect(() => seasonsOf(id)).not.toThrow();
      // Every sky the engine can name is painted on every coast — `Looks`
      // is total — and every sky the coast OFFERS is one the engine names.
      for (const w of WEATHER_IDS) expect(looksOf(id)[w], `${id} ${w}`).toBeDefined();
      for (const w of biomeOf(id).weathers) expect(WEATHER_IDS).toContain(w);
      expect(biomeOf(id).weathers.length).toBeGreaterThan(2);
    }
    expect(() => shorePaintOf("arctic")).toThrow(/arctic/);
    expect(() => looksOf("arctic")).toThrow(/arctic/);
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
    // The two rosters are two: the cold coast's signature species grow on
    // it alone, and the warm coast's on it alone.
    const taiga = new Set(floraOf("taiga").map((s) => s.id));
    const mangrove = new Set(floraOf("mangrove").map((s) => s.id));
    for (const id of ["spruce", "birch", "reed"])
      expect(taiga.has(id) && !mangrove.has(id)).toBe(true);
    for (const id of ["redmangrove", "sabal", "coconut"]) {
      expect(mangrove.has(id) && !taiga.has(id), id).toBe(true);
    }
  });
});

describe("what makes the two coasts two", () => {
  const taiga = biomeOf("taiga");
  const mangrove = biomeOf("mangrove");

  it("is the water: cold and brackish against warm and salt", () => {
    expect(taiga.water.density).toBeLessThan(mangrove.water.density);
    for (const season of ["spring", "summer", "autumn", "winter"] as const) {
      expect(taiga.water.temperature[season].max).toBeLessThan(
        mangrove.water.temperature[season].min,
      );
    }
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

  it("is the sun: a northern latitude against a subtropical one", () => {
    expect(taiga.latitude).toBeGreaterThan(55);
    expect(mangrove.latitude).toBeLessThan(35);
    expect(mangrove.latitude).toBeGreaterThan(23.5);
  });

  it("is the shore: high rock and boulders against low sand and marl", () => {
    expect(mangrove.relief).toBeLessThan(taiga.relief);
    expect(mangrove.shore.sand).toBeGreaterThan(taiga.shore.sand);
    expect(mangrove.rocks.boulder).toBe(0);
    expect(mangrove.rocks.erratic).toBe(0);
    expect(mangrove.rocks.stack).toBe(0);
    // But never a coast of ONE material: R21's quilt is held on every
    // biome, and the field that breaks the marl up has to be there.
    expect(mangrove.boulderField).toBeGreaterThan(0);
    expect(mangrove.shore.sand).toBeLessThan(1.5);
  });

  it("is the sea: a sheltered skerry coast against an open swell-swept one", () => {
    expect(taiga.sea.wind).toBeLessThan(1);
    expect(taiga.sea.swell).toBeLessThan(1);
    expect(mangrove.sea.swell).toBeGreaterThan(taiga.sea.swell);
    expect(mangrove.sea.wind).toBeLessThan(taiga.sea.wind);
    // Neither is off: the waves are the game on both.
    expect(taiga.sea.wind).toBeGreaterThan(0.6);
    expect(mangrove.sea.wind).toBeGreaterThan(0.6);
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
    expect(taiga.river).toEqual({ mouth: 1, head: 1, taper: 1, bend: 1, discharge: 1, bars: null });
    expect(mangrove.river.mouth).toBeGreaterThan(1);
    expect(mangrove.river.taper).toBeLessThan(1);
    expect(mangrove.river.bend).toBeGreaterThan(1);
    expect(mangrove.river.discharge).toBeLessThan(1);
    expect(mangrove.river.bars?.count.min).toBeGreaterThanOrEqual(1);
    // A bar keeps the river's own centreline in water: its channel is wider
    // than the cell the walk reads the water off.
    expect(mangrove.river.bars?.channel).toBeGreaterThan(R.grid.cell);
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

  it("is the sky: the haze is warm water's and the cold coast never deals it", () => {
    expect(mangrove.weathers).toContain("haze");
    expect(taiga.weathers).not.toContain("haze");
    // The lightest and the heaviest sky are on both charts, so the ends of
    // R12's band stay the days they have to be everywhere.
    for (const b of [taiga, mangrove]) {
      expect(b.weathers[0]).toBe("clear");
      expect(b.weathers[b.weathers.length - 1]).toBe("squall");
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
      /\b(Baltic|Bothnia\w*|Sweden|Swedish|Scandinavi\w+|Finland|Finnish|Norwegian|Denmark|Danish|Atlantic|Pacific|Caribbean|Mediterranean|North Sea|Gulf of \w+|Florida|Everglades|Bahamas|Cuba|Skagerrak|Kattegat|High Coast)\b/;
    const hits: string[] = [];
    for (const path of sources(ROOT)) {
      const text = readFileSync(path, "utf8");
      const m = places.exec(text);
      if (m) hits.push(`${path.slice(ROOT.length + 1)}: "${m[0]}"`);
    }
    expect(hits).toEqual([]);
  });
});
