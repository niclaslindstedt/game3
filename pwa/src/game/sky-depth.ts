// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKY IS DRAWN LAST, AT THE BACK OF THE DEPTH BUFFER.
//
// Everything camera-locked — the dome, the stars, the sun's disc and its
// halo, the weather's ceiling — is a BACKDROP: it stands at infinity, it is
// behind every solid thing on the coast, and it occludes nothing. There are
// two ways to draw that, and which one is chosen is the biggest single
// number in a frame's fill cost.
//
// The obvious way is to paint it FIRST and let the world paint over it.
// That is correct, and it means the sky's fragment shader runs on every
// pixel of the screen — then most of that work is buried under the water
// grid, the shore and the craft. On a phone, where this game has to hold
// 60 Hz, that buried work is the most expensive thing it throws away.
//
// So it is painted LAST, after every opaque thing in the world, and
// depth-tested — the depth buffer rejects the covered pixels before the
// fragment shader runs on them, and only real sky is ever shaded.
//
// Two things make that safe, and both are the point of this module:
//
//   * THE DEPTH IS FORCED TO THE FAR PLANE (`gl_Position.z = gl_Position.w`,
//     the line three's own skybox shader uses). The backdrop stands nearer
//     than the far plane in actual metres — the dome is 1800 m out, the
//     ceiling 3 km — and depth-testing it at its real distance is the bug
//     this avoids: a skerry further off than the dome with the sun shining
//     through it. At the far plane nothing is ever behind it.
//   * NOTHING IN THE STACK WRITES DEPTH, so the pieces still paint over each
//     other in `renderOrder`, exactly as they would have if the sky were the
//     first thing in the frame.
//
// This does NOT reach anything that is a thing at a PLACE. The wake and the
// spray are `transparent`, which three draws after every opaque object
// anyway and depth-tests at their own distance — which is right for them.

import * as THREE from "three";

/** Where the backdrop's stack sits in the opaque pass: past anything the
 * world or the craft sets, so the sky is the last opaque thing submitted
 * whatever else is on screen. The transparent pass still runs after all of
 * it, which is what keeps the spray over the sky rather than under it. */
export const SKY_ORDER = 1000;

/** Push the vertex to the far plane, then close `main`. Appended to the END
 * of the vertex shader so it lands after `#include <project_vertex>` has
 * written `gl_Position`, whatever the material is made of. */
const AT_FAR_PLANE = "\tgl_Position.z = gl_Position.w;\n}";

/**
 * Draw this material as BACKDROP: depth-tested against the world so the
 * covered pixels cost nothing, at a depth no solid can be behind, and
 * writing no depth of its own so the rest of the stack still paints over it.
 *
 * The graft goes in through `onBeforeCompile`, which the renderer runs
 * against the parameters it is about to compile — so it reaches a built-in
 * material and a `ShaderMaterial` alike. Three's default program cache key
 * is `onBeforeCompile.toString()`, so a grafted material re-keys itself and
 * cannot pick up the cached program of an identical one that was not
 * grafted.
 */
export function drawAsBackdrop(material: THREE.Material): void {
  material.depthTest = true;
  material.depthWrite = false;
  material.onBeforeCompile = (shader) => {
    // The last `}` in the source closes `main`; three emits no function
    // after it.
    shader.vertexShader = shader.vertexShader.replace(/\}\s*$/, AT_FAR_PLANE);
  };
}
