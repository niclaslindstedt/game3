// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCKS IN THE WATER — `level.solids`, the things the hull can hit,
// drawn as what they are: a skerry is a low granite dome standing out of
// the sea, a boulder a darker lump at the waterline, a reef a dark shape
// just under it that the water's own shallow tint gives away. Low-poly and
// instanced: three draw calls for the lot, whatever the count.

import * as THREE from "three";
import type { Level, Solid } from "@engine";

import { PALETTE } from "../identity.ts";

const SKERRY = new THREE.Color(PALETTE.granite);
const BOULDER = new THREE.Color(PALETTE.graniteDark);
const REEF = new THREE.Color(0x2c3d32);

/** How far below the sea the solids' shapes continue, m, so a rock is
 * rooted in the bed rather than floating at the surface. */
const ROOT = 6;

const m = new THREE.Matrix4();
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const scale = new THREE.Vector3();
const color = new THREE.Color();

function instanced(
  geometry: THREE.BufferGeometry,
  solids: Solid[],
  place: (s: Solid) => void,
  tint: THREE.Color,
  seed: number,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshLambertMaterial({ flatShading: true }),
    Math.max(1, solids.length),
  );
  mesh.count = solids.length;
  solids.forEach((s, i) => {
    place(s);
    quat.setFromAxisAngle(pos.set(0, 1, 0), ((s.x * 7 + s.z * 13 + seed) % 6.28) as number);
    m.compose(pos.set(s.x, pos.y, s.z), quat, scale);
    mesh.setMatrixAt(i, m);
    // A touch of variation in the grey so a field of them is not one rock
    // stamped over and over.
    const v = (((s.x * 31 + s.z * 17) % 100) / 100 - 0.5) * 0.12;
    mesh.setColorAt(i, color.copy(tint).offsetHSL(0, 0, v));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

export function createRocks(level: Level): THREE.Group {
  const group = new THREE.Group();
  const by = (kind: Solid["kind"]) => level.solids.filter((s) => s.kind === kind);
  // A skerry: a seven-sided cone-topped drum, unit radius, from -1 to +1.
  const dome = new THREE.CylinderGeometry(0.55, 1, 2, 7, 1);
  group.add(
    instanced(
      dome,
      by("skerry"),
      (s) => {
        const h = s.top + ROOT;
        pos.y = s.top - h / 2;
        scale.set(s.r, h / 2, s.r * 0.85);
      },
      SKERRY,
      level.seed,
    ),
  );
  // A boulder: a squashed low-poly sphere.
  const lump = new THREE.SphereGeometry(1, 6, 4);
  group.add(
    instanced(
      lump,
      by("boulder"),
      (s) => {
        pos.y = s.top - s.r * 0.55;
        scale.set(s.r, s.r * 0.8, s.r * 0.9);
      },
      BOULDER,
      level.seed,
    ),
  );
  // A reef: flatter still, and under the surface.
  group.add(
    instanced(
      lump,
      by("reef"),
      (s) => {
        pos.y = s.top - s.r * 0.5;
        scale.set(s.r * 1.1, s.r * 0.55, s.r);
      },
      REEF,
      level.seed,
    ),
  );
  return group;
}
