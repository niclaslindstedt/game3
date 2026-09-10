// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TREE LINE — a stand-in for the `nature` craft, which will own the
// biomes, the flora library and the placement rules. A northern shore
// without its pines is a quarry, and the pines are what say "taiga" from
// the water, so this puts a forest of the simplest possible tree — a cone
// on a stick — over the land behind the shore: two instanced draw calls,
// placed deterministically from the level's seed on its own generator (the
// renderer never draws on the simulation's randomness, §25.2), only where
// the ground is high enough and far enough inland to have soil.

import * as THREE from "three";
import { createRng, sampleField, type Level } from "@engine";

import { PALETTE } from "../identity.ts";
import { clamp } from "../lib/util.ts";
import { FLORA_SCALE } from "./settings-video.ts";

/** How many trees to try for at the DESIGN density, and the ground they will
 * stand on: at least this high, m, this far inland, m, and no higher than the
 * tree line — a rugged headland (R21) stands as bare rock over the pines, and
 * a wood running to the top of every hill is what would take that away.
 *
 * The stand is actually planted at the thickest the DETAIL row can ask for
 * (`FLORA_SCALE.lush`) and the row then sets the instance count, so moving it
 * shows on the next frame instead of on the next shore. The rng draws are
 * sequential, so a thinner row is the same wood with its last trees left out —
 * never a different wood. */
const TRIES = 2600;
const MIN_HEIGHT = 1.4;
const MIN_INLAND = 14;
const TREE_LINE = 20;
/** Tree height range, m. */
const HEIGHT_MIN = 7;
const HEIGHT_MAX = 15;

const CROWN = new THREE.Color(PALETTE.pine);
const CROWN_DARK = new THREE.Color(PALETTE.pineDark);
const TRUNK = new THREE.Color(0x4a3a2c);

const m = new THREE.Matrix4();
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const scale = new THREE.Vector3();
const color = new THREE.Color();

export type Pines = {
  group: THREE.Group;
  /** How much of the stand is drawn, as a share of the design density — the
   * DETAIL row's `FLORA_SCALE`. Applies on the next frame. */
  setDensity: (share: number) => void;
};

export function createPines(level: Level): Pines {
  const group = new THREE.Group();
  const rng = createRng(level.seed ^ 0x5eed);
  const b = level.bounds;
  const spots: { x: number; z: number; y: number; h: number; tint: number }[] = [];
  const tries = Math.round(TRIES * FLORA_SCALE.lush);
  for (let i = 0; i < tries; i++) {
    const x = rng.range(b.minX, b.maxX);
    const z = rng.range(b.minZ, b.maxZ);
    const y = sampleField(level.ground, x, z);
    if (y < MIN_HEIGHT || y > TREE_LINE) continue;
    if (-sampleField(level.offshore, x, z) < MIN_INLAND) continue;
    // Nothing grows on the beach or on a boulder field: a pine standing in
    // the sand is the one thing that would stop a beach reading as one.
    if (level.materialAt(x, z) !== "bedrock") continue;
    spots.push({ x, z, y, h: rng.range(HEIGHT_MIN, HEIGHT_MAX), tint: rng.range(-0.5, 0.5) });
  }
  const n = Math.max(1, spots.length);
  const crowns = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1, 1, 6, 1).translate(0, 0.5, 0),
    new THREE.MeshLambertMaterial({ flatShading: true }),
    n,
  );
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.12, 0.2, 1, 5).translate(0, 0.5, 0),
    new THREE.MeshLambertMaterial({ color: TRUNK, flatShading: true }),
    n,
  );
  crowns.count = trunks.count = spots.length;
  spots.forEach((s, i) => {
    const trunk = s.h * 0.22;
    quat.setFromAxisAngle(pos.set(0, 1, 0), s.tint * 6);
    m.compose(pos.set(s.x, s.y, s.z), quat, scale.set(1, trunk, 1));
    trunks.setMatrixAt(i, m);
    m.compose(pos.set(s.x, s.y + trunk, s.z), quat, scale.set(s.h * 0.22, s.h - trunk, s.h * 0.22));
    crowns.setMatrixAt(i, m);
    crowns.setColorAt(i, color.copy(CROWN).lerp(CROWN_DARK, s.tint + 0.5));
  });
  crowns.instanceMatrix.needsUpdate = true;
  trunks.instanceMatrix.needsUpdate = true;
  if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
  group.add(crowns, trunks);
  return {
    group,
    setDensity: (share) => {
      const drawn = Math.round(spots.length * (share / FLORA_SCALE.lush));
      crowns.count = trunks.count = clamp(drawn, 0, spots.length);
    },
  };
}
