// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ONE PLACE THE SEA IS TOLD THE HULL IS THERE. Everything else about the
// water is written as if nothing floated on it — the grid is a sheet the
// engine's `surfaceAt` displaces (`water-mesh.ts`) and the light on it is a
// function of the sky (`water-shader.ts`) — and that is right for all of it
// but one square metre: the craft's own cockpit.
//
// A footwell's floor is a tray sunk to within a few centimetres of the rest
// waterline, which is where a real one sits (it drains over the transom).
// So a wave a hand high puts the sea ABOVE that floor, the grid draws it
// there, and the water stands inside the hull with the gunwale bone dry
// either side of it — the one way water gets into a boat that never happens.
// Every water fragment inside the craft's cockpit opening (`wellCutOf` in
// `craft-body.ts`, which measures it off the very layout that lofts the
// hull) and under its RAIL is dropped instead. Over the rail nothing is
// dropped: that is water coming in over the SIDE, which is what a sea
// actually does to an open boat, and a heeled hull takes it over the low
// rail for free because the whole test is done in the body's frame.
//
// The test is behind one sphere, which is false for every pixel of the sea
// but the few square metres the craft is standing on.
import * as THREE from "three";

import type { CraftState } from "@engine";

import type { WellCut } from "./craft-body.ts";

/** The uniforms and the cut, for the fragment shader that draws the sea.
 * Interpolated into it the way the wake's chunk is, so the names are stated
 * once. `vWorld` is the caller's — the fragment's place on the water. */
export const WELL_GLSL = `
  uniform vec3 uWellOrigin;
  uniform mat3 uWellBasis;
  // The opening: (z0, z1) fore and aft, then the floor and the rail.
  uniform vec4 uWellSpan;
  // The hull's skin at those two heights, at the aft end and at the fore.
  uniform vec4 uWellWall;
  // The sphere the whole thing hides behind, squared. Nought is no craft.
  uniform float uWellReach;

  bool insideTheHull(vec3 world) {
    vec3 toHull = world - uWellOrigin;
    if (uWellReach <= 0.0 || dot(toHull, toHull) > uWellReach) return false;
    vec3 body = uWellBasis * toHull;
    float along = (body.z - uWellSpan.x) / (uWellSpan.y - uWellSpan.x);
    float up = (body.y - uWellSpan.z) / (uWellSpan.w - uWellSpan.z);
    if (along <= 0.0 || along >= 1.0 || up <= 0.0 || up >= 1.0) return false;
    // The wall is the hull's skin ruled between the opening's two ends:
    // across to the station, then up from the floor to the rail.
    vec2 wall = mix(uWellWall.xy, uWellWall.zw, along);
    return abs(body.x) < mix(wall.x, wall.y, up);
  }`;

/** What `createWaterMaterial` carries for it — no craft, no cut. */
export function wellUniforms(): Record<string, { value: unknown }> {
  return {
    uWellOrigin: { value: new THREE.Vector3(0, 0, 0) },
    uWellBasis: { value: new THREE.Matrix3() },
    uWellSpan: { value: new THREE.Vector4(0, 1, 0, 1) },
    uWellWall: { value: new THREE.Vector4(0, 0, 0, 0) },
    uWellReach: { value: 0 },
  };
}

const scratchQuat = new THREE.Quaternion();
const scratchPose = new THREE.Matrix4();

/** WHERE THE HULL'S COCKPIT IS THIS FRAME: the opening `wellCutOf` measured
 * off the builder that lofted the hull, and the craft's own place and
 * orientation. Every frame — the opening rides the hull.
 *
 * `null` is a picture with no craft in it (a menu over an empty sea, a craft
 * being swapped), and it is written as a reach of nothing rather than
 * skipped: a stale opening left in the uniforms cuts a hole in the water
 * where the hull used to be. */
export function applyWell(m: THREE.ShaderMaterial, cut: WellCut | null, craft?: CraftState): void {
  const u = m.uniforms;
  if (!cut || !craft) {
    u.uWellReach.value = 0;
    return;
  }
  (u.uWellOrigin.value as THREE.Vector3).set(craft.x, craft.y, craft.z);
  // World → body: the hull's rotation, transposed. three's Matrix3 is the
  // column-major basis GLSL multiplies a column vector by, so the transpose
  // IS the inverse for a rotation.
  scratchQuat.set(craft.q.x, craft.q.y, craft.q.z, craft.q.w);
  scratchPose.makeRotationFromQuaternion(scratchQuat);
  (u.uWellBasis.value as THREE.Matrix3).setFromMatrix4(scratchPose).transpose();
  (u.uWellSpan.value as THREE.Vector4).set(cut.z0, cut.z1, cut.floorY, cut.rimY);
  (u.uWellWall.value as THREE.Vector4).set(
    cut.xFloorAft,
    cut.xRimAft,
    cut.xFloorFore,
    cut.xRimFore,
  );
  // The sphere every one of those pixels is tested behind: the opening's
  // farthest corner from the hull's origin, with a little slack so a corner
  // is never cut off by its own early-out.
  const far =
    Math.max(cut.z0 * cut.z0, cut.z1 * cut.z1) +
    Math.max(cut.xFloorAft, cut.xRimAft, cut.xFloorFore, cut.xRimFore) ** 2 +
    Math.max(cut.floorY * cut.floorY, cut.rimY * cut.rimY);
  u.uWellReach.value = far * 1.1;
}
