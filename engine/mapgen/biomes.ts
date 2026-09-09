// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIOMES: which COAST a level is built on, as data.
//
// A biome is everything about a shore that is not the course: what the
// land is made of and how it stands, what the water is (brackish or salt,
// warm or cold), how thickly the rocks stand offshore, and — later — what
// swims in it and what the weather over it can be. The difference between
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

import type { Band } from "./rules.ts";
import type { BiomeId } from "./types.ts";

export type Biome = {
  readonly id: BiomeId;
  /** The name a menu shows. */
  readonly name: string;
  /** The water: density kg/m³ and the temperature band °C a level draws
   * from (R13). */
  readonly water: { readonly density: number; readonly temperature: Band };
  /** Multiplier on `LEVEL_RULES.land.plateau` — how high this coast's land
   * stands against the rule book's band (1 is the taiga's). Held under
   * `land.maxHeight` whatever it is. */
  readonly relief: number;
  /** Multipliers on `LEVEL_RULES.solids.<kind>.perKm`. */
  readonly rocks: { readonly skerry: number; readonly boulder: number; readonly reef: number };
  /** Multiplier on `LEVEL_RULES.surface.boulder.threshold`'s complement:
   * above 1 the boulder fields are wider, below 1 sparser. */
  readonly boulderField: number;
  /** Whether a bay's low ground collects sand at all (R16). */
  readonly sandPockets: boolean;
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
    relief: 1,
    rocks: { skerry: 1, boulder: 1, reef: 1 },
    boulderField: 1,
    sandPockets: true,
  },
};

/** The row for a biome id; throws for a coast that is not built yet. */
export function biomeOf(id: BiomeId): Biome {
  const row = BIOMES[id];
  if (!row) throw new Error(`biome "${id}" is not built yet (built: ${BIOME_IDS.join(", ")})`);
  return row;
}
