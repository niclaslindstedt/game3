// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT IS STILL WORTH DRAWING — the DISTANCE row's one mechanism, in one
// place because the shore and its cover both want it and neither should own
// it.
//
// THE WHOLE IDEA IS THAT NOTHING IS LOST. The row does not draw a shorter
// world; it declines to submit the part of the world the fog has already
// finished with (`DISTANCE_LOOK.haze` pulls the fog in to guarantee that), so
// what comes back is the same picture with fewer vertices in it. That is why
// this is a visibility flag and not a rebuild: a chunk hidden at four hundred
// metres is shown again at three hundred and ninety-nine, with nothing
// allocated either way and no hitch at the boundary — the boundary is inside
// solid fog.
//
// It measures ON THE PLAN, not through the air. A draw radius is a question
// about how much coast is in front of the rider, and a hill two hundred metres
// up is no further away for being up there — folding the height in would make
// the same headland cull at different ranges from a chase seat and from the
// helicopter.
//
// EVERY MESH IT IS GIVEN CARRIES ITS GEOMETRY IN WORLD COORDINATES and stands
// at its group's origin — true of the shore's chunks (`terrain.ts` writes
// world x/z into the positions) and of the cover's stands (`flora.ts` puts
// world matrices in the instances). Nothing here walks a transform, so a
// caller that starts moving its meshes has to say so.

import * as THREE from "three";

/** The sphere a mesh answers for: an InstancedMesh's own, which spans its
 * instances, else the geometry's. Either can be null before it is computed,
 * and a mesh that cannot say where it is is always drawn — an invisible
 * headland is a much worse bug than a wasted draw call. */
function sphereOf(mesh: THREE.Object3D): THREE.Sphere | null {
  const instanced = mesh as THREE.InstancedMesh;
  if (instanced.isInstancedMesh && instanced.boundingSphere) return instanced.boundingSphere;
  const geometry = (mesh as THREE.Mesh).geometry;
  return geometry ? geometry.boundingSphere : null;
}

/** Show every child of `group` that reaches within `reach` metres of the point
 * `(x, z)` on the plan, and hide the rest. Conservative at the edge: a mesh is
 * kept while any part of its bounding sphere is inside the radius, so the
 * radius is the nearest distance at which something may vanish rather than the
 * furthest at which it may still be there. */
export function cullByDistance(group: THREE.Group, x: number, z: number, reach: number): void {
  for (const child of group.children) {
    const sphere = sphereOf(child);
    if (!sphere) {
      child.visible = true;
      continue;
    }
    const dx = sphere.center.x - x;
    const dz = sphere.center.z - z;
    child.visible = Math.hypot(dx, dz) - sphere.radius <= reach;
  }
}
