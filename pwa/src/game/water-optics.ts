// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE WATER IS MADE OF, PER COAST — the optical half of a biome.
//
// `engine/mapgen/biomes.ts` says what a coast's water IS: how dense, how
// cold. Nothing in the engine has an opinion about how it LOOKS, because
// nothing in the engine has an opinion about colour at all — so the other
// half of the row lives here, the way `craft-styles.ts` carries the look of
// a hull whose dimensions are the catalog's, and `fauna.ts`'s `STYLES` the
// paint on an animal whose length is. Change one, change both: a coast
// added to `BIOMES` and not to the table below throws on its first level.
//
// A coast's water is FOUR THINGS, and only the first is a colour:
//
//   THE TONES     what the body is, over nothing, over the shelf and over
//                 the deep. The taiga's are the app's own palette — this
//                 IS the sea the game was drawn around. A warm coast's
//                 will not be.
//   THE RAMP      how many metres of bed it takes to get from one to the
//                 next. A brackish northern sea is at its deep tone over
//                 twenty metres; a lagoon is still turquoise over thirty,
//                 and that — not the hue alone — is what reads as tropical.
//   THE WINDOW    how opaque the surface is looking STRAIGHT DOWN: over no
//                 water at all, and over `clarity` metres of it. The
//                 surface's own scattering skin, and the one number that
//                 answers "how see-through is this sea".
//   THE CLARITY   HOW FAR THE EYE GETS INTO IT, m. The single depth scale
//                 the whole see-through model is written against: the
//                 window reaches its deep value over it, the sea bed
//                 disappears into the water over it (`terrain.ts`), and an
//                 animal is hazed toward the water's own colour over it
//                 (`fauna.ts`). One number, because it is one physical
//                 fact — how far light gets through this water before it
//                 has all been scattered back out.
//
// THE CLARITY IS NOT THE WINDOW, and the difference is the whole reason
// this file is shaped the way it is. The surface's alpha is ONE number for
// a patch of sea and knows nothing about how far under it a thing is, so
// turning it up to hide the sea bed at twenty metres hides a fish at two by
// exactly as much. What actually happens in water is that the column
// BETWEEN a thing and the eye scatters its own light back, so how much of
// something survives depends on ITS depth, not on the surface's. That
// belongs on the thing — the bed and the animals each fade into the water
// over `clarity` — and it is what lets a coast hide its bottom while its
// sea life still reads.

import * as THREE from "three";
import { type BiomeId } from "@engine";

import { PALETTE } from "../identity.ts";
import { clamp } from "../lib/util.ts";

export type WaterOptics = {
  /** The body over nothing, over the shelf and over the deep — sRGB hexes,
   * the way every colour in this app is authored. */
  readonly shallow: string;
  readonly sea: string;
  readonly deep: string;
  /** Bed depth at which the shallow tint has given way to the sea's own
   * colour, m, and where that has given way to the deep. */
  readonly shallowTo: number;
  readonly deepTo: number;
  /** WHAT THE BOTTOM BECOMES once the water has taken it — the colour every
   * submerged thing past `clarity` fades into (`terrain.ts`).
   *
   * It is FLAT, which is the whole point: what gives a hidden bottom away is
   * not its brightness but its SHAPE — the contours the light picks out and
   * the pale sand patches — and a bed that fades to one colour has neither.
   * And it is DARK, well under the tones above, because most of the open
   * sea's tone is the unlit bottom showing through the surface: fade the bed
   * into the water's own bright tone instead and the sea comes back pale and
   * milky, a different day rather than a deeper one. */
  readonly bed: string;
  /** The surface's opacity looking straight down: over no water, and over
   * `clarity` metres of it. */
  readonly window: readonly [number, number];
  /** How far the eye gets into this water, m — see the header. */
  readonly clarity: number;
};

/** Every coast's water, keyed the way `BIOMES` is: one row per coast that is
 * BUILT, and a coast without one is not a coast this game can draw. */
export const WATER_OPTICS: Readonly<Partial<Record<BiomeId, WaterOptics>>> = {
  taiga: {
    // The app's own palette IS the taiga's water: a northern brackish sea,
    // green-teal rather than blue, going to near-black over the deep.
    shallow: PALETTE.seaShallow,
    sea: PALETTE.sea,
    deep: PALETTE.seaDeep,
    shallowTo: 4,
    deepTo: 22,
    // The bottom of a northern sea, unlit: the dark olive the bed's own
    // paint already runs to before the water finishes the job.
    bed: "#14241c",
    // A skin you cannot see a great deal through even under the rider. The
    // Bothnian Sea carries the whole northern forest's runoff — humic,
    // green, and the reason a summer Secchi reading there is a dozen metres
    // in a good week and half that in a bad one.
    //
    // THE DEEP STOP IS SET BY THE SEA LIFE, not by the water. Whatever the
    // surface keeps for itself it keeps from the animals under it too, and
    // they hold at two to six metres where nothing else is left to hide: at
    // 0.76 a pair of porpoises eight metres down goes from faint to one of
    // them gone (`--scene wildlife --seed 19`, the two builds side by side).
    // 0.68 is the last stop that still reads. What made this coast less
    // see-through is not this number but the bottom leaving.
    window: [0.3, 0.68],
    clarity: 12,
  },
};

/** The row for a coast; throws for one nobody has drawn the water of, the
 * way `biomeOf` throws for one nobody has built. The engine refuses to
 * generate a level on an unbuilt coast, so a level in hand always has one. */
export function waterOpticsOf(biome: BiomeId): WaterOptics {
  const row = WATER_OPTICS[biome];
  if (!row) throw new Error(`no water is drawn for the "${biome}" coast yet`);
  return row;
}

/** A coast's three tones as colours, made once each. */
export type SeaTones = {
  readonly shallow: THREE.Color;
  readonly sea: THREE.Color;
  readonly deep: THREE.Color;
  readonly bed: THREE.Color;
};

const tones = new WeakMap<WaterOptics, SeaTones>();

export function seaTones(optics: WaterOptics): SeaTones {
  let row = tones.get(optics);
  if (!row) {
    row = {
      shallow: new THREE.Color(optics.shallow),
      sea: new THREE.Color(optics.sea),
      deep: new THREE.Color(optics.deep),
      bed: new THREE.Color(optics.bed),
    };
    tones.set(optics, row);
  }
  return row;
}

/**
 * WHAT THE WATER'S OWN BODY IS over `depth` metres of bed, into `out` — the
 * colour the water grid paints its vertices with.
 */
export function seaTone(optics: WaterOptics, depth: number, out: THREE.Color): THREE.Color {
  const t = seaTones(optics);
  out.copy(t.shallow).lerp(t.sea, clamp(depth / optics.shallowTo, 0, 1));
  return out.lerp(
    t.deep,
    clamp((depth - optics.shallowTo) / (optics.deepTo - optics.shallowTo), 0, 1),
  );
}

/**
 * HOW MUCH OF WHAT IS DOWN THERE THE WATER HAS TAKEN: 0 at the surface, 1
 * once `clarity` metres of it stand between the thing and the eye. The sea
 * bed mixes into the water by this, and it is also what says how much a
 * closed window is actually costing (`water-mesh.ts`).
 */
export function seaHaze(optics: WaterOptics, depth: number): number {
  return clamp(depth / optics.clarity, 0, 1);
}

/** The surface's opacity looking STRAIGHT DOWN over `depth` metres of bed —
 * its own scattering skin, thickening over the first `clarity` metres and
 * flat past them. The shader takes it from there: what the mirror does not
 * reflect at the real angle is what comes through. */
export function seaWindow(optics: WaterOptics, depth: number): number {
  const [clear, deep] = optics.window;
  return clear + (deep - clear) * seaHaze(optics, depth);
}
