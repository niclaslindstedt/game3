// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SHORE, PLANTED — the cover as three.js sees it: instanced meshes
// standing where `flora-plan.ts` put them.
//
// The split is the app's usual one. `flora-defs.ts` says what a species is
// and where it grows, `flora-plan.ts` works out where every plant stands
// with no renderer in sight, `flora-shapes.ts` builds the one geometry a
// species is drawn from, and this file is the wiring: the meshes, the
// per-instance matrix and tint, the DETAIL row's thinning and the DISTANCE
// row's reach.
//
// ONE MESH A SPECIES A STAND, rather than one a species. The cover is the
// heaviest thing in the frame by a distance — a level grows some twenty-six
// thousand plants, and a plant is tens of triangles, so the wood is most of
// every million the profile reports — and a single mesh spanning the whole
// coast can be neither frustum-culled (there is no box worth testing: it is
// all of them) nor cut by distance (an instanced draw is one contiguous run,
// and "the ones near the rider" is not a run).
//
// Bucketing the stands on a coarse grid buys both at once: the wood behind the
// camera stops being submitted at all, and `setReach` drops what the fog has
// already closed over. It is paid for in DRAW CALLS, and not cheaply — the
// cruise scene went from 77 a frame to 158 — but it is the right way round,
// because the same frame went from 1.60 M triangles to 845 k. A hundred draw
// calls is a CPU cost a phone can carry; a million triangles it cannot.
//
// `STAND` was measured rather than picked, on `make profile --scene cruise`:
//
//   480 m   133 draws   918 k tris
//   320 m   158 draws   845 k tris
//   256 m   177 draws   784 k tris
//
// 320 is the knee. Going coarser hands back nine per cent of the triangles to
// save twenty-five calls; going finer spends nineteen more calls for seven per
// cent — and past the fog there is nothing left to cull closely anyway.

import * as THREE from "three";
import { type Level } from "@engine";

import { clamp } from "../lib/util.ts";
import { cullByDistance } from "./draw-distance.ts";
import { FLORA } from "./flora-defs.ts";
import { planFlora, type FloraSpot } from "./flora-plan.ts";
import { buildFlora, floraMaterial } from "./flora-shapes.ts";
import { FLORA_SCALE } from "./settings-video.ts";

/** A stand's edge, m — the grid the cover is bucketed on. */
const STAND = 320;

const m = new THREE.Matrix4();
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const scale = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const colour = new THREE.Color();

export type Flora = {
  group: THREE.Group;
  /** How much of the cover is drawn, as a share of the design density —
   * the DETAIL row's `FLORA_SCALE`. Taken stand by stand, so thinning and
   * distance are independent: a rider at SPARSE and a long view sees the
   * same thin wood all the way out. Applies on the next frame. */
  setDensity: (share: number) => void;
  /** How far the cover is drawn from `(x, z)` on the plan, m — the DISTANCE
   * row's `cover`. Applies on the next frame. */
  setReach: (x: number, z: number, reach: number) => void;
  dispose: () => void;
};

/** The stands a species' plants fall into, keyed by cell. */
function bucket(list: readonly FloraSpot[]): Map<string, FloraSpot[]> {
  const stands = new Map<string, FloraSpot[]>();
  for (const spot of list) {
    const key = `${Math.floor(spot.x / STAND)},${Math.floor(spot.z / STAND)}`;
    const stand = stands.get(key);
    if (stand) stand.push(spot);
    else stands.set(key, [spot]);
  }
  return stands;
}

export function createFlora(level: Level): Flora {
  const group = new THREE.Group();
  const spots = planFlora(level, FLORA_SCALE.lush);
  const material = floraMaterial();
  // One geometry a species, shared by every stand of it and disposed once.
  const shapes: THREE.BufferGeometry[] = [];
  const meshes: THREE.InstancedMesh[] = [];
  const counts: number[] = [];

  FLORA.forEach((spec, s) => {
    // Seeded off the species' PLACE in the roster, so a row's shape does
    // not change because another row was added above it.
    const shape = buildFlora(spec.look, s * 7919 + 13);
    shapes.push(shape);
    for (const stand of bucket(spots[s]).values()) {
      const mesh = new THREE.InstancedMesh(shape, material, stand.length);
      stand.forEach((p, i) => {
        quat.setFromAxisAngle(up, p.yaw);
        // A stone is buried to its waist so it sits IN the shore rather than
        // balancing on it; everything else stands on the ground it grew from.
        const foot = spec.look.form === "stone" ? p.y - p.h * 0.42 : p.y;
        m.compose(pos.set(p.x, foot, p.z), quat, scale.set(p.h, p.h, p.h));
        mesh.setMatrixAt(i, m);
        // A little light and dark between one plant and the next, so a stand
        // is a stand rather than one plant stamped a thousand times. The
        // instance colour MULTIPLIES the geometry's own, so it is a grey
        // either side of one rather than a colour of its own.
        mesh.setColorAt(i, colour.setScalar(1 + p.tint * 0.24));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      // Over the stand's own instances rather than over one plant's geometry:
      // it is what the frustum test and `cullByDistance` both read, and a
      // sphere around a single pine at the origin would cull the whole wood.
      mesh.computeBoundingSphere();
      meshes.push(mesh);
      counts.push(stand.length);
      group.add(mesh);
    }
  });

  return {
    group,
    setDensity: (share) => {
      const of = share / FLORA_SCALE.lush;
      meshes.forEach((mesh, i) => {
        mesh.count = clamp(Math.round(counts[i] * of), 0, counts[i]);
      });
    },
    setReach: (x, z, reach) => cullByDistance(group, x, z, reach),
    dispose: () => {
      for (const shape of shapes) shape.dispose();
      material.dispose();
    },
  };
}
