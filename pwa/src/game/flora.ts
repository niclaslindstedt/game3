// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SHORE, PLANTED — the cover as three.js sees it: one instanced mesh a
// species, standing where `flora-plan.ts` put it.
//
// The split is the app's usual one. `flora-defs.ts` says what a species is
// and where it grows, `flora-plan.ts` works out where every plant stands
// with no renderer in sight, `flora-shapes.ts` builds the one geometry a
// species is drawn from, and this file is the wiring: the meshes, the
// per-instance matrix and tint, and the DETAIL row's thinning.

import * as THREE from "three";
import { type Level } from "@engine";

import { clamp } from "../lib/util.ts";
import { FLORA } from "./flora-defs.ts";
import { planFlora } from "./flora-plan.ts";
import { buildFlora, floraMaterial } from "./flora-shapes.ts";
import { FLORA_SCALE } from "./settings-video.ts";

const m = new THREE.Matrix4();
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const scale = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const colour = new THREE.Color();

export type Flora = {
  group: THREE.Group;
  /** How much of the cover is drawn, as a share of the design density —
   * the DETAIL row's `FLORA_SCALE`. Applies on the next frame. */
  setDensity: (share: number) => void;
  dispose: () => void;
};

export function createFlora(level: Level): Flora {
  const group = new THREE.Group();
  const spots = planFlora(level, FLORA_SCALE.lush);
  const material = floraMaterial();
  const meshes: THREE.InstancedMesh[] = [];
  const counts: number[] = [];

  FLORA.forEach((spec, s) => {
    const list = spots[s];
    const mesh = new THREE.InstancedMesh(
      // Seeded off the species' PLACE in the roster, so a row's shape does
      // not change because another row was added above it.
      buildFlora(spec.look, s * 7919 + 13),
      material,
      Math.max(1, list.length),
    );
    mesh.count = list.length;
    // One instanced mesh spans the whole shore, so there is no box worth
    // testing it against and a frustum test only costs a matrix.
    mesh.frustumCulled = false;
    list.forEach((p, i) => {
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
    meshes.push(mesh);
    counts.push(list.length);
    group.add(mesh);
  });

  return {
    group,
    setDensity: (share) => {
      const of = share / FLORA_SCALE.lush;
      meshes.forEach((mesh, s) => {
        mesh.count = clamp(Math.round(counts[s] * of), 0, counts[s]);
      });
    },
    dispose: () => {
      for (const mesh of meshes) mesh.geometry.dispose();
      material.dispose();
    },
  };
}
