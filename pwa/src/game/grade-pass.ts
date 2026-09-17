// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GRADE, AS A PASS — the last thing that happens to a frame.
//
// The whole picture is drawn into a texture instead of onto the canvas, and
// then ONE screen-filling triangle pair reads that texture back, grades it
// (`colour-grade.ts` says what a coast's grade IS, and its `gradeTone` is
// this shader's arithmetic in TypeScript) and writes the canvas. That is the
// order a television series is finished in, and it is the only order that
// gets the answer right here for two reasons:
//
//   ONCE PER PIXEL. Grading inside the materials instead — three's own
//   `CustomToneMapping` hook will inject a function into every one of them —
//   costs no pass at all, and grades every LAYER of a transparent pixel
//   separately before they are blended. The sea is transparent over its own
//   bed, the spray is hundreds of blended sprites right in front of the
//   lens, and the rain is a sheet over the lot: a saturation applied four
//   times through a plume of spray is not the saturation that was authored.
//   A grade is a statement about the finished picture, so it is applied to
//   the finished picture.
//
//   ONE MATERIAL, ONE SET OF UNIFORMS. The injected hook has nowhere to put
//   a uniform — three supplies the tone mapper's exposure and nothing else —
//   so a per-coast grade would have to be baked into the source as literals
//   and every material in the scene recompiled on the way to a new coast.
//   Here the coast changes seven dials on one material.
//
// THE COLOUR ROUND TRIP, which is the part that goes wrong silently. Three
// compiles a shader for LINEAR output whenever it is drawing into a render
// target, whatever that target's texture says — so the scene writes linear
// light into this one. An eight-bit linear buffer bands visibly in the
// darks, and a half-float one is eight bytes a pixel of bandwidth on a
// phone; the way out is the target's own colour space: with `SRGBColorSpace`
// on the texture, three allocates it as `SRGB8_ALPHA8` and the GPU encodes
// on every write and decodes on every read, for free and in hardware. So the
// picture is stored with sRGB's precision where the eye needs it and this
// shader still samples the linear light the scene computed. It then writes
// the canvas through `#include <colorspace_fragment>` like every other
// hand-written shader here.
//
// THE ANTI-ALIASING MOVES WITH THE PICTURE. Everything with an edge in it is
// now drawn off-screen, so the samples have to be there too and the canvas's
// own context asks for none: a multisampled default framebuffer would only be
// resolving a screen-filling triangle that has no edges. How many samples is
// `pictureSamples`, read off the device's own pixel ratio rather than off a
// video row — the reasoning is stated there.

import * as THREE from "three";

import { type ColourGrade, gradeColour } from "./colour-grade.ts";
import { pictureSamples } from "./settings-video.ts";

/** Mid grey in the perceptual coordinate — `sqrt(0.18)`. The pivot the
 * contrast turns about; `colour-grade.ts`'s header says why it is not 0.18. */
const MID_P = "0.42426407";

const VERTEX = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  // The geometry IS clip space: a 2×2 plane's own corners, straight through.
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}
`;

const FRAGMENT = /* glsl */ `
uniform sampler2D uPicture;
uniform float uContrast;
uniform float uLift;
uniform float uSaturation;
uniform vec3 uTint;
uniform vec3 uShade;
uniform vec3 uGlow;
uniform vec2 uSplit;

varying vec2 vUv;

const float MID_P = ${MID_P};
const vec3 LUMA = vec3( 0.2126, 0.7152, 0.0722 );

void main() {
  vec4 picture = texture2D( uPicture, vUv );
  vec3 c = picture.rgb;

  // THE CONTRAST, then THE LIFT, in the perceptual coordinate: a gain about
  // mid grey, then the blacks off the floor. Lifting first would only hand
  // the contrast something to put straight back. The clamp is load-bearing:
  // a contrast over 1 takes the coordinate negative in the darks, and
  // squaring a negative lifts the black it was supposed to crush.
  vec3 s = MID_P + ( sqrt( max( c, 0.0 ) ) - MID_P ) * uContrast;
  s = max( s + uLift * ( 1.0 - s ), 0.0 );
  c = s * s;

  // THE SATURATION, about the pixel's own light. Clamped because a
  // saturation over 1 takes the weakest channel of a strong colour below
  // zero — a turquoise sea has almost no red in it — and the split below
  // weighs what comes out of here.
  float l = dot( c, LUMA );
  c = max( l + ( c - l ) * uSaturation, 0.0 );

  // THE CAST — luminance-normalised on the way in, so it turns the picture
  // without dimming it.
  c *= uTint;

  // THE SPLIT: the darks toward one colour and the lights toward another,
  // weighted by the graded pixel's own light in the same coordinate the
  // contrast used, so the two ends land where the eye reads them.
  float w = clamp( sqrt( max( dot( c, LUMA ), 0.0 ) ), 0.0, 1.0 );
  float shade = uSplit.x * ( 1.0 - w );
  float glow = uSplit.y * w;
  c *= 1.0 - shade + shade * uShade;
  c *= 1.0 - glow + glow * uGlow;

  gl_FragColor = vec4( c, picture.a );
  #include <colorspace_fragment>
}
`;

export type GradePass = {
  /** WHERE THE FRAME IS DRAWN. The renderer binds this, draws the scene into
   * it, unbinds, and calls `render`. */
  readonly target: THREE.WebGLRenderTarget;
  /** Size it in DEVICE pixels — the drawing buffer's own size, not the
   * canvas's CSS box, so the picture is graded at the resolution it was
   * drawn at rather than resampled through a second one. */
  setSize: (w: number, h: number) => void;
  /** The coast's grade. Eight numbers on one material — no recompile, so it
   * can be set from `load` on the frame a new coast arrives. */
  setGrade: (grade: ColourGrade) => void;
  /** Read the picture back, grade it, write the canvas; what the pass cost. */
  render: (renderer: THREE.WebGLRenderer) => { calls: number; triangles: number };
  dispose: () => void;
};

export function createGradePass(): GradePass {
  const target = new THREE.WebGLRenderTarget(4, 4, {
    // The picture is read back exactly once, at exactly its own size: there
    // is nothing for a mip chain or a wrap mode to do, and building one
    // would be a second full-screen cost for a texture nobody minifies.
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
    // See the header: this is what makes an eight-bit buffer enough.
    colorSpace: THREE.SRGBColorSpace,
    samples: pictureSamples(),
  });
  target.texture.wrapS = target.texture.wrapT = THREE.ClampToEdgeWrapping;

  const uniforms = {
    uPicture: { value: target.texture },
    uContrast: { value: 1 },
    uLift: { value: 0 },
    uSaturation: { value: 1 },
    uTint: { value: new THREE.Vector3(1, 1, 1) },
    uShade: { value: new THREE.Vector3(1, 1, 1) },
    uGlow: { value: new THREE.Vector3(1, 1, 1) },
    uSplit: { value: new THREE.Vector2(0, 0) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    // The triangles cover every pixel and there is nothing behind them.
    depthTest: false,
    depthWrite: false,
  });

  // A 2×2 plane whose corners ARE the clip-space corners (see the vertex
  // shader), on a camera that is only there because `render` wants one: the
  // vertex shader never reads a matrix, so nothing about the camera can move
  // the picture. Culling is off for the same reason — a mesh whose world
  // bounds are a unit square at the origin is culled from most lenses.
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.Camera();

  const rgb: [number, number, number] = [0, 0, 0];
  const cast = (hex: string, into: THREE.Vector3): void => {
    gradeColour(hex, rgb);
    into.set(rgb[0], rgb[1], rgb[2]);
  };

  return {
    target,
    setSize: (w, h) => {
      const wide = Math.max(1, Math.round(w));
      const high = Math.max(1, Math.round(h));
      if (target.width !== wide || target.height !== high) target.setSize(wide, high);
    },
    setGrade: (grade) => {
      uniforms.uContrast.value = grade.contrast;
      uniforms.uLift.value = grade.lift;
      uniforms.uSaturation.value = grade.saturation;
      cast(grade.tint, uniforms.uTint.value);
      cast(grade.shade, uniforms.uShade.value);
      cast(grade.glow, uniforms.uGlow.value);
      uniforms.uSplit.value.set(grade.split[0], grade.split[1]);
    },
    render: (renderer) => {
      renderer.render(scene, camera);
      return {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      };
    },
    dispose: () => {
      target.dispose();
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
