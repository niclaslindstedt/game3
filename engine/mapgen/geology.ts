// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R2, R3, R16, R17 — THE GROUND, and the rocks standing on it.
//
// A Baltic taiga coast is one rock, planed by the ice: the ground is a
// single smooth function of HOW FAR FROM THE SHORE a point is, with the
// grain of the country laid on top. Everything here is analytic — a
// function of (x, z) through the shore's signed distance — so the search
// can ask about any point before there is a grid, and the compiler can
// bake the same answer into one afterwards.
//
//   SEAWARD (R3): the bed falls from the waterline on a profile that is
//   steep at first and levels at `sea.depth` by `sea.reach` — the concave
//   slope of a drowned slab, not a beach. A BAY carries a shelf: the same
//   profile scaled shallower for the first `sea.shelf.reach` metres and
//   blended back, because the sediment the coast has collects where the
//   water is quiet. A grain of detail rides on it, faded out over the
//   shallows so the waterline is exactly where the shore says.
//
//   LANDWARD (R2): the ground rises on a smooth step from zero at the
//   waterline to the level's plateau by `land.reach`, and past the reach it
//   is that plateau exactly. The SLABS — rounded whalebacks of bedrock —
//   ride on the step, faded out at the waterline (so the zero contour holds)
//   and at the reach (so the plateau is flat), and their amplitude keeps
//   the whole under `land.maxHeight`.
//
//   THE ROCKS (R17): skerries, boulders and reefs are placed after the
//   course is laid, each kind at its density inside its offshore band,
//   kept off the course by the keep-out the course hands over, and kept
//   apart from each other. A rock that finds no legal spot in its tries is
//   simply not placed: the coast is a little emptier there, which is what
//   a coast is allowed to be.

import { clamp } from "../lib/math.ts";
import { smooth, valueNoise } from "../lib/noise.ts";
import type { Rng } from "../lib/prng.ts";
import type { Biome } from "./biomes.ts";
import { LEVEL_RULES as R, inBand } from "./rules.ts";
import type { Shore } from "./shore.ts";
import type { Solid } from "./types.ts";

export type Geology = {
  /** The plateau's height, m above sea level (R2). */
  readonly plateau: number;
  /** Noise seed the surface classifier keys the boulder field on (R16). */
  readonly boulderSeed: number;
  /** Ground height at a plan point, m against sea level. */
  groundAt(x: number, z: number): number;
  /** Ground and offshore distance at once — one shore lookup, which is
   * what the compiler and the search both want. */
  sample(x: number, z: number): { ground: number; offshore: number };
};

/** R3 — the open coast's bed profile: depth (positive) at `offshore` m. */
export function bedDepth(offshore: number): number {
  const t = clamp(offshore / R.sea.reach, 0, 1);
  return R.sea.depth * (1 - (1 - t) * (1 - t));
}

/** R3 — the shelf: the bed's depth multiplier at `offshore` m out from a
 * shore that has receded `bay` m. 1 on a headland and past the shelf's
 * blend; `sea.shelf.factor` at the head of a full bay. */
export function shelfFactor(bay: number, offshore: number): number {
  const fullness = clamp(bay / R.sea.shelf.bay, 0, 1);
  const shallow = 1 - (1 - R.sea.shelf.factor) * fullness;
  const out = clamp((offshore - R.sea.shelf.reach) / R.sea.shelf.blend, 0, 1);
  return shallow + (1 - shallow) * smooth(out);
}

/** R2 — the land's step: height at `inland` m from the waterline. */
export function landHeight(inland: number, plateau: number): number {
  return plateau * smooth(clamp(inland / R.land.reach, 0, 1));
}

export function createGeology(rng: Rng, biome: Biome, shore: Shore): Geology {
  const plateau = Math.min(
    inBand(rng, R.land.plateau) * biome.relief,
    R.land.maxHeight - R.land.slab.amplitude,
  );
  const slabSeed = rng.int(1, 0x7fffffff);
  const bedSeed = rng.int(1, 0x7fffffff);
  const boulderSeed = rng.int(1, 0x7fffffff);

  const sample = (x: number, z: number): { ground: number; offshore: number } => {
    const offshore = shore.distanceAt(x, z);
    if (offshore >= 0) {
      const { s } = shore.toLocal(x, z);
      const bed = -bedDepth(offshore) * shelfFactor(shore.bayAt(s), offshore);
      const grain = (valueNoise(x, z, R.sea.detail.scale, bedSeed) - 0.5) * 2;
      const fade = Math.min(1, offshore / R.sea.detail.fade);
      return { ground: bed + grain * R.sea.detail.amplitude * fade, offshore };
    }
    const inland = -offshore;
    const step = landHeight(inland, plateau);
    // The slabs fade in from the waterline and out at the reach: the
    // window is what keeps R2's plateau flat and the shoreline where the
    // polyline put it.
    const window =
      Math.min(1, inland / R.land.slab.fade) *
      (1 - smooth(clamp(inland / R.land.reach, 0, 1)));
    const slab = (valueNoise(x, z, R.land.slab.scale, slabSeed) - 0.5) * 2;
    return { ground: step + slab * R.land.slab.amplitude * window, offshore };
  };

  return {
    plateau,
    boulderSeed,
    groundAt: (x, z) => sample(x, z).ground,
    sample,
  };
}

/** Whether a rock of radius `r` may stand at (x, z): the course's answer,
 * handed to the placer so the geology never learns what a gate is. */
export type KeepOut = (x: number, z: number, r: number) => boolean;

type SolidKind = Solid["kind"];

const KIND_PREFIX: Record<SolidKind, string> = { skerry: "K", boulder: "B", reef: "F" };

/** R17 — lay the rocks along the coast between two distances along its
 * base line, in the water, off the course, apart from each other.
 * Deterministic in `rng`. */
export function laySolids(
  rng: Rng,
  biome: Biome,
  shore: Shore,
  geology: Geology,
  sFrom: number,
  sTo: number,
  keepOut: KeepOut,
): Solid[] {
  const solids: Solid[] = [];
  const km = (sTo - sFrom) / 1000;
  const kinds: SolidKind[] = ["skerry", "boulder", "reef"];
  for (const kind of kinds) {
    const rule = R.solids[kind];
    const count = Math.round(rule.perKm * biome.rocks[kind] * km * rng.range(0.8, 1.2));
    let placed = 0;
    for (let n = 0; n < count; n++) {
      for (let attempt = 0; attempt < R.solids.tries; attempt++) {
        const s = rng.range(sFrom, sTo);
        const out = inBand(rng, rule.offshore);
        const r = inBand(rng, rule.r);
        const top = inBand(rng, rule.top);
        // Pushed out along the base line's normal, then held to the TRUE
        // distance: on a sloping stretch of shore the two differ, and the
        // band is a promise about the second.
        const { x, z } = shore.toWorld(s, shore.offsetAt(s) + out);
        const { ground, offshore } = geology.sample(x, z);
        if (offshore < rule.offshore.min || offshore > rule.offshore.max) continue;
        // A rock is a rock only if it stands proud of the bed: a reef
        // whose top is under the sand is nothing the hull can meet.
        if (top < ground + R.solids.proud) continue;
        if (!keepOut(x, z, r)) continue;
        if (!apart(solids, x, z, r)) continue;
        placed++;
        solids.push({ id: `${KIND_PREFIX[kind]}${placed}`, kind, x, z, r, top });
        break;
      }
    }
  }
  return solids;
}

function apart(solids: readonly Solid[], x: number, z: number, r: number): boolean {
  for (const other of solids) {
    const need = other.r + r + R.solids.spacing;
    if (Math.hypot(other.x - x, other.z - z) < need) return false;
  }
  return true;
}
