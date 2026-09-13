// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GUIDE LINE — a dashed mark lying just UNDER the sea surface, running
// from the hull to whatever the rider is riding at: the next checkpoint in a
// race or a time trial, the next lip in a tricks run (`aimPoint` in the
// engine is where that question is answered, and this module never asks it a
// second way).
//
// IT IS UNDER THE WATER AND NOT OVER IT, and that is the whole design.
// Everything else that says where to go on this game is drawn on the glass —
// the minimap in the corner, the bearing arrow, the lit mark on the next
// buoy pair — and each of them costs a moment with the eyes off the water.
// A line in the water is read the way a rider reads the sea itself: it is in
// the frame they are already looking at, it foreshortens with distance so it
// says how far as well as which way, and it rolls and pitches with the
// surface it is under, so it belongs to the world rather than to a layer
// over it. That is also why it is not a solid stripe: an unbroken line reads
// as a wall or a rope, and a run of dashes with water between them reads as
// a path.
//
// IT IS SUBTLE ON PURPOSE, and it never stops being a thing in the water.
// Each dash is a small white plate — well under a hull's beam — laid a hand's
// depth under the surface along the water's OWN NORMAL, so it banks with the
// wave face it is under and rides up and over a crest the way anything
// floating there would. That is what keeps it from reading as a road painted
// on the sea: it is never above a wave, it never cuts a crest, and it never
// argues with the shape of the water, which is the thing the whole game is
// about looking at.
//
// HOW IT IS SEEN. Each dash is a flat QUAD lying in the water rather than a
// stroked line — a WebGL line is one pixel wide whatever width is asked of
// it, and one pixel under a semi-transparent surface is not subtle but
// invisible — and it is drawn ahead of the near water (`renderOrder`), so
// the surface blends over the top of it. That is what puts it visibly UNDER
// the sea rather than painted on it, with the crests and the foam passing
// across. It follows from that (and it is the honest behaviour, not a gap)
// that closing the water's window closes this too: a rider who has told
// OPTIONS ▸ VIDEO they do not want to see into the water has told it about
// this as well, and the minimap and the bearing arrow are still there.
//
// THE PATH IT DRAWS is the racing line, not the crow's flight: it is walked
// along `Course.path` from the hull's own station to the target's, so it
// bends round the headland the way the rider will have to. Only the LEAD-IN
// is straight — from the hull to where it stands on the line — because a
// rider off the line wants to know where the line is.

import * as THREE from "three";

import {
  aimPoint,
  cumulative,
  distanceAlong,
  type GameState,
  type Level,
  type SurfaceSample,
} from "@engine";

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

/** How far under the surface a dash lies, m — measured along the water's own
 * NORMAL rather than straight down, so it is the same depth under a wave
 * face as it is under a flat calm. Shallow, because it is meant to be seen;
 * never zero, because a plate ON the surface z-fights with it and a plate
 * that pokes THROUGH a crest stops being a thing in the water. */
const UNDER = 0.18;

/** How far down the line it is drawn at most, m. A line to a mark a
 * kilometre away is a kilometre of dashes nobody can resolve, drawn every
 * frame; past this the rider is being told a direction, which the arrow and
 * the minimap already say better. */
const REACH = 320;

/** How many dashes that is worth, with a little slack for a path that bends.
 * The buffer is allocated ONCE at this size and the unused tail is collapsed
 * to a point rather than reallocated — the line is rebuilt every frame, and
 * a per-frame allocation in the renderer is a per-frame allocation. */
const DASHES = Math.ceil(REACH / (DASH + GAP)) + 8;

/** How far from the hull the line STARTS, m — clear of the bow, so it is a
 * path leading away rather than a leash tied to the craft. */
const LEAD = 6;

/** The mark's own colour and weight. WHITE, which is the one colour the sea
 * already has in it — a crest, a patch of foam, the wake — so a line of it
 * lying in the water reads as part of the water rather than as a tint
 * somebody added to it. Faint with it: the dash is there when a rider goes
 * looking and out of the way when they are riding. */
const INK = 0xffffff;
const FADE = 0.55;

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
  dispose: () => void;
};

/** A point on the walk the dashes are laid along. */
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
    opacity: FADE,
    // It lies IN the water, so it must not occlude what is under it — and
    // `renderOrder` rather than the distance sort is what puts it before the
    // surface that blends over the top of it.
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const ribbon = new THREE.Mesh(geometry, material);
  ribbon.renderOrder = -1;
  ribbon.frustumCulled = false;
  ribbon.visible = false;

  const sample: SurfaceSample = { height: 0, nx: 0, ny: 1, nz: 0, vx: 0, vy: 0, vz: 0 };
  const walk: Step[] = [];
  let shown = true;
  // The path's cumulative lengths, rebuilt when the level changes rather
  // than per frame — a course path is a few hundred points.
  let cumLevel: Level | null = null;
  let cum: ReturnType<typeof cumulative> = cumulative([]);

  /** The polyline the dashes are laid along: the hull, then the course path
   * from where the hull stands on it up to the target, then the target
   * itself. Written into `walk` in place. */
  const route = (state: GameState, aim: { x: number; z: number }): void => {
    walk.length = 0;
    const c = state.craft;
    walk.push({ x: c.x, z: c.z });
    const path = state.level.course.path;
    if (state.level !== cumLevel) {
      cumLevel = state.level;
      cum = cumulative(path);
    }
    const from = distanceAlong(path, cum, c.x, c.z);
    const to = distanceAlong(path, cum, aim.x, aim.z);
    // Only the stretch of line BETWEEN the two, and only when the target is
    // actually down the line from here: a lip on the return pass stands
    // behind the rider's station, and walking the path backwards to it would
    // draw the way they came instead of the way they are going.
    if (to > from) {
      for (let i = 1; i < path.length; i++) {
        if (cum[i] <= from) continue;
        if (cum[i] >= to) break;
        walk.push({ x: path[i].x, z: path[i].z });
      }
    }
    walk.push({ x: aim.x, z: aim.z });
  };

  const update: GuideLine["update"] = (state, surface) => {
    const aim = shown ? aimPoint(state) : null;
    if (!aim) {
      ribbon.visible = false;
      return;
    }
    route(state, aim);
    let legStart = 0;
    let leg = 1;
    /** The point `d` metres along the route. The walk is monotonic, so the
     * leg cursor only ever moves forward. */
    const at = (d: number): Step => {
      while (leg < walk.length - 1) {
        const a = walk[leg - 1];
        const b = walk[leg];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        if (d <= legStart + len) break;
        legStart += len;
        leg++;
      }
      const a = walk[leg - 1];
      const b = walk[leg];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const t = len <= 0 ? 0 : Math.min(1, Math.max(0, (d - legStart) / len));
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    };
    let total = 0;
    for (let i = 1; i < walk.length; i++) {
      total += Math.hypot(walk[i].x - walk[i - 1].x, walk[i].z - walk[i - 1].z);
    }
    const end = Math.min(total, REACH);
    let put = 0;
    for (let along = LEAD; along + DASH <= end && put < DASHES; along += DASH + GAP) {
      const a = at(along);
      const b = at(along + DASH);
      // THE PLATE IS BUILT IN THE WATER'S OWN FRAME, not in the plan. Both
      // ends are sampled for a height AND a normal; the plate lies along the
      // line between them, is widened across the mean normal, and is pushed
      // under the surface along that normal rather than straight down. On a
      // wave face all three matter: a plate widened in the plan is a plate
      // that grows as the face steepens, and one pushed straight down on a
      // steep face is one whose upper edge comes through the water.
      surface(a.x, a.z, sample);
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
      const lx = b.x - a.x;
      const ly = by - ay;
      const lz = b.z - a.z;
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
      const dx0 = -nx * UNDER;
      const dy0 = -ny * UNDER;
      const dz0 = -nz * UNDER;
      const a0: [number, number, number] = [a.x - cx + dx0, ay - cy + dy0, a.z - cz + dz0];
      const a1: [number, number, number] = [a.x + cx + dx0, ay + cy + dy0, a.z + cz + dz0];
      const b0: [number, number, number] = [b.x - cx + dx0, by - cy + dy0, b.z - cz + dz0];
      const b1: [number, number, number] = [b.x + cx + dx0, by + cy + dy0, b.z + cz + dz0];
      const quad: [number, number, number][] = [a0, a1, b1, a0, b1, b0];
      for (const v of quad) {
        positions[put * 3] = v[0];
        positions[put * 3 + 1] = v[1];
        positions[put * 3 + 2] = v[2];
        put++;
      }
    }
    // The tail of the buffer, collapsed onto one point rather than left
    // carrying the dashes of a frame that has gone.
    for (let i = put; i < DASHES * 6; i++) {
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
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
