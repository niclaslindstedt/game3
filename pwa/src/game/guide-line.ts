// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GUIDE LINE — a dashed mark lying on the sea along the course's own
// line, running from the checkpoint behind the rider to the one ahead and on
// down the line (`guide-plan.ts` owns which stretch that is; `aimPoint` in
// the engine is where "what is the rider riding at" is answered, and neither
// module asks it a second way).
//
// IT IS A THING IN THE WATER, not a layer over it. Everything else that says
// where to go on this game is drawn on the glass — the minimap in the corner,
// the bearing arrow, the lit mark on the next buoy pair — and each of them
// costs a moment with the eyes off the water. A line in the water is read the
// way a rider reads the sea itself: it is in the frame they are already
// looking at, it foreshortens with distance so it says how far as well as
// which way, and it rolls and pitches with the surface it is on, so it
// belongs to the world rather than to a layer over it. That is also why it is
// not a solid stripe: an unbroken line reads as a wall or a rope, and a run
// of dashes with water between them reads as a path.
//
// IT STANDS STILL IN THE WORLD. The dashes are laid at fixed stations along
// `Course.path` rather than at fixed distances from the bow, so the rider
// passes over them the way they would over a lane marking. A mark measured
// from the hull crawls with the hull, and a line that ENDS at the hull's
// target shrinks to a stub exactly as the rider closes on a checkpoint —
// which is the moment the next leg's bend is the thing worth knowing.
//
// IT IS SUBTLE ON PURPOSE. Each dash is a small white plate — well under a
// hull's beam — laid a hand's depth off the surface along the water's OWN
// NORMAL, so it banks with the wave face it is on and rides up and over a
// crest the way anything floating there would. That is what keeps it from
// reading as a road painted on the sea: it never cuts a crest and it never
// argues with the shape of the water, which is the thing the whole game is
// about looking at.
//
// HOW IT IS SEEN, AND THE ONE THING THE WATER'S WINDOW CHANGES. Each dash is
// a flat QUAD lying in the water rather than a stroked line — a WebGL line is
// one pixel wide whatever width is asked of it, and one pixel under a
// semi-transparent surface is not subtle but invisible. With the window OPEN
// (OPTIONS ▸ VIDEO ▸ SEE-THROUGH) the plate lies UNDER the surface and is
// drawn ahead of the near water (`renderOrder`), so the sea blends over the
// top of it and the crests and the foam pass across. With the window CLOSED
// the water is opaque, and a mark under it is not subtle but gone — so the
// same plate is lifted just PROUD of the surface and drawn after the water
// instead, fainter, so it still reads as something floating on the sea rather
// than as a stripe painted on the lens.

import * as THREE from "three";

import { aimPoint, type GameState, type Level, type SurfaceSample } from "@engine";

import { BEHIND, guidePath, guideWindow, REACH, type GuidePath } from "./guide-plan.ts";

/** The dash, the water between two of them, and how wide a dash is — all m,
 * all in WORLD metres rather than in screen pixels, so the mark foreshortens:
 * a dash near the bow is a hand's length on screen and one two hundred metres
 * out is a speck, which is most of what tells a rider how far away the thing
 * is.
 *
 * SMALL. Well under a hull's beam, so the run reads as a line of little
 * plates lying in the water and never as a road painted down it: what is in
 * the frame has to stay the SEA, and a guide wide enough to argue with the
 * waves has taken the game away from the thing the game is about.
 *
 * A dash is a QUAD rather than a stroked line because a WebGL line is one
 * pixel wide whatever width is asked of it, and one pixel under a
 * semi-transparent surface is not subtle but invisible. */
const DASH = 0.8;
const GAP = 1.2;
const WIDE = 0.55;

/** The stride from one dash to the next, m. Dashes are laid at MULTIPLES of
 * it along the course's own line, so the pattern is anchored to the world and
 * does not crawl as the rider moves. */
const STRIDE = DASH + GAP;

/** How far off the surface a dash lies, m — measured along the water's own
 * NORMAL rather than straight down, so it is the same clearance under a wave
 * face as under a flat calm. Shallow either way, because the mark is meant to
 * look like it is IN the water; never zero, because a plate on the surface
 * z-fights with it.
 *
 * The lift over an opaque sea is the smaller of the two: nothing blends over
 * it up there, so the only job left is to clear the surface it is riding. */
const UNDER = 0.18;
const OVER = 0.1;

/** How many dashes the drawn stretch is worth, with a little slack for a path
 * that bends. The buffer is allocated ONCE at this size and the unused tail is
 * collapsed to a point rather than reallocated — the line is rebuilt every
 * frame, and a per-frame allocation in the renderer is a per-frame
 * allocation. */
const DASHES = Math.ceil((REACH + BEHIND) / STRIDE) + 8;

/** The mark's own colour and weight. WHITE, which is the one colour the sea
 * already has in it — a crest, a patch of foam, the wake — so a line of it
 * lying in the water reads as part of the water rather than as a tint
 * somebody added to it. Faint with it: the dash is there when a rider goes
 * looking and out of the way when they are riding.
 *
 * ON TOP OF AN OPAQUE SEA IT IS FAINTER BY FAR. Under a see-through surface
 * the water itself takes most of the mark's edge off before the rider sees
 * it; over an opaque one nothing does, so the plate has to be barely there on
 * its own account — a tenth of white, which reads as a sheen on the water at
 * the range a rider is actually looking and never as a stripe laid over it. */
const INK = 0xffffff;
const FADE_UNDER = 0.55;
const FADE_OVER = 0.1;

export type GuideLine = {
  group: THREE.Object3D;
  /** Redraw for this frame. `surface` is the engine's own `surfaceAt`, bound
   * by the renderer to the run's sea and clock, so the dashes ride the very
   * water the hull is riding. */
  update: (
    state: GameState,
    surface: (x: number, z: number, out: SurfaceSample) => SurfaceSample,
  ) => void;
  /** Whether the line is drawn at all — the HUD's own switch. */
  setShown: (on: boolean) => void;
  /** Whether the WATER'S WINDOW is open — OPTIONS ▸ VIDEO ▸ SEE-THROUGH, the
   * same switch `WaterMesh.setWindow` is given. Open, the dashes lie under a
   * see-through surface; closed, they lie on top of an opaque one. */
  setWindow: (open: boolean) => void;
  dispose: () => void;
};

/** A point on the line the dashes are laid along. */
type Step = { x: number; z: number };

export function createGuideLine(): GuideLine {
  // Six vertices a dash — two triangles making the quad — written in place
  // every frame. Allocated once: the line is rebuilt at frame rate, and a
  // buffer built per frame is a buffer collected per frame.
  const positions = new Float32Array(DASHES * 6 * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  // The mark never leaves the water around the craft, and its bounding
  // sphere would be recomputed from a buffer that changes every frame;
  // culling it would cost that recompute to save nothing.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  const material = new THREE.MeshBasicMaterial({
    color: INK,
    transparent: true,
    opacity: FADE_UNDER,
    // It lies IN the water, so it must not occlude what is under it.
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const ribbon = new THREE.Mesh(geometry, material);
  // Under a see-through surface the `renderOrder` rather than the distance
  // sort is what puts the mark before the water that blends over it; on top
  // of an opaque one it is the ordinary transparent pass, which runs after
  // the water has been drawn and depth-tests against it.
  ribbon.renderOrder = -1;
  ribbon.frustumCulled = false;
  ribbon.visible = false;

  const sample: SurfaceSample = { height: 0, nx: 0, ny: 1, nz: 0, vx: 0, vy: 0, vz: 0 };
  const head: Step = { x: 0, z: 0 };
  const tail: Step = { x: 0, z: 0 };
  let shown = true;
  let windowOpen = true;
  // The level's line, measured when the level changes rather than per frame.
  let planLevel: Level | null = null;
  let plan: GuidePath | null = null;

  const update: GuideLine["update"] = (state, surface) => {
    const aim = shown ? aimPoint(state) : null;
    if (!aim) {
      ribbon.visible = false;
      return;
    }
    if (state.level !== planLevel || !plan) {
      planLevel = state.level;
      plan = guidePath(state.level);
    }
    const path = plan;
    const { begin, end } = guideWindow(path, state, aim);
    // The leg the cursor stands on, walked forward only: the dashes are laid
    // in order, so a segment once passed is never asked for again.
    let leg = 1;
    /** The point `d` metres along the course's line, written into `out`. */
    const at = (d: number, out: Step): Step => {
      const last = path.points.length - 1;
      while (leg < last && path.cum[leg] < d) leg++;
      const a = path.points[leg - 1];
      const b = path.points[leg];
      const span = path.cum[leg] - path.cum[leg - 1];
      const t = span > 0 ? Math.min(1, Math.max(0, (d - path.cum[leg - 1]) / span)) : 0;
      out.x = a.x + (b.x - a.x) * t;
      out.z = a.z + (b.z - a.z) * t;
      return out;
    };
    const lift = windowOpen ? -UNDER : OVER;
    let put = 0;
    // Laid on the STATIONS themselves rather than from either end of the
    // window, so every dash stands in the same water from one frame to the
    // next however the window slides.
    const first = Math.ceil(begin / STRIDE) * STRIDE;
    for (let along = first; along + DASH <= end && put < DASHES; along += STRIDE) {
      const a = at(along, head);
      const ax = a.x;
      const az = a.z;
      const b = at(along + DASH, tail);
      // THE PLATE IS BUILT IN THE WATER'S OWN FRAME, not in the plan. Both
      // ends are sampled for a height AND a normal; the plate lies along the
      // line between them, is widened across the mean normal, and is pushed
      // off the surface along that normal rather than straight down. On a
      // wave face all three matter: a plate widened in the plan is a plate
      // that grows as the face steepens, and one offset straight down on a
      // steep face is one whose upper edge comes through the water.
      surface(ax, az, sample);
      const ay = sample.height;
      let nx = sample.nx;
      let ny = sample.ny;
      let nz = sample.nz;
      surface(b.x, b.z, sample);
      const by = sample.height;
      nx += sample.nx;
      ny += sample.ny;
      nz += sample.nz;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;
      const lx = b.x - ax;
      const ly = by - ay;
      const lz = b.z - az;
      const ll = Math.hypot(lx, ly, lz);
      if (ll <= 0) break;
      // Across = normal × along, which lies in the water's tangent plane.
      let cx = ny * (lz / ll) - nz * (ly / ll);
      let cy = nz * (lx / ll) - nx * (lz / ll);
      let cz = nx * (ly / ll) - ny * (lx / ll);
      const cl = Math.hypot(cx, cy, cz) || 1;
      cx = (cx / cl) * (WIDE / 2);
      cy = (cy / cl) * (WIDE / 2);
      cz = (cz / cl) * (WIDE / 2);
      const dx0 = nx * lift;
      const dy0 = ny * lift;
      const dz0 = nz * lift;
      const a0: [number, number, number] = [ax - cx + dx0, ay - cy + dy0, az - cz + dz0];
      const a1: [number, number, number] = [ax + cx + dx0, ay + cy + dy0, az + cz + dz0];
      const b0: [number, number, number] = [b.x - cx + dx0, by - cy + dy0, b.z - cz + dz0];
      const b1: [number, number, number] = [b.x + cx + dx0, by + cy + dy0, b.z + cz + dz0];
      const quad: [number, number, number][] = [a0, a1, b1, a0, b1, b0];
      let v = put * 6 * 3;
      for (const p of quad) {
        positions[v] = p[0];
        positions[v + 1] = p[1];
        positions[v + 2] = p[2];
        v += 3;
      }
      put++;
    }
    // The tail of the buffer, collapsed onto one point rather than left
    // carrying the dashes of a frame that has gone.
    for (let i = put * 6; i < DASHES * 6; i++) {
      positions[i * 3] = positions[0];
      positions[i * 3 + 1] = positions[1];
      positions[i * 3 + 2] = positions[2];
    }
    geometry.attributes.position.needsUpdate = true;
    ribbon.visible = put > 0;
  };

  return {
    group: ribbon,
    update,
    setShown: (on) => {
      shown = on;
      if (!on) ribbon.visible = false;
    },
    setWindow: (open) => {
      windowOpen = open;
      material.opacity = open ? FADE_UNDER : FADE_OVER;
      ribbon.renderOrder = open ? -1 : 0;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
