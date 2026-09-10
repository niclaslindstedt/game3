// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKY, AS ONE SURFACE — a sphere seen from inside, every pixel of it
// `skyAlong` (sky-glsl.ts): the gradient, the warm bleed round the sun, the
// sun's disc with its glare and halo, and the cloud SHEETS of
// `cloud-field.ts` at the real altitudes the cloud chart puts them, each
// projected onto the view ray in perspective.
//
// THAT PERSPECTIVE IS THE WHOLE DIFFERENCE between this and a ring of
// billboards. A sheet is a plane at an altitude, so the ray pierces it
// nearer overhead and further out toward the rim: the cells foreshorten,
// crowd and fade into the haze exactly the way a real sky does, and the
// horizon fills with cloud instead of ending in a ring of puffs floating on
// the water. It is also the only way the sky can have DEPTH — a cirrus veil
// eight kilometres up and cumulus a kilometre over the water, at their own
// two paces on the same wind — which is what a sky worth looking at is made
// of.
//
// IT RIDES THE CAMERA IN ALL THREE AXES, which is what makes it a sky rather
// than a dome the rider can climb out of: from a hull thrown four metres up
// off a ramp the horizon band must still be at the eye's height. The sheets
// do not ride with it — they are things at ALTITUDES, and `skyAlong` is
// given the eye's real world position so a rider four metres up is four
// metres nearer the ceiling.
//
// It is BACKDROP (sky-depth.ts) — drawn last in the opaque pass, at the far
// plane, writing no depth — so a skerry between the rider and the sun
// occludes it, and the pixels the world already covered are never shaded.
// That matters more here than anywhere else in the frame: this is the
// dearest fragment shader the game has.

import * as THREE from "three";

import { MAX_LAYERS, type CloudLayer, type SkyDressing } from "./cloud-field.ts";
import { SKY_ORDER, drawAsBackdrop } from "./sky-depth.ts";
import {
  createSkyUniforms,
  skyGlsl,
  writeDrift,
  writeLayers,
  writeNight,
  writeSky,
  writeSun,
  type SkyBuild,
  type SkyUniforms,
} from "./sky-glsl.ts";
import { DOME_RADIUS, RIM_BAND, type Preset } from "./sky.ts";
import type { SkyTurn } from "./starfield.ts";

/** How the sky is drawn at each stop of the picture ladder: how many octaves
 * of noise a sheet is read at, whether the clouds are lit by a second sample
 * toward the sun, and how many sheets may be stacked at once. */
export type SkyLook = { octaves: number; sunlit: boolean; layers: number };

const VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vWorld = ( modelMatrix * vec4( position, 1.0 ) ).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

function fragmentFor(build: SkyBuild): string {
  return /* glsl */ `
#include <common>
varying vec3 vWorld;
${skyGlsl(build)}
void main() {
  gl_FragColor = vec4( skyAlong( normalize( vWorld - cameraPosition ), cameraPosition ), 1.0 );
  // THE SKY IS MIXED IN LINEAR LIGHT AND WRITTEN IN sRGB, exactly the way
  // three's own materials do it. Every colour that reaches this shader came
  // out of sky.ts through THREE.Color.set, which converts an sRGB hex to
  // linear on the way in; writing that straight to the framebuffer skips the
  // conversion back and hands out a sky about half as bright as the one that
  // was authored. Everything ELSE in the scene converts — the terrain, the
  // water, the fog they fade into — so the fault does not read as "the sky
  // is dark": it reads as a far shore glowing brighter than the sky behind
  // it, which is the one thing distance can never do.
  #include <colorspace_fragment>
}
`;
}

export type SkyDome = {
  /** The dome. Added to the scene by the caller — it rides the camera, so it
   * is moved rather than parented. */
  mesh: THREE.Mesh;
  /** The uniforms the sky is written into, SHARED with the water's material
   * so the sea reflects the dome that is actually over it. */
  uniforms: SkyUniforms;
  /** Dress the sky in this stack of sheets at this stop of the picture
   * ladder. Once per level and per stop: it recompiles when the ladder or
   * the stack has actually moved. */
  dress: (dressing: SkyDressing, look: SkyLook) => void;
  /** Paint the sky this preset. Every frame — the sun moves. */
  apply: (p: Preset) => void;
  /** Where the sphere of stars has turned to this frame. */
  setTurn: (turn: SkyTurn, dt: number) => void;
  /** Where the real sun and the key stand, and how much of the sun's disc is
   * getting through whatever is in front of it. */
  setSun: (sun: THREE.Vector3, key: THREE.Vector3, through: number) => void;
  /** How lit each drawn sheet is at its own altitude, 0..1 — the sun sets on
   * the water before it sets on a cirrus eight kilometres up. */
  setLit: (lit: (layer: CloudLayer) => number) => void;
  /** Advance the sheets on the wind, m/s. */
  tick: (windX: number, windZ: number, dt: number) => void;
  /** Follow the lens. */
  update: (eyeX: number, eyeY: number, eyeZ: number) => void;
  /** The sheets as drawn, with their live offsets — for the CPU to ask the
   * same field how much cloud is over the sun. */
  layers: () => { layer: CloudLayer; offsetX: number; offsetZ: number }[];
  wind: () => { x: number; z: number };
  dispose: () => void;
};

export function createSkyDome(uniforms: SkyUniforms = createSkyUniforms()): SkyDome {
  /** What the source standing in the material was compiled for. One shallow
   * sheet until the first `apply` says otherwise — the dome is not drawn
   * before then, and a build nobody renders costs nothing. */
  let built: SkyBuild = {
    octaves: 4,
    layers: 0,
    sunlit: false,
    sun: true,
    rimBand: RIM_BAND,
    soften: 0,
    skyline: 0,
    rimCurve: 1.5,
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: fragmentFor(built),
    side: THREE.BackSide,
    fog: false,
  });
  drawAsBackdrop(material);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(DOME_RADIUS, 32, 18), material);
  mesh.renderOrder = SKY_ORDER - 3;
  mesh.frustumCulled = false;

  let drawn: CloudLayer[] = [];
  let cloudOpacity = 1;
  let lit: (layer: CloudLayer) => number = () => 1;
  const offsets = Array.from({ length: MAX_LAYERS }, () => ({ x: 0, z: 0 }));
  const windUnit = { x: 0, z: 1 };

  /** Recompile, but only when the look or the stack has actually moved:
   * three rebuilds the program on `needsUpdate`, and a shader rebuilt every
   * frame is a stall every frame. */
  const rebuild = (next: SkyBuild): void => {
    if (
      next.octaves === built.octaves &&
      next.sunlit === built.sunlit &&
      next.layers === built.layers
    ) {
      return;
    }
    built = next;
    material.fragmentShader = fragmentFor(next);
    material.needsUpdate = true;
  };

  const apply = (p: Preset): void => {
    writeSky(uniforms, p);
    if (cloudOpacity !== p.cloudOpacity) {
      cloudOpacity = p.cloudOpacity;
      writeLayers(uniforms, drawn, cloudOpacity, lit);
    }
  };

  const dress = (dressing: SkyDressing, look: SkyLook): void => {
    // THE STACK THE LOOK WILL PAY FOR. Every sheet is a whole field of noise
    // sampled on every sky pixel, so this is the sky's steepest lever after
    // the depth — and which sheets go is a question about the SKY rather
    // than about their altitudes, which is what `rank` answers
    // (cloud-field.ts). Take the lowest ranks, then put them back in
    // altitude order, because that is the order the loop paints in.
    drawn = [...dressing.layers]
      .sort((a, b) => a.rank - b.rank)
      .slice(0, Math.min(look.layers, MAX_LAYERS))
      .sort((a, b) => a.altitude - b.altitude);
    rebuild({ ...built, octaves: look.octaves, sunlit: look.sunlit, layers: drawn.length });
    writeLayers(uniforms, drawn, cloudOpacity, lit);
    writeDrift(uniforms, drawn, offsets, windUnit.x, windUnit.z);
  };

  const tick = (windX: number, windZ: number, dt: number): void => {
    const speed = Math.hypot(windX, windZ);
    if (speed > 0.05) {
      windUnit.x = windX / speed;
      windUnit.z = windZ / speed;
    }
    // A cloud moves WITH the wind, so the field is read further back along
    // it as time passes.
    drawn.forEach((layer, i) => {
      offsets[i].x -= windX * layer.drift * dt;
      offsets[i].z -= windZ * layer.drift * dt;
    });
    writeDrift(uniforms, drawn, offsets, windUnit.x, windUnit.z);
  };

  return {
    mesh,
    uniforms,
    dress,
    apply,
    setTurn: (turn, dt) => writeNight(uniforms, turn, dt),
    setSun: (sun, key, through) => writeSun(uniforms, sun, key, through),
    setLit: (next) => {
      lit = next;
      writeLayers(uniforms, drawn, cloudOpacity, lit);
    },
    tick,
    update: (eyeX, eyeY, eyeZ) => mesh.position.set(eyeX, eyeY, eyeZ),
    layers: () =>
      drawn.map((layer, i) => ({ layer, offsetX: offsets[i].x, offsetZ: offsets[i].z })),
    wind: () => ({ x: windUnit.x, z: windUnit.z }),
    dispose: () => {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
