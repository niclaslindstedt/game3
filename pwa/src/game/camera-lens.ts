// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LENS ITSELF — how a design field of view becomes the one the frame is
// actually drawn with, and the half-angles that follow from it.
//
// Stated apart from `camera.ts` for one reason: the rigs pick a fov, and a
// rig that has to FRAME something at a screen position (the menu's drone,
// `camera-menu.ts`) has to know what that fov is worth at this viewport's
// shape before it can point the lens. A rig cannot ask `camera.ts`, which is
// the module that drives it, so the arithmetic lives under both of them.
// `camera.ts` re-exports all three names, so everything that already spells
// them its way still does.

/** Aspect ratio the fov numbers are tuned against (landscape). */
export const REF_ASPECT = 16 / 9;
/** Vertical fov ceiling on narrow viewports, deg — where hor+ stops before
 * a phone held upright turns into a fisheye. */
export const MAX_VFOV = 108;

/** three.js's fov is VERTICAL, so a fixed number collapses the horizontal
 * field on a phone held upright, and every degree of yaw sweeps three
 * times more of the frame than it does in landscape. Below the reference
 * aspect the HORIZONTAL field is held instead (hor+), capped. */
export function verticalFovFor(designFov: number, aspect: number): number {
  if (!(aspect < REF_ASPECT)) return designFov;
  const halfH = Math.atan(Math.tan((designFov * Math.PI) / 360) * REF_ASPECT);
  return Math.min(MAX_VFOV, (Math.atan(Math.tan(halfH) / aspect) * 360) / Math.PI);
}

/** The frame's own half-angles as TANGENTS, which is the form every framing
 * question wants: a point sitting at `sx` across the frame and `sy` up it
 * (both −1..1, the corners) lies `sx · tanX` and `sy · tanY` off the lens's
 * axis in the camera's own right and up. Fed the DESIGN fov, so the hor+
 * widening a narrow viewport gets is inside the answer. */
export function frameTangents(designFov: number, aspect: number): { tanX: number; tanY: number } {
  const tanY = Math.tan((verticalFovFor(designFov, aspect) * Math.PI) / 360);
  return { tanX: tanY * aspect, tanY };
}
