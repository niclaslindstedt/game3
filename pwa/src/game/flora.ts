// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SHORE, PLANTED — the cover as three.js sees it: one instanced mesh a
// species, holding only the plants the lens can see this frame, standing
// where `flora-plan.ts` put them.
//
// The split is the app's usual one. `flora-defs.ts` says what a species is
// and where it grows, `flora-plan.ts` works out where every plant stands
// with no renderer in sight, `flora-shapes.ts` builds the one geometry a
// species is drawn from, and this file is the wiring: the meshes, the
// per-instance matrix and tint, the DETAIL row's thinning, the DISTANCE
// row's reach, and the cull.
//
// WHY A CULL, AND WHY THIS SHAPE OF ONE. A coast plants some thirty thousand
// plants over a couple of kilometres of shore, a million and more triangles,
// and a lens sees a few hundred metres of it — the rest is behind the
// camera, off to the side, or so far along the coast it is a pixel. One
// mesh a species spanning the whole coast has no box a frustum test can
// refuse, so every triangle of it was submitted every frame whatever the
// camera looked at, and on a phone that vertex bill was most of the frame.
// A mesh a species per SQUARE of shore would cull, but at thirteen species
// over a coast's hundred squares it is hundreds of draw calls, which is the
// same bill moved from the GPU to the JavaScript that submits them.
//
// So the plants are laid out in TILES inside each species' one instance
// buffer — a tile is a contiguous run of matrices, with a bounding sphere —
// and each frame the tiles the frustum and the reach admit are copied to the
// front of the buffer and the mesh draws that many. Thirteen draw calls as
// before, the triangles of a dozen tiles rather than a hundred, and the copy
// only happens on a frame the set of visible tiles CHANGED, which while
// riding is a few times a second and while standing is never.
//
// AND THE REACH IS PER SPECIES, which is the other half of the saving and the
// bigger one. `DISTANCE_LOOK.cover` is where the fog has closed and so is a
// ceiling for everything; but a 19 m spruce and a 40 cm heather mat stop
// being visible at wildly different ranges, and drawing both out to the fog
// spent a third of the cover's triangles on stems nobody could resolve.
// `coverReach` (`settings-video.ts`) turns a species' own height into the
// range at which it falls under the pixel line, and each stand is culled on
// the smaller of that and the row's. The trees keep the whole of the row; the
// grass, the heather and the shingle stop within a hundred metres.
//
// The TILE follows the reach for the same reason. A tile is kept while any
// part of it reaches inside the radius, so a 128 m square blunts a 40 m reach
// into a 110 m one — the bucket has to shrink with the species or the reach
// buys much less than it says. Each row is bucketed at half its own reach
// instead, floored so a mat is not a thousand tiles and capped at
// `FLORA_TILE` so a wood is not a hundred.
//
// AND THE WATER'S MIRROR GETS ITS OWN, SHORTER REACH. The reflection pass
// draws the whole shore a SECOND time, so on a frame with the mirror live the
// cover is paid for twice — but the mirror draws into a texture a fraction of
// the frame's pixels a side (`REFLECTION_LOOK.scale`), and a plant standing
// that share of its screen height is under the same pixel line at that share
// of the range. So a stand is worth reflecting out to `reach · share` and no
// further: the shore in the water is the NEAR shore, which is the only part
// of it a grazing angle leaves room for anyway.
//
// Both passes read ONE instance buffer, so the mirror cannot be handed a
// different set — but it can be handed a PREFIX of the same one. The relay
// lays the tiles the mirror wants first and the rest after, and `drawFor`
// moves `count` between the two totals: the mirror pass draws the near half,
// the picture draws the lot, and nothing is uploaded in between.

import * as THREE from "three";
import { type Level } from "@engine";

import { FLORA } from "./flora-defs.ts";
import { planFlora, type FloraSpot } from "./flora-plan.ts";
import { buildFlora, floraMaterial } from "./flora-shapes.ts";
import { coverReach, FLORA_SCALE } from "./settings-video.ts";

/** The COARSEST tile edge, m, and what anything the row draws to the fog is
 * bucketed at. Big enough that a coast is a manageable number of them, small
 * enough that the cull is worth something: at this size the cover a chase
 * camera actually sees is a dozen tiles or so out of a coast's hundred and
 * more. */
export const FLORA_TILE = 128;

/** …and the finest, m. Under this a species' tiles outnumber its plants and
 * the per-frame walk costs more than the triangles it saves. */
const FLORA_TILE_MIN = 32;

/** The square one species is bucketed into, m: half its own reach, so a tile
 * kept for grazing the radius carries nothing much more than half as far
 * again past it. */
export function floraTile(reach: number): number {
  return Math.round(Math.min(FLORA_TILE, Math.max(FLORA_TILE_MIN, reach / 2)));
}

const m = new THREE.Matrix4();
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const scale = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

/** Bucket a species' plants into squares of `tile` metres, keeping the
 * roster's order inside each square. Pure, so the root suite can hold it to
 * covering every plant exactly once. */
export function tileSpots(spots: readonly FloraSpot[], tile: number): FloraSpot[][] {
  const buckets = new Map<string, FloraSpot[]>();
  for (const p of spots) {
    const key = `${Math.floor(p.x / tile)}:${Math.floor(p.z / tile)}`;
    let list = buckets.get(key);
    if (!list) {
      list = [];
      buckets.set(key, list);
    }
    list.push(p);
  }
  return [...buckets.values()];
}

/** One square of one species: where its run starts in the species' laid-out
 * buffers, how many stand in it, the sphere that holds them all with their
 * crowns, and each plant's place on the species' whole roster. */
type Tile = {
  start: number;
  planted: number;
  /** How many of the run are drawn under the DETAIL row's line. */
  kept: number;
  /** Ascending — `tileSpots` keeps the roster's order, so the plants under
   * the line are the first `kept` of the run. */
  order: number[];
  sphere: THREE.Sphere;
  visible: boolean;
  /** …and close enough to be worth drawing into the water as well. Always
   * false when it is not visible at all. */
  mirrored: boolean;
};

type Stand = {
  mesh: THREE.InstancedMesh;
  /** Every plant's matrix and tint, tile by tile. */
  matrices: Float32Array;
  tints: Float32Array;
  tiles: Tile[];
  total: number;
  /** Where this species falls under the pixel line, m — the DISTANCE row's
   * `cover` caps it, it never extends it. */
  reach: number;
  /** How many of the laid-out instances the mirror pass draws — the prefix
   * `relay` put the reflected tiles in — and how many the picture draws. */
  inWater: number;
  drawn: number;
};

/** The water's mirror, as the cull sees it: where the mirrored lens looks,
 * and the share of the frame's pixels a side it draws at — which is the share
 * of the real reach a stand has to stand inside to be worth reflecting. */
export type CoverMirror = {
  frustum: THREE.Frustum;
  share: number;
};

export type Flora = {
  group: THREE.Group;
  /** How much of the cover is drawn, as a share of the design density —
   * the DETAIL row's `FLORA_SCALE`. Applies on the next frame. */
  setDensity: (share: number) => void;
  /** Where the lens stands and what it sees this frame, and the furthest any
   * cover is drawn at all, m — the DISTANCE row's `cover`, which caps every
   * species' own reach. Every tile the frustum refuses, or that stands further
   * off than its species is worth drawing, is left out of the draw. Applies on
   * this frame. */
  update: (
    frustum: THREE.Frustum,
    eyeX: number,
    eyeZ: number,
    cover: number,
    mirror?: CoverMirror,
  ) => void;
  /** Which of the two passes is about to be drawn. The mirror gets the prefix
   * of the laid-out instances `update` admitted to it; the picture gets all of
   * them. Costs one `count` assignment a species and uploads nothing, so it is
   * called either side of the reflection pass every frame. */
  drawFor: (surface: "mirror" | "frame") => void;
  dispose: () => void;
};

export function createFlora(level: Level): Flora {
  const group = new THREE.Group();
  const spots = planFlora(level, FLORA_SCALE.lush);
  const material = floraMaterial();
  const stands: Stand[] = [];
  let dirty = true;

  FLORA.forEach((spec, s) => {
    // Seeded off the species' PLACE in the roster, so a row's shape does
    // not change because another row was added above it.
    const geometry = buildFlora(spec.look, s * 7919 + 13);
    geometry.computeBoundingSphere();
    // The geometry stands at unit height and is scaled by each plant's own,
    // so how far it reaches from its foot scales with it: the sphere's own
    // radius plus its centre's offset, which for a tree is most of a crown.
    const sphere = geometry.boundingSphere;
    const crown = sphere ? sphere.center.length() + sphere.radius : 1;
    // How far this species is worth drawing, and the square it is bucketed
    // into to deliver that — both off the tallest plant the builder can make
    // of it, so a stand is never culled on the average of its own band.
    const reach = coverReach(spec.look.height.max);
    const roster = spots[s];
    const total = roster.length;
    const place = new Map(roster.map((p, i) => [p, i]));
    const matrices = new Float32Array(Math.max(1, total) * 16);
    const tints = new Float32Array(Math.max(1, total) * 3);
    const tiles: Tile[] = [];
    let at = 0;
    for (const list of tileSpots(roster, floraTile(reach))) {
      let cx = 0;
      let cy = 0;
      let cz = 0;
      list.forEach((p, i) => {
        quat.setFromAxisAngle(up, p.yaw);
        // A stone is buried to its waist so it sits IN the shore rather than
        // balancing on it; everything else stands on the ground it grew from.
        const foot = spec.look.form === "stone" ? p.y - p.h * 0.42 : p.y;
        m.compose(pos.set(p.x, foot, p.z), quat, scale.set(p.h, p.h, p.h));
        m.toArray(matrices, (at + i) * 16);
        // A little light and dark between one plant and the next, so a stand
        // is a stand rather than one plant stamped a thousand times. The
        // instance colour MULTIPLIES the geometry's own, so it is a grey
        // either side of one rather than a colour of its own.
        tints.fill(1 + p.tint * 0.24, (at + i) * 3, (at + i) * 3 + 3);
        cx += p.x;
        cy += foot;
        cz += p.z;
      });
      cx /= list.length;
      cy /= list.length;
      cz /= list.length;
      // The sphere the cull tests: round the tile's own centre, out to the
      // furthest plant plus its crown.
      let radius = 0;
      for (const p of list) {
        radius = Math.max(radius, Math.hypot(p.x - cx, p.y - cy, p.z - cz) + p.h * crown);
      }
      tiles.push({
        start: at,
        planted: list.length,
        kept: list.length,
        order: list.map((p) => place.get(p) ?? 0),
        sphere: new THREE.Sphere(new THREE.Vector3(cx, cy, cz), radius),
        visible: false,
        mirrored: false,
      });
      at += list.length;
    }
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, total));
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(Math.max(1, total) * 3),
      3,
    ).setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    // The cull is this module's own, tile by tile; a sphere round the whole
    // coast would refuse nothing.
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    stands.push({ mesh, matrices, tints, tiles, total, reach, inWater: 0, drawn: 0 });
  });

  /** Lay the visible tiles' plants at the front of each species' buffers,
   * the ones the water mirrors first, and record where the two totals fall. */
  const relay = (): void => {
    for (const stand of stands) {
      const matrix = stand.mesh.instanceMatrix;
      const colour = stand.mesh.instanceColor as THREE.InstancedBufferAttribute;
      let n = 0;
      // Two sweeps rather than a sort: the mirror's tiles are a subset of the
      // visible ones, so laying that subset down and then the remainder puts
      // the reflection's share in one run at the front.
      for (const pass of [true, false]) {
        for (const t of stand.tiles) {
          if (!t.visible || t.kept === 0 || t.mirrored !== pass) continue;
          matrix.array.set(stand.matrices.subarray(t.start * 16, (t.start + t.kept) * 16), n * 16);
          colour.array.set(stand.tints.subarray(t.start * 3, (t.start + t.kept) * 3), n * 3);
          n += t.kept;
        }
        if (pass) stand.inWater = n;
      }
      stand.drawn = n;
      stand.mesh.count = n;
      // Only the prefix in use goes to the GPU, not the whole coast's worth.
      matrix.clearUpdateRanges();
      matrix.addUpdateRange(0, n * 16);
      matrix.needsUpdate = true;
      colour.clearUpdateRanges();
      colour.addUpdateRange(0, n * 3);
      colour.needsUpdate = true;
    }
    dirty = false;
  };

  return {
    group,
    setDensity: (share) => {
      const of = share / FLORA_SCALE.lush;
      // The first `kept` of a species' roster are drawn, whichever tiles
      // they stand in — the roster is shuffled by construction, so that is a
      // thinning spread evenly along the coast.
      for (const stand of stands) {
        const line = Math.round(stand.total * of);
        for (const t of stand.tiles) {
          let n = 0;
          while (n < t.order.length && t.order[n] < line) n++;
          t.kept = n;
        }
      }
      dirty = true;
    },
    update: (frustum, eyeX, eyeZ, cover, mirror) => {
      for (const stand of stands) {
        // The row's ceiling or the species' own line, whichever comes first.
        const reach = Math.min(cover, stand.reach);
        const mirrored = mirror ? reach * mirror.share : 0;
        for (const t of stand.tiles) {
          const c = t.sphere.center;
          // In the frame, or in the water: a stand the mirrored lens can see
          // is drawn into the reflection whether or not the real one can — but
          // only out to the mirror's own shorter reach.
          const near = Math.hypot(c.x - eyeX, c.z - eyeZ) - t.sphere.radius;
          const inWater =
            mirror !== undefined && near <= mirrored && mirror.frustum.intersectsSphere(t.sphere);
          const visible = inWater || (near <= reach && frustum.intersectsSphere(t.sphere));
          if (visible !== t.visible || inWater !== t.mirrored) {
            t.visible = visible;
            t.mirrored = inWater;
            dirty = true;
          }
        }
      }
      if (dirty) relay();
    },
    drawFor: (surface) => {
      for (const stand of stands) {
        stand.mesh.count = surface === "mirror" ? stand.inWater : stand.drawn;
      }
    },
    dispose: () => {
      for (const stand of stands) stand.mesh.geometry.dispose();
      material.dispose();
    },
  };
}
