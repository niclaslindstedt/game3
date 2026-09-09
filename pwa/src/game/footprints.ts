// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// FOOTPRINTS ON THE SAND — the one thing that says somebody was here.
//
// A beach is the only surface on this coast that KEEPS a mark. Rock does
// not, water does not, and that asymmetry is most of why a line of prints
// reads as a beach from a hundred metres out: it is a mark that could only
// be on sand. So the trails are drawn nowhere else, and a stretch of shore
// with prints on it is a stretch the classifier called `sand` (R16).
//
// They are DECORATION and nothing else. Nothing in the engine knows they
// exist, the hull cannot touch one, and they change no height — a painter
// that moved geometry would have invented a solid the physics never heard
// of. Placed deterministically on the level's own seed (§25.2: the renderer
// never draws on the simulation's randomness), instanced into one draw
// call, and laid a couple of centimetres over the ground with a polygon
// offset so a print never fights the terrain it sits on.

import * as THREE from "three";
import { createRng, sampleField, type Level } from "@engine";

/** How often a trail starts, m along the shore, and how many trails a
 * level may carry at most — a beach is a walk somebody took, not a
 * thoroughfare. */
const EVERY = 45;
const MAX_TRAILS = 26;
/** A walk: how many paces, how long a pace is (m) and how far apart the
 * feet are (m). A print every 0.72 m is a person walking, not running. */
const PACES = { min: 7, max: 22 };
const STRIDE = 0.72;
const GAIT = 0.34;
/** One print, m: a foot is about this, and at the distance a rider sees it
 * from what matters is that the pair reads as a pair. */
const PRINT = { long: 0.26, wide: 0.11 };
/** How far over the ground a print is laid, m. */
const LIFT = 0.02;
/** The ground a print may be pressed into: above the wash, below the dry
 * back-shore, m against sea level. Wet sand takes a print and dry sand
 * slumps, which is why a real beach carries its trails along the water. */
const BAND = { min: 0.12, max: 1.6 };

/** Sand with a shadow in it — a print is a hollow, and a hollow is the
 * beach's own colour in its own shade. */
const INK = new THREE.Color(0x8a6f42);

const m = new THREE.Matrix4();
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const scale = new THREE.Vector3();

export function createFootprints(level: Level): THREE.Group {
  const group = new THREE.Group();
  const rng = createRng(level.seed ^ 0xf007);
  const pts = level.shore;
  const prints: { x: number; z: number; y: number; heading: number }[] = [];
  let trails = 0;
  let since = EVERY;
  for (let i = 0; i + 1 < pts.length && trails < MAX_TRAILS; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    since += len;
    if (since < EVERY) continue;
    since = 0;
    // The walk runs ALONG the shore, wandering a little either side of it:
    // that is the way people walk a beach, and it keeps the trail inside
    // the strip of sand rather than marching straight off it.
    const along = { x: dx / len, z: dz / len };
    const inland = { x: -along.z, z: along.x };
    const wander = rng.range(-0.35, 0.35);
    const heading = Math.atan2(along.x, along.z) + wander;
    const step = { x: Math.sin(heading), z: Math.cos(heading) };
    // Start out in the band rather than on the line: the polyline is the
    // nominal shore and the water is a few metres either side of it.
    let x = a.x + inland.x * rng.range(4, 16);
    let z = a.z + inland.z * rng.range(4, 16);
    const paces = Math.round(rng.range(PACES.min, PACES.max));
    let laid = 0;
    for (let p = 0; p < paces; p++) {
      const y = sampleField(level.ground, x, z);
      if (y >= BAND.min && y <= BAND.max && level.materialAt(x, z) === "sand") {
        const side = p % 2 === 0 ? GAIT / 2 : -GAIT / 2;
        prints.push({
          x: x + inland.x * side,
          z: z + inland.z * side,
          y: y + LIFT,
          heading,
        });
        laid++;
      }
      x += step.x * STRIDE;
      z += step.z * STRIDE;
    }
    if (laid > 0) trails++;
  }

  const material = new THREE.MeshLambertMaterial({
    color: INK,
    // The print sits on the terrain's own surface; without the offset the
    // two z-fight into a shimmer that is visible right across the beach.
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    transparent: true,
    opacity: 0.8,
  });
  // A flat oval, laid face up: `CircleGeometry` stands in the xy plane, so
  // it is tipped once here rather than per instance.
  const geometry = new THREE.CircleGeometry(1, 8).rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, prints.length));
  mesh.count = prints.length;
  prints.forEach((p, i) => {
    quat.setFromAxisAngle(pos.set(0, 1, 0), p.heading);
    m.compose(pos.set(p.x, p.y, p.z), quat, scale.set(PRINT.wide, 1, PRINT.long));
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  group.add(mesh);
  return group;
}
