// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE SHORE IS PAINTED, PER COAST — the other app-side half of a biome
// row, beside `water-optics.ts`. The engine says what a shore is MADE of
// (`level.materialAt`: bedrock, rock, sand, water); this says what each of
// those looks like on THIS coast, because a slab of granite and a shelf of
// marl are both "bedrock" to the classifier and nothing alike to the eye.
//
// Three-free and hex-only, the way the flora's and the sky's tables are, so
// `tests/biome_test.ts` can hold it to `BIOME_IDS` without a renderer:
// `terrain.ts` turns the hexes into colours once, and `rocks.ts` hands the
// stone tones to the carver.

import type { BiomeId } from "@engine";

import { PALETTE } from "../identity.ts";
import { TREE_LINE } from "./flora-defs.ts";

export type ShorePaint = {
  /** The smoothed slab: what the classifier calls bedrock. */
  readonly bedrock: string;
  /** The boulder field, and the loose blocks on the shore. */
  readonly boulder: string;
  /** The beach dry, the strip the water is still working, and the pale
   * bottom in front of it that the shallows take their colour from. */
  readonly sand: string;
  readonly sandWet: string;
  readonly sandBed: string;
  /** The sea bed where the eye still reaches it. What it goes to with depth
   * is the coast's water (`WaterOptics.bed`), never a second ramp here. */
  readonly bed: string;
  /** How far out from the beach the bed still remembers it is sand, m —
   * wide on a coast of flats and sandbars, a strip on a rock one. */
  readonly bedReach: number;
  /** The wet band at the waterline on rock. */
  readonly wet: string;
  /** THE RIVER'S BANK (R16, R26): the soil and grass that run down to the
   * water past the mouth — and the strip at the very edge, `bankStoneUp`
   * metres over the water, where the river has washed the soil off and
   * left what is under it: stone on a rock coast, mud on a mangrove one. */
  readonly bank: string;
  readonly bankStone: string;
  readonly bankStoneUp: number;
  /** The ground under the wood, and where the wood starts: metres inland
   * of the waterline, and the height band over sea level it fades in over.
   * A northern shore keeps its slabs bare for twenty metres before the
   * pines; a mangrove stands with its feet in the water. And where it
   * STOPS, m over sea level: the tree line on a wooded coast, so the hill
   * stands bare over the wood — and the top of the moraine on a coast
   * whose "bedrock" past that height is a wall of ice with nothing
   * growing on it. */
  readonly floor: string;
  readonly floorFrom: number;
  readonly floorAbove: readonly [number, number];
  readonly floorTo: number;
  /** The stone the standing rocks are carved in — the wet band at the
   * water, the face above it, the lit crown — for the sculpted kinds, and
   * the two tones the instanced kinds take: the reef awash and the erratic
   * up the beach. Null for a form's own granite. */
  readonly stone: { readonly wet: number; readonly body: number; readonly lit: number } | null;
  readonly reef: number;
  readonly erratic: number;
};

export const SHORE_PAINT: Readonly<Partial<Record<BiomeId, ShorePaint>>> = {
  taiga: {
    bedrock: PALETTE.granite,
    boulder: PALETTE.graniteDark,
    sand: PALETTE.sand,
    // Wet sand goes DARKER and browner, where rock goes grey; painting
    // both with one wet band is what makes a beach look like a stone slab
    // with sand printed on it.
    sandWet: "#8f7345",
    sandBed: "#bda878",
    // Dark olive: a northern sea bed under humic water.
    bed: "#3a4a34",
    bedReach: 45,
    wet: "#646a70",
    // The bank: the alder's floor, a grass-and-litter green darker than the
    // slab and warmer than the wood behind it; and the river's edge is the
    // granite again for the last metre, where the spring floods have taken
    // the turf off.
    bank: "#5f7040",
    bankStone: "#7d7f78",
    bankStoneUp: 1,
    floor: PALETTE.pineDark,
    floorFrom: 22,
    floorAbove: [1.2, 3],
    floorTo: TREE_LINE,
    stone: null,
    // A reef is a dark shape UNDER the water, and it has to stay a shape:
    // the sea bed's own olive taken a step down rather than the near-black
    // it reads as on paper, because three converts a hex swatch to linear
    // and the darkest thing on the shore has nowhere left to fall.
    reef: 0x475840,
    // The erratics: warmer than the slab they sit on, because they came
    // from somewhere else — which is the whole point of an erratic, and
    // what makes one read as an object on the shore rather than part of it.
    erratic: 0x9a8b78,
  },
  mangrove: {
    // The "bedrock" of a low warm coast is a shelf of marl and shell, pale
    // and warm-grey, that the mangroves stand on; the "rock" is the oyster
    // bars and the coral rubble that break it up, darker and browner.
    bedrock: "#c8bea6",
    boulder: "#a89b80",
    // WHITE SAND: quartz so fine and so pale it reads as snow from the
    // water, and the whole reason the shallows over it are turquoise.
    sand: "#f0eadc",
    sandWet: "#c9b993",
    sandBed: "#e8dfc4",
    // The bottom is sand and seagrass, pale rather than olive, and the
    // flats run far out before the water is deep enough to hide them.
    bed: "#8c9a7c",
    bedReach: 110,
    wet: "#9a927e",
    // The bank is mangrove mud under a mat of cordgrass, and at the water
    // it is the mud alone, dark and wet, only half a metre of it because
    // nothing on this coast stands higher.
    bank: "#6b6f45",
    bankStone: "#4a4638",
    bankStoneUp: 0.5,
    // Mangrove mud, and the palm litter under the trees: dark, and right
    // down at the water's edge.
    floor: "#4a4633",
    floorFrom: 3,
    floorAbove: [0.25, 1.2],
    floorTo: TREE_LINE,
    // Limestone: pale, bleached at the crown, dark and green where the sea
    // keeps it wet.
    stone: { wet: 0x5a6152, body: 0xb3ab94, lit: 0xd9d2bb },
    // A coral head or a sandbar awash — pale under the water, not dark.
    reef: 0x9aa088,
    erratic: 0xb3ab94,
  },
  arctic: {
    // THE "BEDROCK" IS ICE. The classifier calls the glacier's front
    // bedrock — a face steeper than anything else on any coast — and the
    // wall is painted the blue-white of old glacier ice, lightening to
    // snow at its lip (`terrain.ts` lightens bedrock as it climbs, which
    // is exactly what a snow-covered glacier surface does). The "rock" is
    // the moraine: the dark wet till and the boulders the ice dropped,
    // nearly black against the wall.
    bedrock: "#d6e6f0",
    boulder: "#4a4c4a",
    // The "sand" is the moraine's GRAVEL: grey, coarse, and darker wet.
    // No white sand and no ochre anywhere on this coast — a warm hex here
    // is a beach, and this is not a beach.
    sand: "#8c8a86",
    sandWet: "#5c5d5b",
    sandBed: "#767a78",
    // The bottom off a glacier is cobble and silt, dark blue-grey.
    bed: "#2a3a42",
    bedReach: 30,
    // The wet band on the wall: the ice at the waterline is the BLUEST
    // thing on the coast, because it is the oldest and the densest and
    // the sea keeps it polished.
    wet: "#8ab6cc",
    // The crack's walls are ice too, and its "bank" is the ice again —
    // the classifier's bank is soil and grass on a coast that has soil,
    // and this one has none. The last two metres over the water are the
    // deep blue of the wall's foot.
    bank: "#c8dde9",
    bankStone: "#8ab6cc",
    bankStoneUp: 2,
    // THE TUNDRA: the ground under nothing, because nothing here has a
    // trunk. Brown-green moss and lichen over the till, and it takes the
    // low ground only — every metre of ground over `floorTo` is the
    // glacier's own surface, and a glacier is ice to its top.
    floor: "#6e6a56",
    floorFrom: 6,
    floorAbove: [0.4, 2],
    floorTo: 6,
    // THE STANDING ROCKS ARE BERGS. A skerry off this coast is a berg
    // grounded in the shallows and a stack the tallest berg on the level:
    // the same carving as the taiga's granite, in ice — the deep blue
    // where the sea has it, white above, and lit nearly to paper at the
    // crown.
    stone: { wet: 0x7fb0c8, body: 0xdbe9f1, lit: 0xf6fafc },
    // A growler awash: pale under the water, the one pale reef in the game.
    reef: 0xa8c8d6,
    // …and the erratics are the real thing, dark moraine blocks on the
    // gravel — the one kind of rock here that is actually rock.
    erratic: 0x5a5854,
  },
};

/** The row for a coast; throws for one nobody has drawn the shore of, the
 * way `waterOpticsOf` throws for one nobody has drawn the water of. */
export function shorePaintOf(biome: BiomeId): ShorePaint {
  const row = SHORE_PAINT[biome];
  if (!row) throw new Error(`no shore is painted for the "${biome}" coast yet`);
  return row;
}
