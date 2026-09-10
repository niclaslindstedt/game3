// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CRAFT'S SURFACE — the one lit material the hull and the rider are
// drawn with, and the per-vertex FINISH that lets one material be gel coat,
// rubber, vinyl, chrome, wet neoprene and a helmet's shell at once.
//
// The craft is lit by the SCENE: the same hemisphere and key that light the
// water it is sitting on (environment.ts), through `MeshPhongMaterial` over
// the flat face normals the low-poly builder writes. A Lambert craft is the
// colour of its paint and nothing else, and what makes a hull read as a
// HULL rather than as a coloured shape is what a low sun does to it: the
// highlight that runs down a flank as it rolls, and the sky lying along
// its sheer. Phong is the cheapest model with the first; the second is
// grafted on below.
//
// THE MIRROR. A gel-coated hull and a helmet's shell reflect the sky over
// them, and over open water that sky is most of what a rider sees. So the
// surface carries `skyAlong` (sky-glsl.ts) — THE SAME function the dome is
// painted with and the water reflects, on THE SAME uniform bundle — and
// mixes the sky along the reflected ray into the lit colour by Schlick's
// Fresnel, scaled by the vertex's finish. Four per cent looking straight at
// a panel, most of it at grazing: a white hull at noon stays white, and at
// sunset the same hull takes the glow along its rail and the sea's dusk
// under its chine, because it is reflecting the sky that is actually there
// rather than a colour somebody chose for it. Reflected as a ROUGH mirror
// (`mirrorBuild`), for the water's reason: a cloud's edge reflected sharp
// across a hull's facets is a hard streak, not a cloud.
//
// ONE MATERIAL, MANY SURFACES. The hull, the deck, the rail, the saddle,
// the bars and the rider are two merged meshes and two draw calls, and a
// gel-coated bottom and a rubber rail want completely different highlights.
// So the difference rides the GEOMETRY — `aShine`, written per vertex by the
// builder's finish pen (`lowpoly.ts`) from the `FINISH` table — and the
// grafts scale the specular and the mirror by it. A craft whose grips flare
// like its hull reads as a plastic toy; one whose gel coat is as dead as its
// grips reads as a primed shell.
//
// The SHININESS stays one number for the whole craft, because the exponent
// is what the highlight's SIZE comes from and the size that suits gel coat
// is close enough to the one that suits chrome at the range a hull is seen
// from. It is the strength that has to differ, and that is what rides the
// vertex.
//
// Not every craft has a sky over it — the craft card's turntable lights
// its own little scene, and the contact sheet's rasteriser reads the
// geometry alone — so the sky is optional: without one the surface is the
// same Phong with its finishes and no mirror, lit by whatever rig the
// caller stood up.

import * as THREE from "three";

import { mirrorBuild, skyGlsl, type SkyUniforms } from "./sky-glsl.ts";

/**
 * WHAT EVERYTHING ON THE WATER IS FINISHED IN, 0..1 — the weight on the
 * highlight and on the mirror. A wet surface is glossier than a dry one,
 * and everything here is wet: the rider's skin and his neoprene both carry
 * a sheen a dry man would not.
 */
export const FINISH = {
  /** The hull's shell, keel to rail: polished gel coat, the glossiest thing
   * in the frame. */
  gelcoat: 1,
  /** The deck's paint: satin, with a non-slip texture over most of it. Well
   * under the shell's on purpose — the deck CARRIES THE COLOUR (the styles
   * are built on it) and it is the SHADOW side of the craft under a low sun,
   * so dark that a few per cent of a sunset sky outweighs it: a deck as
   * glossy as the hull hands its teal to the sky at every angle the chase
   * camera looks down on it from. */
  paint: 0.35,
  /** The bars, the stalks and the handle: polished metal. */
  chrome: 1,
  /** The sponsons, the pump housing, the pod: moulded plastic. */
  moulding: 0.4,
  /** The saddle's vinyl, and the lighter insert stitched over it. */
  vinyl: 0.3,
  /** The rail, the bumper, the step, the grips and the bar pad. */
  rubber: 0.08,
  /** The footwell mats and the intake grate. */
  mat: 0.12,
  /** A helmet's shell and its visor: the two things on a rider that flare. */
  shell: 1,
  /** Wet neoprene, and wet skin — a sheen, not a shine: the suit is dark
   * and the same shadow-side arithmetic as the deck's applies to it. */
  neoprene: 0.35,
  skin: 0.35,
  /** The vest's nylon and its straps, the gloves, the boots. */
  cloth: 0.2,
  /** The moulded guards over the knees and the shins. */
  pad: 0.55,
} as const;

/** How tight the highlight is. A gel coat's sun is a pin of light, and a
 * pin that swings off one facet onto the next as the hull rolls is what
 * reads as a rolling hull; but the facets are FLAT, so a lobe tighter than
 * a facet is wide is a highlight that is on no facet at all most of the
 * time. This is a lobe about a facet wide. */
const SHININESS = 32;

/** …and the colour of it: the light's own, taken down. A specular at full
 * white on every facet is a hull wrapped in foil under a low sun; this is
 * the value at which a facet that catches the sun square goes to the sun's
 * colour and the ones beside it stay paint — and the finish takes it lower
 * still on everything that is not the shell or the chrome. */
const SPECULAR = 0x8a8a8a;

/** Schlick's reflectance at normal incidence for a dielectric — paint,
 * lacquer, a visor's polycarbonate: four per cent. */
const F0 = 0.04;

/** How much of the sky a fully finished surface takes at grazing. Under
 * one: a hull's facets are flat and its mirror is a rough one, so even its
 * rail does not go the sky's colour outright — it takes most of it and
 * keeps its own lit tone under. */
const MIRROR = 0.7;

/** The name every surface carries, and the cache key's stem. */
export const CRAFT_SURFACE = "craft-surface";

export type CraftSurface = THREE.MeshPhongMaterial;

/** THE FINISH AS THE LIGHT READS IT: squared. The table is written as
 * "how polished", and the eye's scale for that is not the light's — a
 * satin deck at half a polished shell's finish reflects a QUARTER of the
 * shell's sun and sky, which is what lets the deck keep its colour while
 * the shell beside it takes the sunset. Both the highlight and the mirror
 * read this one line. */
const GLOSS_GLSL = /* glsl */ `float gloss = vShine * vShine;`;

/** The GLSL that puts the sky on a facet, standing in for three's own
 * environment map: the reflected ray, back in the world, into `skyAlong`
 * from the fragment's own place — so a cloud sheet overhead is pierced
 * where it is — by the Fresnel share, by the gloss. */
const MIRROR_GLSL = /* glsl */ `
{
  vec3 V = normalize( vViewPosition );
  vec3 R = inverseTransformDirection( reflect( - V, normal ), viewMatrix );
  float cosV = clamp( dot( normal, V ), 0.0, 1.0 );
  float F = ${F0.toFixed(3)} + ${(1 - F0).toFixed(3)} * pow( 1.0 - cosV, 5.0 );
  outgoingLight = mix( outgoingLight, skyAlong( R, vSurfaceWorld ), F * gloss * ${MIRROR.toFixed(3)} );
}`;

/**
 * A lit surface for a craft and its rider.
 *
 * `vertexColors` is always on: the colour attribute is the ALBEDO the
 * builder wrote, and Phong multiplies its diffuse by it exactly as Lambert
 * did. `sky` is the SHARED uniform bundle `environment.ts` writes the sky
 * into — the very objects the dome's and the water's materials hold — and
 * with it the surface reflects the sky over it; without it, it only shines.
 */
export function craftSurface(sky?: SkyUniforms): CraftSurface {
  const material = new THREE.MeshPhongMaterial({
    name: CRAFT_SURFACE,
    vertexColors: true,
    flatShading: true,
    specular: new THREE.Color(SPECULAR),
    shininess: SHININESS,
  });
  material.userData.skyLayers = 0;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute float aShine;
varying float vShine;
varying vec3 vSurfaceWorld;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vShine = aShine;`,
      )
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
vSurfaceWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;`,
      );
    // `specularmap_fragment` is where three decides `specularStrength` —
    // from a map if there is one, 1.0 if not — so the finish lands right
    // after it and scales whatever it decided.
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying float vShine;
varying vec3 vSurfaceWorld;
${sky ? skyGlsl(mirrorBuild(material.userData.skyLayers as number)) : ""}`,
      )
      .replace(
        "#include <specularmap_fragment>",
        `#include <specularmap_fragment>
${GLOSS_GLSL}
specularStrength *= gloss;`,
      );
    if (sky) {
      // The bundle's own objects, not copies: a sky written once by the
      // environment is read here as well.
      Object.assign(shader.uniforms, sky);
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <envmap_fragment>",
        MIRROR_GLSL,
      );
    }
  };
  // Three's default key is `onBeforeCompile.toString()`, which is the same
  // text for a surface with a sky and one without, and for every sheet
  // count: the key has to say what the source was compiled for.
  material.customProgramCacheKey = () =>
    `${CRAFT_SURFACE}|${sky ? `sky${material.userData.skyLayers as number}` : "studio"}`;
  return material;
}

/**
 * HOW MANY CLOUD SHEETS the mirror carries — the one thing about the sky
 * this surface has to be recompiled for, as the water is (`applySky`).
 * Cheap to call every frame: a change is a recompile, the same count is a
 * comparison.
 */
export function applyCraftSky(m: CraftSurface, layers: number): void {
  if (m.userData.skyLayers === layers) return;
  m.userData.skyLayers = layers;
  m.needsUpdate = true;
}
