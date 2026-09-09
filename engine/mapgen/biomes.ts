// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIOMES: which COAST a level is built on, as data.
//
// A biome is everything about a shore that is not the course: what the
// land is made of and how it stands, what the water is (brackish or salt,
// warm or cold), how thickly the rocks stand offshore, what the sky over it
// can be (R19), and what swims in its water (R20). The difference between
// the coasts is stated here, once, as rows the rest of the generator reads
// through `biomeOf`. Nothing else in `mapgen/` names a country: the
// geology asks the row how high the land stands and how much of a bay is
// sand, the placer asks it how many rocks a kilometre carries, the compiler
// asks it what the water is.
//
// Six ids are reserved in `types.ts` so a campaign location never changes
// its name; ONE row is built. The taiga's is the coast every rule in
// `rules.ts` was written against — the Baltic's northern shore: low,
// glacially planed bedrock slabs sliding into brackish water, boulder
// fields the ice left behind, gravel and sand collecting in the bays,
// skerries and reefs a stone's throw out. Asking for an unbuilt biome
// throws, by design: a level on a coast nobody has drawn is not a level.

import type { FaunaId } from "../game/defs/fauna.ts";
import type { Band } from "./rules.ts";
import type { BiomeId, Weather } from "./types.ts";

export type Biome = {
  readonly id: BiomeId;
  /** The name a menu shows. */
  readonly name: string;
  /** The water: density kg/m³ and the temperature band °C a level draws
   * from (R13). */
  readonly water: { readonly density: number; readonly temperature: Band };
  /** How far north the coast lies, degrees (R13) — the one number that
   * turns a level's hour into a place for the sun, and so into a sky. It
   * is a fact about the coast rather than about the run, which is why it
   * sits in the biome's row and not in the rule book. */
  readonly latitude: number;
  /** Multiplier on `LEVEL_RULES.land.plateau` — how high this coast's land
   * stands against the rule book's band (1 is the taiga's). Held under
   * `land.maxHeight` whatever it is. */
  readonly relief: number;
  /** Multipliers on `LEVEL_RULES.solids.<kind>.perKm`. */
  readonly rocks: {
    readonly skerry: number;
    readonly boulder: number;
    readonly reef: number;
    readonly erratic: number;
  };
  /** Multiplier on `LEVEL_RULES.surface.boulder.threshold`'s complement:
   * above 1 the boulder fields are wider, below 1 sparser. */
  readonly boulderField: number;
  /** Whether this coast's soft stretches carry a sand beach at all
   * (R16) — a coast of bare rock says no and every waterline on it is
   * stone. */
  readonly beaches: boolean;
  /** The skies this coast can be under (R19), lightest first. A coast is
   * partly its weather — a Baltic shore gets the whole range and an atoll
   * will not get a Baltic squall — so the chart is the biome's rather than
   * the rule book's. */
  readonly weathers: readonly Weather[];
  /** What SWIMS on this coast (R20) — ids from `engine/game/defs/fauna.ts`.
   * How often each is met is the catalog's `perKm`, not the biome's: a
   * coast says which animals are possible, the animal says how rare it is.
   * A coast that offers none simply has no life in its water. */
  readonly fauna: readonly FaunaId[];
};

/** Every biome that is BUILT, in the order they are offered. */
export const BIOME_IDS: readonly BiomeId[] = ["taiga"];

export const BIOMES: Readonly<Partial<Record<BiomeId, Biome>>> = {
  taiga: {
    id: "taiga",
    name: "Taiga coast",
    // The Bothnian Sea is nearly fresh — 1005 kg/m³ — and cold even in
    // high summer: 8 °C in a June morning, 18 °C in a warm August bay.
    water: { density: 1005, temperature: { min: 8, max: 18 } },
    // The High Coast, at the top of the Bothnian Sea. Far enough north that
    // the midsummer sun only just sets, which is the whole character of the
    // light here: long low evenings, a twilight that never finishes, and a
    // sunrise three hours after midnight.
    latitude: 62,
    relief: 1,
    rocks: { skerry: 1, boulder: 1, reef: 1, erratic: 1 },
    boulderField: 1,
    beaches: true,
    // R19 — the Bothnian summer, which is every sky there is. A northern
    // coast in July runs from a windless blue morning to a line squall
    // coming in off the open sea in an afternoon, and the whole point of
    // hanging the draw on the wind is that both are on the same chart.
    weathers: ["clear", "high", "overcast", "rain", "squall"],
    // R20 — the Bothnian Sea's own fish and its one cetacean, and the four
    // Atlantic strays a northern shore sees once in a generation. Listing
    // the strays is what makes them possible at all; the catalog's `perKm`
    // is what keeps them worth seeing.
    fauna: [
      "herring",
      "roach",
      "perch",
      "pike",
      "salmon",
      "porpoise",
      "dolphin",
      "shark",
      "orca",
      "minke",
    ],
  },
};

/** The row for a biome id; throws for a coast that is not built yet. */
export function biomeOf(id: BiomeId): Biome {
  const row = BIOMES[id];
  if (!row) throw new Error(`biome "${id}" is not built yet (built: ${BIOME_IDS.join(", ")})`);
  return row;
}
