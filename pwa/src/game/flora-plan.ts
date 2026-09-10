// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE EVERY PLANT STANDS — the roster in `flora-defs.ts` laid over the
// level's own ground, as plain numbers. `flora.ts` turns what comes back
// into instanced meshes; nothing here has heard of three.js, which is the
// same DOM-free-payload split every card and every HUD readout in this app
// is built on and is what lets `tests/flora_test.ts` hold the habitats.
//
// SCATTERED ALONG THE WATER'S EDGE, not over the box. `level.shore` is the
// water's edge traced out of the offshore field — the mainland, every
// island, AND both banks of the river, because the river is stamped into
// that same field (R26) — so walking those polylines by arc length and
// throwing candidates within `REACH` of each station spends the whole
// budget on the strip a rider can actually see, and populates the river for
// free. A uniform scatter over the bounds would spend most of it on open
// sea and the back country.
//
// WHAT MAKES IT A DELTA. Three things in the habitat rows, and not one of
// them is a special case in this file: the riparian species take a bigger
// share within `riverside.within` of the river's line, the reed needs a
// `shelter` ring that only a cove or a river mouth gives it, and the patchy
// species come in patches. Put together, a mouth grows a wall of reed with
// alder and sallow behind it and the open coast does not.
//
// NONE OF IT IS A SOLID. The hull rides through a reed bed and over a
// heather mat, nothing in the engine knows any of this exists, and no
// vertex is ever moved — a painter that lifted the ground would have
// invented a rock the physics never heard of. It is drawn deterministically
// off the level's seed on its OWN generator (§25.2: the renderer never
// draws on the simulation's randomness), so a seed plants the same shore
// every time without costing the run a single number.

import { createRng, fieldGradient, sampleField, valueNoise, type Level, type Vec2 } from "@engine";

import { FLORA, SHELTER_RING, type FloraSpec } from "./flora-defs.ts";

/** How many candidates a kilometre of water's edge is thrown at the DESIGN
 * density, and how far from the edge they land, m. The reach is a little
 * past where the forest floor is painted (`terrain.ts`) and well inside
 * what the fog leaves visible, so the wood has a back to it. */
const PER_KM = 4200;
const REACH = 155;
/** How finely the shore polylines are walked for stations to throw from,
 * m. Closer than `REACH`, so the discs overlap into an even band. */
const STATION = 9;

/** How far off the river's line still counts as its bank, for the bounding
 * box the distance test skips on. Wider than any row's `riverside.within`,
 * or the box would decide the question the rows are asking. */
const RIVER_PAD = 200;

/** One plant, placed. `h` is the height it was drawn at from its row's own
 * band; `yaw` and `tint` are what keep a stand from being one plant stamped
 * a thousand times. */
export type FloraSpot = {
  readonly x: number;
  readonly z: number;
  /** The ground under it — its foot, not its top. */
  readonly y: number;
  readonly h: number;
  readonly yaw: number;
  /** −0.5..0.5: how much lighter or darker than its species this one is. */
  readonly tint: number;
};

/** Stations every `STATION` metres along every coastline, which is where
 * the cover is thrown from. */
function stationsOf(shore: readonly (readonly Vec2[])[]): Vec2[] {
  const out: Vec2[] = [];
  for (const line of shore) {
    let carried = 0;
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i];
      const b = line[i + 1];
      const seg = Math.hypot(b.x - a.x, b.z - a.z);
      if (seg < 1e-6) continue;
      for (let s = STATION - carried; s < seg; s += STATION) {
        const t = s / seg;
        out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
      }
      carried = (carried + seg) % STATION;
    }
  }
  return out;
}

type Box = { minX: number; maxX: number; minZ: number; maxZ: number };

function riverBox(river: readonly Vec2[]): Box | null {
  if (river.length === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of river) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  return {
    minX: minX - RIVER_PAD,
    maxX: maxX + RIVER_PAD,
    minZ: minZ - RIVER_PAD,
    maxZ: maxZ + RIVER_PAD,
  };
}

/** How far a point is from the river's line, m — the one measure the whole
 * riverbank community is picked by. Brute force over the polyline behind a
 * bounding-box reject, which is what the engine's own `riverDistance` does:
 * a river is a couple of hundred points and this is asked once per
 * candidate at load. */
function riverDistanceOf(river: readonly Vec2[], box: Box | null, x: number, z: number): number {
  if (!box || x < box.minX || x > box.maxX || z < box.minZ || z > box.maxZ) return Infinity;
  let best = Infinity;
  for (const p of river) {
    const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

/** What share of a ring at `SHELTER_RING` metres stands out of the water —
 * how enclosed a piece of water is, cheaply. A cove and a river mouth score
 * high, an open beach scores nearly nothing, and that one number is the
 * difference between a reed bed that would survive and one the sea would
 * take out over a winter. */
function shelterAt(level: Level, x: number, z: number): number {
  let land = 0;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    if (
      sampleField(level.ground, x + Math.sin(a) * SHELTER_RING, z + Math.cos(a) * SHELTER_RING) > 0
    ) {
      land++;
    }
  }
  return land / 6;
}

/** The ground as one candidate point sees it — sampled ONCE and offered to
 * every species, because the fields are the expensive part and the habitat
 * test is arithmetic. */
export type Ground = {
  x: number;
  z: number;
  y: number;
  inland: number;
  surface: ReturnType<Level["materialAt"]>;
  slope: number;
  river: number;
  shelter: number;
};

/** The share a species takes at a point, or 0 where it will not grow —
 * every habitat rule, in one place, for the placer and the tests alike. */
export function shareAt(spec: FloraSpec, g: Ground, seed: number): number {
  const hab = spec.habitat;
  if (g.y < hab.ground.min || g.y > hab.ground.max) return 0;
  if (g.inland < hab.inland.min || g.inland > hab.inland.max) return 0;
  if (g.slope > hab.slope) return 0;
  if (hab.surfaces.length > 0 && !hab.surfaces.includes(g.surface)) return 0;
  const bank = hab.riverside !== undefined && g.river <= hab.riverside.within;
  // The shelter a bank gives is the river's own: a reed bed in a channel
  // ten metres across is as sheltered as water gets, whatever a ring drawn
  // at forty-five metres finds around it.
  if (hab.shelter !== undefined && !bank && g.shelter < hab.shelter) return 0;
  if (hab.patch && valueNoise(g.x, g.z, hab.patch.scale, seed) < hab.patch.over) return 0;
  return bank && hab.riverside ? hab.riverside.share : hab.share;
}

/** Read the ground at one point into `g`, so the caller owns the
 * allocation. `shelter` is left alone: only two rows ask for it and the
 * ring is six more field samples. */
export function groundAt(level: Level, x: number, z: number, box: Box | null, g: Ground): void {
  g.x = x;
  g.z = z;
  g.y = sampleField(level.ground, x, z);
  g.inland = -sampleField(level.offshore, x, z);
  g.surface = level.materialAt(x, z);
  const grad = fieldGradient(level.ground, x, z);
  g.slope = Math.hypot(grad.gx, grad.gz);
  g.river = riverDistanceOf(level.river, box, x, z);
  g.shelter = 0;
}

/**
 * Plant the whole shore: one array of spots per row of `FLORA`, in that
 * order.
 *
 * `scale` is how thick the stand is against the design density. It is
 * planted ONCE at the thickest the DETAIL row can ask for and thinned by
 * instance count downstream, so moving the row shows on the next frame
 * instead of on the next shore — and because the draws are sequential, a
 * thinner row is the same shore with its last plants left out rather than
 * a different one.
 */
export function planFlora(level: Level, scale: number): FloraSpot[][] {
  const rng = createRng(level.seed ^ 0x5eed);
  const stations = stationsOf(level.shore);
  const box = riverBox(level.river);
  const spots: FloraSpot[][] = FLORA.map(() => []);
  if (stations.length === 0) return spots;
  const shares = new Float64Array(FLORA.length);
  const g: Ground = {
    x: 0,
    z: 0,
    y: 0,
    inland: 0,
    surface: "water",
    slope: 0,
    river: Infinity,
    shelter: 0,
  };
  const tries = Math.round(((stations.length * STATION) / 1000) * PER_KM * scale);
  const b = level.bounds;
  for (let i = 0; i < tries; i++) {
    const at = stations[rng.int(0, stations.length - 1)];
    // Biased toward the water's edge rather than spread over the disc: the
    // waterline is where the ladder of species is, and it is what the rider
    // is looking at.
    const d = Math.pow(rng.next(), 0.75) * REACH;
    const a = rng.range(0, Math.PI * 2);
    const x = at.x + Math.sin(a) * d;
    const z = at.z + Math.cos(a) * d;
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
    groundAt(level, x, z, box, g);
    // Only the species that ask about shelter pay for the ring, and only
    // the first of them pays.
    let measured = false;
    let total = 0;
    for (let s = 0; s < FLORA.length; s++) {
      if (FLORA[s].habitat.shelter !== undefined && !measured) {
        g.shelter = shelterAt(level, x, z);
        measured = true;
      }
      const share = shareAt(FLORA[s], g, level.seed);
      shares[s] = share;
      total += share;
    }
    if (total <= 0) continue;
    // ONE SPECIES PER POINT, weighted: what grows here is what the ground
    // offers, and a slab that suits pine, juniper and ling grows a mix of
    // the three rather than one of each stacked in the same metre.
    let pick = rng.range(0, total);
    let chosen = 0;
    for (let s = 0; s < FLORA.length; s++) {
      pick -= shares[s];
      if (pick <= 0) {
        chosen = s;
        break;
      }
    }
    const look = FLORA[chosen].look;
    spots[chosen].push({
      x,
      z,
      y: g.y,
      h: rng.range(look.height.min, look.height.max),
      yaw: rng.range(0, Math.PI * 2),
      tint: rng.range(-0.5, 0.5),
    });
  }
  return spots;
}
