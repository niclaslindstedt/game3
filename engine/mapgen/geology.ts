// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R2, R3, R17, R21 — THE GROUND, and the rocks standing on it.
//
// A Baltic taiga coast is one rock, planed by the ice: the ground is a
// single smooth function of HOW FAR FROM THE WATER'S EDGE a point is — the
// basin's own signed field (R15) — and of WHAT KIND OF COAST it is (R21's
// ruggedness), with the grain of the country laid on top.
//
// It takes the offshore distance as an ARGUMENT rather than working it out.
// The basin bakes that field once for the whole level, and a coast that
// doubles back on itself and carries islands has no frame to re-derive it
// from: there is no "along the shore" any more, only how far the water's
// edge is.
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
import type { Basin } from "./basin.ts";
import type { Biome } from "./biomes.ts";
import { LEVEL_RULES as R, inBand, solidRule, withinBand } from "./rules.ts";
import type { Bounds, ScatteredKind, Solid, TrackKind } from "./types.ts";

export type Geology = {
  /** The height the land climbs to before the coast's character has its
   * say, m above sea level (R2). */
  readonly plateau: number;
  /** R2, R21 — the height the land climbs to on a stretch of this
   * ruggedness, m above sea level. */
  hillAt(rugged: number): number;
  /** Noise seed the surface classifier keys the boulder field on (R16). */
  readonly boulderSeed: number;
  /** R21 — how RUGGED the coast is at a plan point, 0..1: 0 a soft shore
   * behind a beach, 1 bare rock standing in the open sea. */
  ruggedAt(x: number, z: number): number;
  /** Ground height at a plan point whose distance from the water's edge is
   * already known, m against sea level. */
  groundAt(x: number, z: number, offshore: number): number;
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

/** R3, R21 — the shelf: the bed's depth multiplier `offshore` m out from a
 * coast standing at `rugged`. 1 on bare rock and past the shelf's blend;
 * `sea.shelf.factor` where the sediment is deepest, which is the sandy
 * foreshore of a soft stretch. A narrow channel needs no term of its own —
 * every point in one is close to the edge, and the profile is already
 * shallow that near it. */
export function shelfFactor(rugged: number, offshore: number): number {
  const fullness = clamp(1 - rugged / R.sea.shelf.rugged, 0, 1);
  const shallow = 1 - (1 - R.sea.shelf.factor) * fullness;
  const out = clamp((offshore - R.sea.shelf.reach) / R.sea.shelf.blend, 0, 1);
  return shallow + (1 - shallow) * smooth(out);
}

/** R2 — the land's step: height at `inland` m from the waterline, climbing
 * to `hill` and stopping there. */
export function landHeight(inland: number, hill: number): number {
  return hill * smooth(clamp(inland / R.land.reach, 0, 1));
}

export function createGeology(rng: Rng, biome: Biome, basin: Basin): Geology {
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
  const characterSeed = rng.int(1, 0x7fffffff);
  const detailSeed = rng.int(1, 0x7fffffff);

  // R21 — the coast's CHARACTER, now a field over the plan rather than a
  // function of a base line: with islands and inlets there is no line to be
  // a function of. Two octaves of noise so a level carries places a few
  // hundred metres across and coves inside them…
  const K = R.shore.character;
  const sx = Math.sin(basin.seaHeading);
  const sz = Math.cos(basin.seaHeading);
  const ruggedAt = (x: number, z: number): number => {
    const broad = (valueNoise(x, z, K.scale, characterSeed) - 0.5) * 2;
    const fine = (valueNoise(x, z, K.detail.scale, detailSeed) - 0.5) * 2;
    const grain = broad * (1 - K.detail.share) + fine * K.detail.share;
    // …and a SHELTER term with a physical meaning the old bay-versus-
    // headland one only stood in for: how far behind the open sea's own
    // edge the point lies. The coast that faces the fetch is stripped to
    // rock; the channels behind it are where the sand ends up. It only
    // TILTS the odds — a shelter strong enough to put the character under
    // the beach's threshold on its own would make every inland channel one
    // unbroken run of sand, which is the fault R21 exists to catch.
    const inland = clamp((basin.seaOffset - (x * sx + z * sz)) / K.swing, 0, 1);
    return clamp(K.bias + K.grain * grain - K.shelter * inland, 0, 1);
  };

  // Past this the shelf's blend is complete and the bed is the open
  // coast's whatever the shore is like there — so the character, which
  // costs two noise lookups, is never asked for out here. Most of a
  // level's cells are open sea, and this is the bake's inner loop.
  const shelfEnd = R.sea.shelf.reach + R.sea.shelf.blend;
  const groundAt = (x: number, z: number, offshore: number): number => {
    if (offshore >= shelfEnd) {
      const grain = (valueNoise(x, z, R.sea.detail.scale, bedSeed) - 0.5) * 2;
      return -bedDepth(offshore) + grain * R.sea.detail.amplitude;
    }
    const rugged = ruggedAt(x, z);
    if (offshore >= 0) {
      const bed = -bedDepth(offshore) * shelfFactor(rugged, offshore);
      const grain = (valueNoise(x, z, R.sea.detail.scale, bedSeed) - 0.5) * 2;
      const fade = Math.min(1, offshore / R.sea.detail.fade);
      return bed + grain * R.sea.detail.amplitude * fade;
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
    return step + slab * R.land.slab.amplitude * relief * window;
  };

  return { plateau, hillAt, boulderSeed, ruggedAt, groundAt };
}

/** Whether a rock of radius `r` may stand at (x, z): the course's answer,
 * handed to the placer so the geology never learns what a gate is. */
export type KeepOut = (x: number, z: number, r: number) => boolean;

/** R17 — the kinds the OPEN SEA makes, and so the ones whose band is read
 * against the sea's own edge as well as against the nearest water. The
 * STACK alone: the mark is the sea's too, but R25's line places it rather
 * than the density, so it never reaches this placer; and a low rock awash
 * in a channel is what an archipelago is made of, so the skerries, the
 * boulders and the reefs stay off the list on purpose. */
const SEA_MADE: readonly Solid["kind"][] = ["stack"];

const KIND_PREFIX: Record<ScatteredKind, string> = {
  skerry: "K",
  boulder: "B",
  reef: "F",
  erratic: "E",
  stack: "S",
};

/** R17 — lay the rocks over the basin: in the water at the offshore
 * distance their kind belongs at, off the course, apart from each other.
 * Deterministic in `rng`.
 *
 * Placed by REJECTION over the level's own box rather than pushed out from
 * a base line. There is no base line any more — the coast doubles back and
 * carries islands — and the offshore field the basin baked answers the only
 * question a kind's band actually asks, which is how far from the water's
 * edge a point stands. A rock that finds no legal spot in its tries is
 * simply not placed: the coast is a little emptier there, which is what a
 * coast is allowed to be.
 *
 * `seawardAt` is the second answer to that question, for the kinds the OPEN
 * SEA makes (R17): metres out past the sea's own straight edge (R15),
 * negative behind it. `offshoreAt` cannot stand in for it — it is the
 * distance from the nearest water's edge whatever made that water, so the
 * middle of a channel reads as open sea to it.
 */
export function laySolids(
  rng: Rng,
  biome: Biome,
  bounds: Bounds,
  offshoreAt: (x: number, z: number) => number,
  groundAt: (x: number, z: number, offshore: number) => number,
  km: number,
  keepOut: KeepOut,
  seawardAt: (x: number, z: number) => number,
  standing: readonly Solid[] = [],
  track: TrackKind = "coast",
): Solid[] {
  // R25, R31 — anything already standing (the mark a coast's ocean leg
  // rounds, or the marks a circuit's bends carry) is in the list before the
  // placer starts, so the density-placed rocks keep their spacing from them
  // as they do from each other.
  const solids: Solid[] = [...standing];
  // Biggest first: a stack is a landmark and wants the open water, and
  // `apart` gives whatever is placed first its pick of the basin.
  const kinds: ScatteredKind[] = ["stack", "skerry", "boulder", "reef", "erratic"];
  for (const kind of kinds) {
    const rule = solidRule(kind, track);
    const count = Math.round(rule.perKm * biome.rocks[kind] * km * rng.range(0.8, 1.2));
    let placed = 0;
    for (let n = 0; n < count; n++) {
      for (let attempt = 0; attempt < R.solids.tries; attempt++) {
        const x = rng.range(bounds.minX, bounds.maxX);
        const z = rng.range(bounds.minZ, bounds.maxZ);
        const r = inBand(rng, rule.r);
        // One draw whichever way the kind states its size, so the stream
        // reads the same for every kind (R17).
        const size = inBand(rng, rule.height ?? rule.top ?? { min: 0, max: 0 });
        const offshore = offshoreAt(x, z);
        if (offshore < rule.offshore.min || offshore > rule.offshore.max) continue;
        // R17 — and a SEA STACK has to be in the OPEN SEA, not merely far
        // from a bank. The band above is measured from the NEAREST water's
        // edge and cannot tell a channel's middle from the sea, so the
        // sea-made kinds are held to the same band against the sea's own
        // line as well. Both, rather than instead: the pair is "out in the
        // ocean AND in near the shore", which is where a stack belongs —
        // and it keeps the analysis, which can only read `offshore` off a
        // published level, from refusing a rock this placer laid.
        if (SEA_MADE.includes(kind) && !withinBand(seawardAt(x, z), rule.offshore)) continue;
        const ground = groundAt(x, z, offshore);
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
