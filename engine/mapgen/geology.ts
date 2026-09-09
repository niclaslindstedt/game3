// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R2, R3, R17, R21 — THE GROUND, and the rocks standing on it.
//
// A Baltic taiga coast is one rock, planed by the ice: the ground is a
// single smooth function of HOW FAR FROM THE SHORE a point is and of WHAT
// KIND OF SHORE it is (R21's ruggedness, read off the shore's own s), with
// the grain of the country laid on top. Everything here is analytic — a
// function of (x, z) through the shore's signed distance — so the search
// can ask about any point before there is a grid, and the compiler can
// bake the same answer into one afterwards.
//
//   SEAWARD (R3): the bed falls from the waterline on a profile that is
//   steep at first and levels at `sea.depth` by `sea.reach` — the concave
//   slope of a drowned slab. Over the first `sea.shelf.reach` metres that
//   profile is scaled shallower where the sediment collects and blended
//   back past it, and two things put sediment there: a BAY, and a SOFT
//   stretch of coast (R21), whichever fills the shelf further. That second
//   one is what a beach stands on — a sand beach with a drowned slab in
//   front of it is a beach that starts in ten metres of water. A grain of
//   detail rides on the profile, faded out over the shallows so the
//   waterline is exactly where the shore says.
//
//   LANDWARD (R2, R21): the ground rises on a smooth step from zero at the
//   waterline to the HILL this stretch of coast carries by `land.reach`,
//   and past the reach it stands at that height and stops climbing. The
//   hill is the level's own drawn height taken times `land.hill` by the
//   ruggedness, so a headland is a bare rock hill and a bay lies low behind
//   its beach — and the two are a couple of hundred metres apart, which is
//   what makes a level a stretch of coast rather than one ramp. The SLABS —
//   rounded whalebacks of bedrock, deeper on a rugged stretch — ride on the
//   step, faded out at the waterline (so the zero contour holds) and at the
//   reach (so the hilltop is flat), and their amplitude keeps the whole
//   under `land.maxHeight`.
//
//   THE ROCKS (R17): skerries, boulders, reefs and the erratics on the
//   shore itself are placed after the course is laid, each kind at its
//   density inside its offshore band, kept off the course by the keep-out
//   the course hands over, and kept apart from each other. A rock that
//   finds no legal spot in its tries is simply not placed: the coast is a
//   little emptier there, which is what a coast is allowed to be.

import { clamp, lerp } from "../lib/math.ts";
import { smooth, valueNoise } from "../lib/noise.ts";
import type { Rng } from "../lib/prng.ts";
import type { Biome } from "./biomes.ts";
import { LEVEL_RULES as R, inBand, solidRule } from "./rules.ts";
import type { Shore } from "./shore.ts";
import type { Solid } from "./types.ts";

export type Geology = {
  /** The height the land climbs to before the coast's character has its
   * say, m above sea level (R2). */
  readonly plateau: number;
  /** R2, R21 — the height the land climbs to on a stretch of this
   * ruggedness, m above sea level. */
  hillAt(rugged: number): number;
  /** Noise seed the surface classifier keys the boulder field on (R16). */
  readonly boulderSeed: number;
  /** Ground height at a plan point, m against sea level. */
  groundAt(x: number, z: number): number;
  /** Ground and offshore distance at once — one shore lookup, which is
   * what the compiler and the search both want. */
  sample(x: number, z: number): { ground: number; offshore: number };
};

/** R3 — the open coast's bed profile: depth (positive) at `offshore` m.
 * The concave shelf to `sea.depth` at `sea.reach`, then on down to
 * `sea.openDepth` by `sea.openReach` — the open sea, where a swell has
 * water enough to stand its whole height. */
export function bedDepth(offshore: number): number {
  const t = clamp(offshore / R.sea.reach, 0, 1);
  const shelf = R.sea.depth * (1 - (1 - t) * (1 - t));
  if (offshore <= R.sea.reach) return shelf;
  const out = clamp((offshore - R.sea.reach) / (R.sea.openReach - R.sea.reach), 0, 1);
  return R.sea.depth + (R.sea.openDepth - R.sea.depth) * smooth(out);
}

/** R3, R21 — the shelf: the bed's depth multiplier at `offshore` m out
 * from a shore that has receded `bay` m and stands at `rugged`. 1 on a bare
 * headland and past the shelf's blend; `sea.shelf.factor` where the
 * sediment is deepest — the head of a full bay, or the sandy foreshore of a
 * soft stretch, whichever fills it further. */
export function shelfFactor(bay: number, rugged: number, offshore: number): number {
  const fromBay = clamp(bay / R.sea.shelf.bay, 0, 1);
  const fromSand = clamp(1 - rugged / R.sea.shelf.rugged, 0, 1);
  const fullness = Math.max(fromBay, fromSand);
  const shallow = 1 - (1 - R.sea.shelf.factor) * fullness;
  const out = clamp((offshore - R.sea.shelf.reach) / R.sea.shelf.blend, 0, 1);
  return shallow + (1 - shallow) * smooth(out);
}

/** R2 — the land's step: height at `inland` m from the waterline, climbing
 * to `hill` and stopping there. */
export function landHeight(inland: number, hill: number): number {
  return hill * smooth(clamp(inland / R.land.reach, 0, 1));
}

export function createGeology(rng: Rng, biome: Biome, shore: Shore): Geology {
  const plateau = inBand(rng, R.land.plateau) * biome.relief;
  // R2's ceiling, held once here rather than trusted to the bands: the
  // tallest hill the character can raise plus the deepest slab that can
  // ride on it stays under the rule's maximum, so nothing downstream has to
  // clamp again.
  const roof = R.land.maxHeight - R.land.slab.amplitude * R.land.slab.relief.high;
  const hillAt = (rugged: number): number =>
    Math.min(plateau * lerp(R.land.hill.low, R.land.hill.high, rugged), roof);
  const slabSeed = rng.int(1, 0x7fffffff);
  const bedSeed = rng.int(1, 0x7fffffff);
  const boulderSeed = rng.int(1, 0x7fffffff);

  // Past this the shelf's blend is complete and the bed is the open
  // coast's whatever the shore is like there — so the character, which
  // costs two noise lookups, is never asked for out here. Most of a
  // level's cells are open sea, and this is the bake's inner loop.
  const shelfEnd = R.sea.shelf.reach + R.sea.shelf.blend;
  const sample = (x: number, z: number): { ground: number; offshore: number } => {
    const offshore = shore.distanceAt(x, z);
    if (offshore >= shelfEnd) {
      const grain = (valueNoise(x, z, R.sea.detail.scale, bedSeed) - 0.5) * 2;
      return { ground: -bedDepth(offshore) + grain * R.sea.detail.amplitude, offshore };
    }
    const { s } = shore.toLocal(x, z);
    const rugged = shore.ruggedAt(s);
    if (offshore >= 0) {
      const bed = -bedDepth(offshore) * shelfFactor(shore.bayAt(s), rugged, offshore);
      const grain = (valueNoise(x, z, R.sea.detail.scale, bedSeed) - 0.5) * 2;
      const fade = Math.min(1, offshore / R.sea.detail.fade);
      return { ground: bed + grain * R.sea.detail.amplitude * fade, offshore };
    }
    const inland = -offshore;
    const step = landHeight(inland, hillAt(rugged));
    // The slabs fade in from the waterline and out at the reach: the
    // window is what keeps the hilltop flat and the shoreline where the
    // polyline put it.
    const window =
      Math.min(1, inland / R.land.slab.fade) * (1 - smooth(clamp(inland / R.land.reach, 0, 1)));
    const slab = (valueNoise(x, z, R.land.slab.scale, slabSeed) - 0.5) * 2;
    const relief = lerp(R.land.slab.relief.low, R.land.slab.relief.high, rugged);
    return { ground: step + slab * R.land.slab.amplitude * relief * window, offshore };
  };

  return {
    plateau,
    hillAt,
    boulderSeed,
    groundAt: (x, z) => sample(x, z).ground,
    sample,
  };
}

/** Whether a rock of radius `r` may stand at (x, z): the course's answer,
 * handed to the placer so the geology never learns what a gate is. */
export type KeepOut = (x: number, z: number, r: number) => boolean;

type SolidKind = Solid["kind"];

const KIND_PREFIX: Record<SolidKind, string> = {
  skerry: "K",
  boulder: "B",
  reef: "F",
  erratic: "E",
  stack: "S",
};

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
  // Biggest first: a stack is a landmark and wants the open water, and
  // `apart` gives whatever is placed first its pick of the coast.
  const kinds: SolidKind[] = ["stack", "skerry", "boulder", "reef", "erratic"];
  for (const kind of kinds) {
    const rule = solidRule(kind);
    const count = Math.round(rule.perKm * biome.rocks[kind] * km * rng.range(0.8, 1.2));
    let placed = 0;
    for (let n = 0; n < count; n++) {
      for (let attempt = 0; attempt < R.solids.tries; attempt++) {
        const s = rng.range(sFrom, sTo);
        const out = inBand(rng, rule.offshore);
        const r = inBand(rng, rule.r);
        // One draw whichever way the kind states its size, so the stream
        // reads the same for every kind (R17).
        const size = inBand(rng, rule.height ?? rule.top ?? { min: 0, max: 0 });
        // Pushed out along the base line's normal, then held to the TRUE
        // distance: on a sloping stretch of shore the two differ, and the
        // band is a promise about the second.
        const { x, z } = shore.toWorld(s, shore.offsetAt(s) + out);
        const { ground, offshore } = geology.sample(x, z);
        if (offshore < rule.offshore.min || offshore > rule.offshore.max) continue;
        // A block on the shore stands on the GROUND it was dropped on; a
        // rock in the water stands at its own height against the SEA.
        const top = rule.height ? ground + size : size;
        // A rock is a rock only if it stands proud of the bed: a reef
        // whose top is under the sand is nothing the hull can meet.
        if (top < ground + R.solids.proud) continue;
        // …and a block on the SHORE has to break the surface. One whose
        // top is under the water is a reef, and there is a kind for that.
        if (rule.height && top < R.solids.proud) continue;
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
