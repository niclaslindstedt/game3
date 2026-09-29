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
//
// THE TREES ARE MODELS (`tree-models.ts`), unless the build says otherwise:
// a tree-form row with its model loaded is drawn in `TREE_SHAPES` of its six
// VARIANTS (which one stands where is `variantAt`, a hash of the trunk's
// place) and in TWO BANDS — the whole model out to `TREE_FULL` metres and a
// hand-built sketch beyond it — so a species is a mesh a variant a band
// rather than one mesh, and a tile carries one RUN of plants a variant. The band is decided a
// tile at a time off the same distance the reach is, so a tile is drawn in
// one band or the other and never both, and its tiles are cut finer
// (`TREE_TILE`) so the line between the two bands is not a hundred metres
// wide. AND SO IS THE UNDERGROWTH — every bush, tuft, reed and stone row in
// its four variants (`undergrowth-variants.ts`), all of them drawn to
// `UNDER_FULL` metres, and past it THE CODE'S OWN SHAPE as the far band: a
// bush's model is several times the code's triangles and a coast plants
// thousands of them, so the models are spent where a rider can tell one
// from the code's lump and nowhere else — measured, the karst's frame
// doubled with the undergrowth drawn whole to its reach. A row with no model
// — any plant on a build switched back — is ONE shape and ONE run a tile,
// exactly the stand it always was.

import * as THREE from "three";
import { type Level } from "@engine";

import { FLORA } from "./flora-defs.ts";
import { planFlora, type FloraSpot } from "./flora-plan.ts";
import { buildFlora, floraMaterial } from "./flora-shapes.ts";
import { coverReach, FLORA_SCALE } from "./settings-video.ts";
import { hasTreeModel, treeMaterial, treeModel, undergrowthMaterial } from "./tree-models.ts";
import { isTreeForm, variantIndex } from "./tree-variants.ts";
import { UNDER_VARIANTS, isUnderForm } from "./undergrowth-variants.ts";

/** How far a modelled tree is drawn WHOLE, m; past it, its sketch. At this
 * range a ten-metre tree stands some forty pixels tall at the reference
 * frame (`coverReach`'s), where the sketch's handful of pads and clusters is
 * all the eye can still resolve of it. */
export const TREE_FULL = 90;

/** …and a piece of modelled undergrowth, m; past it, the code's own shape.
 * A metre plant is under the pixel line by ~100 m, and at a third of that
 * its model's clusters are the same handful of pixels the code's lumps are
 * (measured: 45 m left the karst's cruise frame +45 % of triangles over the
 * code's, 35 m +30 %). */
export const UNDER_FULL = 35;

/** How many of a kind's variants the whole band draws, and how many of their
 * sketches the far band does (variant `k` far is sketch `k` mod this): a
 * mesh a shape a band is a draw call a pass, and the mirror is a second
 * pass. Four whole trees is enough spread that a stand does not read as one
 * tree stamped; at a hundred metres two sketches are. */
export const TREE_SHAPES = 4;
export const TREE_SKETCHES = 2;

/** The square a modelled tree is bucketed into, m — fine enough that the
 * band a tile is drawn in is decided within a few tens of metres of
 * `TREE_FULL`. */
export const TREE_TILE = 48;

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

/** The plants of one SHAPE (a variant, or the code's one shape) in one tile:
 * where the run starts in the species' laid-out buffers, how many stand in
 * it, and each plant's place on the species' whole roster. */
type Run = {
  shape: number;
  start: number;
  planted: number;
  /** How many of the run are drawn under the DETAIL row's line. */
  kept: number;
  /** Ascending — `tileSpots` keeps the roster's order and a tile's runs keep
   * it within each shape, so the plants under the line are the first `kept`
   * of the run. */
  order: number[];
};

/** One square of one species: its runs, the sphere that holds them all with
 * their crowns, and which band and passes it is drawn in. */
type Tile = {
  runs: Run[];
  sphere: THREE.Sphere;
  visible: boolean;
  /** …and close enough to be worth drawing into the water as well. Always
   * false when it is not visible at all. */
  mirrored: boolean;
  /** Past the whole band: drawn in the sketches. */
  far: boolean;
};

/** One instanced mesh: a shape in a band. */
type Shape = {
  mesh: THREE.InstancedMesh;
  /** How many of the laid-out instances the mirror pass draws — the prefix
   * `relay` put the reflected tiles in — and how many the picture draws. */
  inWater: number;
  drawn: number;
};

type Stand = {
  /** One mesh a shape in the whole band, and — a modelled tree's — one a
   * shape in the far band; null when the species has one band. */
  near: Shape[];
  far: Shape[] | null;
  /** Both, as one list. */
  all: Shape[];
  /** Every plant's matrix and tint, tile by tile, run by run. */
  matrices: Float32Array;
  tints: Float32Array;
  tiles: Tile[];
  total: number;
  /** Where this species falls under the pixel line, m — the DISTANCE row's
   * `cover` caps it, it never extends it. */
  reach: number;
  /** Where the whole band ends, m (`Infinity`: one band). */
  full: number;
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
  const modelled = treeMaterial();
  const scrub = undergrowthMaterial();
  const stands: Stand[] = [];
  const shared: THREE.BufferGeometry[] = [];
  let dirty = true;

  /** An instanced mesh of `capacity` plants, drawn nowhere until laid. */
  const shapeOf = (
    geometry: THREE.BufferGeometry,
    mat: THREE.Material,
    capacity: number,
  ): Shape => {
    const mesh = new THREE.InstancedMesh(geometry, mat, Math.max(1, capacity));
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(Math.max(1, capacity) * 3),
      3,
    ).setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.visible = false;
    // The cull is this module's own, tile by tile; a sphere round the whole
    // coast would refuse nothing.
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    return { mesh, inWater: 0, drawn: 0 };
  };

  FLORA.forEach((spec, s) => {
    // A row the coast does not grow gets no mesh at all, not an empty one.
    if (!spec.biomes.includes(level.biome)) return;
    // A tree with its model loaded is its variants in two bands, a piece of
    // undergrowth with its model its variants in one; anything else is the
    // code's one shape, seeded off the species' PLACE in the roster, so a
    // row's shape does not change because another row was added above it.
    const tree = isTreeForm(spec.look.form) && hasTreeModel(spec.id);
    const under = isUnderForm(spec.look.form) && hasTreeModel(spec.id);
    const shapes = tree ? TREE_SHAPES : under ? UNDER_VARIANTS : 1;
    const fulls: THREE.BufferGeometry[] = [];
    const sketches: THREE.BufferGeometry[] = [];
    if (tree || under) {
      for (let v = 0; v < shapes; v++) {
        const whole = treeModel(spec.id, v);
        const sketch = tree && v < TREE_SKETCHES ? treeModel(spec.id, v, true) : null;
        if (!whole || (tree && v < TREE_SKETCHES && !sketch)) break;
        fulls.push(whole);
        if (sketch) sketches.push(sketch);
      }
    }
    const variants = fulls.length === shapes ? shapes : 1;
    const code = buildFlora(spec.look, s * 7919 + 13);
    const geometries = variants > 1 ? fulls : [code];
    // The undergrowth's far band is the code's one shape.
    if (variants > 1 && under) sketches.push(code);
    shared.push(...geometries, ...(variants > 1 ? sketches : []));
    // The geometry stands at unit height and is scaled by each plant's own,
    // so how far it reaches from its foot scales with it: the sphere's own
    // radius plus its centre's offset, which for a tree is most of a crown.
    let crown = 0;
    for (const g of geometries) {
      g.computeBoundingSphere();
      const sphere = g.boundingSphere;
      crown = Math.max(crown, sphere ? sphere.center.length() + sphere.radius : 1);
    }
    // How far this species is worth drawing, and the square it is bucketed
    // into to deliver that — both off the tallest plant the builder can make
    // of it, so a stand is never culled on the average of its own band.
    const reach = coverReach(spec.look.height.max);
    const roster = spots[s];
    const total = roster.length;
    const place = new Map(roster.map((p, i) => [p, i]));
    const shapeAt = (p: FloraSpot): number => (variants > 1 ? variantIndex(p.x, p.z, variants) : 0);
    const counts = new Array<number>(variants).fill(0);
    for (const p of roster) counts[shapeAt(p)]++;
    const matrices = new Float32Array(Math.max(1, total) * 16);
    const tints = new Float32Array(Math.max(1, total) * 3);
    const tiles: Tile[] = [];
    let at = 0;
    for (const list of tileSpots(
      roster,
      sketches.length ? Math.min(TREE_TILE, floraTile(reach)) : floraTile(reach),
    )) {
      let cx = 0;
      let cy = 0;
      let cz = 0;
      const runs: Run[] = [];
      for (let k = 0; k < variants; k++) {
        const mine = variants > 1 ? list.filter((p) => shapeAt(p) === k) : list;
        if (mine.length === 0) continue;
        mine.forEach((p, i) => {
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
        runs.push({
          shape: k,
          start: at,
          planted: mine.length,
          kept: mine.length,
          order: mine.map((p) => place.get(p) ?? 0),
        });
        at += mine.length;
      }
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
        runs,
        sphere: new THREE.Sphere(new THREE.Vector3(cx, cy, cz), radius),
        visible: false,
        mirrored: false,
        far: false,
      });
    }
    const mat = variants > 1 ? (tree ? modelled : scrub) : material;
    const near = geometries.map((g, k) => shapeOf(g, mat, counts[k]));
    // A sketch stands in for every variant that maps onto it — a tree's two
    // in the model's material, the undergrowth's one code shape in the
    // code's.
    const far =
      sketches.length > 0
        ? sketches.map((g, j) =>
            shapeOf(
              g,
              tree ? mat : material,
              counts.reduce((sum, c, k) => sum + (k % sketches.length === j ? c : 0), 0),
            ),
          )
        : null;
    stands.push({
      near,
      far,
      all: far ? [...near, ...far] : near,
      matrices,
      tints,
      tiles,
      total,
      reach,
      full: far ? (tree ? TREE_FULL : UNDER_FULL) : Infinity,
    });
  });

  /** Lay the visible tiles' plants at the front of each shape's buffers,
   * the ones the water mirrors first, and record where the two totals fall. */
  const relay = (): void => {
    for (const stand of stands) {
      const shapes = stand.all;
      const laid = new Map<Shape, number>(shapes.map((sh) => [sh, 0]));
      // Two sweeps rather than a sort: the mirror's tiles are a subset of the
      // visible ones, so laying that subset down and then the remainder puts
      // the reflection's share in one run at the front of every shape.
      for (const pass of [true, false]) {
        for (const t of stand.tiles) {
          if (!t.visible || t.mirrored !== pass) continue;
          const far = t.far && stand.far;
          for (const r of t.runs) {
            if (r.kept === 0) continue;
            const sh = far ? far[r.shape % far.length] : stand.near[r.shape];
            const n = laid.get(sh) ?? 0;
            sh.mesh.instanceMatrix.array.set(
              stand.matrices.subarray(r.start * 16, (r.start + r.kept) * 16),
              n * 16,
            );
            (sh.mesh.instanceColor as THREE.InstancedBufferAttribute).array.set(
              stand.tints.subarray(r.start * 3, (r.start + r.kept) * 3),
              n * 3,
            );
            laid.set(sh, n + r.kept);
          }
        }
        if (pass) for (const sh of shapes) sh.inWater = laid.get(sh) ?? 0;
      }
      for (const sh of shapes) {
        const n = laid.get(sh) ?? 0;
        sh.drawn = n;
        sh.mesh.count = n;
        sh.mesh.visible = n > 0;
        // Only the prefix in use goes to the GPU, not the whole coast's worth.
        const matrix = sh.mesh.instanceMatrix;
        matrix.clearUpdateRanges();
        matrix.addUpdateRange(0, n * 16);
        matrix.needsUpdate = true;
        const colour = sh.mesh.instanceColor as THREE.InstancedBufferAttribute;
        colour.clearUpdateRanges();
        colour.addUpdateRange(0, n * 3);
        colour.needsUpdate = true;
      }
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
          for (const r of t.runs) {
            let n = 0;
            while (n < r.order.length && r.order[n] < line) n++;
            r.kept = n;
          }
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
          const far = near > stand.full;
          if (visible !== t.visible || inWater !== t.mirrored || far !== t.far) {
            t.visible = visible;
            t.mirrored = inWater;
            t.far = far;
            dirty = true;
          }
        }
      }
      if (dirty) relay();
    },
    drawFor: (surface) => {
      for (const stand of stands) {
        for (const sh of stand.all) {
          const n = surface === "mirror" ? sh.inWater : sh.drawn;
          sh.mesh.count = n;
          sh.mesh.visible = n > 0;
        }
      }
    },
    dispose: () => {
      for (const g of shared) g.dispose();
      material.dispose();
      modelled.dispose();
      scrub.dispose();
    },
  };
}
