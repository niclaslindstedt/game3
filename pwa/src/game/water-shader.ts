// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW THE WATER IS LIT — the one material both water grids are drawn with,
// and the reason the sea reads as a sea rather than as a sheet with a
// highlight on it. The grid (`water-mesh.ts`) says WHERE the surface is:
// every vertex is the engine's own `surfaceAt`, and nothing here moves one.
// This says what the light does when it gets there, per pixel:
//
//   THE BODY     the vertex colour — the depth's tint, the crest's lift —
//                lit by the same two lights as everything else on the
//                coast, plus the light that comes THROUGH a crest with the
//                sun behind it, which is the green a wave goes at sunset.
//   THE MIRROR   Schlick's Fresnel on the real angle: water reflects two
//                per cent looking straight down and everything at a
//                grazing angle, so the sea is its own colour under the
//                rider and sky out toward the horizon. What it reflects is
//                the sky's OWN gradient (`sky.ts`'s `skyToneAt`, restated
//                in GLSL) in whichever direction each wave face happens to
//                point — a sunset lays its orange along the faces turned
//                toward it and leaves the backs blue.
//   THE GLINT    the sun's image in the surface, in two lobes: a tight one
//                over the RIPPLES, which is the sparkle, and a broad one
//                over the swell, which is the road a low sun lays across
//                the water toward the rider. Both are the beam's — a sun
//                behind a squall's ceiling has no image to give.
//   THE RIPPLES  the wind's capillary chop, too fine for any grid: a normal
//                tile made in code, scrolled downwind at two scales, and
//                faded with distance where its own mip levels would have
//                flattened it anyway. It changes the light and never the
//                surface, so a probe reading the same water agrees.
//   THE FOAM     the vertex's foam SHARE (the colour attribute's alpha),
//                broken up by the foam tile the wake is drawn with, so a
//                whitecap is streaks and holes rather than a white vertex.
//   THE WINDOW   what is LEFT after the mirror has taken its share is what
//                went through, and the water is drawn transparent by
//                exactly that much: `alpha = mix(aWindow, 1, F) + foam`.
//                The same Schlick term that decides how much sky a face
//                shows decides how much of what is under it shows, which
//                is the one place the two can never disagree — the sea is
//                a window under the rider and a mirror out toward the
//                horizon, for one reason rather than two. `aWindow` is the
//                grid's own per-vertex opacity looking STRAIGHT DOWN (the
//                water column's, so the shallows are clear and the deep is
//                not); the far grid sets it to 1 and is opaque whatever
//                the angle. Foam is opaque because foam is air in water.
//
// Everything is mixed in linear light and converted once at the end, the
// way three's own materials do it, so the sea and the hull beside it are
// under one exposure.

import * as THREE from "three";
import { valueNoise } from "@engine";

import { PALETTE } from "../identity.ts";
import { TEXTURE_ANISOTROPY, foamTexture } from "./fx-textures.ts";
import { GLOW_FOCUS, GLOW_REACH, seaReflection, type Preset } from "./sky.ts";

/** The ripple tile: texels a side, and its edge in metres at the fine
 * scale. The coarse layer is the same tile at `RIPPLE_COARSE` times that,
 * scrolled slower, so the two never line up and the tiling never shows. */
const RIPPLE_SIZE = 256;
const RIPPLE_METRES = 2.4;
const RIPPLE_COARSE = 3.7;
/** The slope the tile's normals are scaled to, RMS — how steep a ripple is
 * for the light. Set here rather than in the shader so the texture is the
 * one place a ripple has a shape. */
const RIPPLE_RMS_SLOPE = 0.22;
/** How much of the tile's slope the surface takes with no wind and per
 * m/s of it: a glassy calm still has a skin, a fresh breeze roughens it. */
const RIPPLE_BASE = 0.2;
const RIPPLE_PER_WIND = 0.022;
/** How fast the ripples travel downwind, tile lengths per second, with no
 * wind and per m/s of it. Slower than a real capillary wave's phase speed:
 * the tile is a texture and a texture at full pace strobes. */
const RIPPLE_PACE = 0.25;
const RIPPLE_PACE_PER_WIND = 0.018;
/** Where the ripples begin to fade, m from the lens, and where they are
 * gone. Past that the broad lobe carries the roughness. */
const RIPPLE_FADE = [60, 260] as const;
/** The foam tile's edge, m. */
const FOAM_METRES = 3.5;
/** How far the coarse ripple layer is turned off the wind, rad: the two
 * layers share one tile, and laid the same way they tile together into
 * corduroy. */
const COARSE_TURN = 0.7;

/** The ripple tile: the wind's short chop as a repeating normal map, the
 * slopes in red (east) and green (north), made once. Directional sines
 * whose wave numbers are whole so the tile repeats, crests across the
 * downwind axis (the tile's v), and value noise on a period that divides
 * the tile so nothing has a seam. */
let ripple: THREE.DataTexture | null = null;
function rippleTexture(): THREE.DataTexture {
  if (ripple) return ripple;
  const n = RIPPLE_SIZE;
  const h = new Float32Array(n * n);
  // (across, downwind, amplitude): a short wind sea, the amplitude falling
  // with the wave number, the crests slewed well off square so no two run
  // parallel — parallel crests seen along the water are corduroy — and
  // as much noise again on top, because a real wind skin is mostly
  // disorder with a direction in it.
  const waves: [number, number, number][] = [
    [2, 5, 1],
    [-3, 8, 0.7],
    [4, 11, 0.55],
    [-5, 15, 0.4],
    [7, 19, 0.3],
    [-6, 27, 0.22],
    [9, 35, 0.15],
  ];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let s = 0;
      for (const [kx, ky, amp] of waves) {
        const phase = ((kx * x + ky * y) / n) * Math.PI * 2 + amp * 7;
        s += amp * Math.sin(phase);
      }
      s +=
        1.6 * (valueNoise(x, y, n / 8, 5) - 0.5) +
        1.2 * (valueNoise(x, y, n / 16, 11) - 0.5) +
        0.7 * (valueNoise(x, y, n / 32, 23) - 0.5);
      h[y * n + x] = s;
    }
  }
  // Central differences on the torus, then the whole field scaled to the
  // slope the light is meant to see.
  const sx = new Float32Array(n * n);
  const sy = new Float32Array(n * n);
  let sum = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      sx[i] = (h[y * n + ((x + 1) % n)] - h[y * n + ((x + n - 1) % n)]) / 2;
      sy[i] = (h[((y + 1) % n) * n + x] - h[((y + n - 1) % n) * n + x]) / 2;
      sum += sx[i] * sx[i] + sy[i] * sy[i];
    }
  }
  const gain = RIPPLE_RMS_SLOPE / Math.sqrt(sum / (n * n));
  const data = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) {
    const nx = -sx[i] * gain;
    const nz = -sy[i] * gain;
    const inv = 1 / Math.hypot(nx, 1, nz);
    data[i * 4] = Math.round((nx * inv * 0.5 + 0.5) * 255);
    data[i * 4 + 1] = Math.round((nz * inv * 0.5 + 0.5) * 255);
    data[i * 4 + 2] = Math.round(inv * 255);
    data[i * 4 + 3] = 255;
  }
  ripple = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  ripple.wrapS = ripple.wrapT = THREE.RepeatWrapping;
  ripple.minFilter = THREE.LinearMipmapLinearFilter;
  ripple.magFilter = THREE.LinearFilter;
  ripple.generateMipmaps = true;
  // Seen along the water: without this the ripples are streaks radiating
  // from the lens and the sea reads as brushed metal.
  ripple.anisotropy = TEXTURE_ANISOTROPY;
  ripple.needsUpdate = true;
  return ripple;
}

const VERTEX = `
  attribute float aWindow;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec4 vColor;
  varying float vHeight;
  varying float vWindow;
  #include <fog_pars_vertex>
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    // The grids only ever translate, so an object normal is a world one.
    vNormal = normal;
    vColor = color;
    vHeight = position.y;
    vWindow = aWindow;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

const FRAGMENT = `
  #include <common>
  uniform sampler2D uRipple;
  uniform sampler2D uFoam;
  uniform float uTime;
  uniform vec4 uWindRot;
  uniform float uRipplePace;
  uniform float uRippleStrength;
  uniform vec3 uHemiSky;
  uniform vec3 uHemiGround;
  uniform vec3 uKey;
  uniform vec3 uSunDir;
  uniform vec3 uGlint;
  uniform vec3 uScatter;
  uniform float uScatterHeight;
  uniform vec3 uSkyHorizon;
  uniform vec3 uSkyZenith;
  uniform vec3 uSkyGlow;
  uniform float uGlowStrength;
  uniform float uSkyBand;
  uniform float uSkyCurve;
  uniform vec2 uSunBearing;
  uniform vec3 uFoamColor;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec4 vColor;
  varying float vHeight;
  varying float vWindow;
  #include <fog_pars_fragment>

  // The sky in direction R — sky.ts's skyToneAt, in GLSL: the gradient on
  // the sine of the elevation, the glow round the sun's bearing. Below the
  // skyline a face reflects the sea, which is darker than any sky.
  vec3 skyToward(vec3 R) {
    float up = clamp(R.y / uSkyBand, 0.0, 1.0);
    vec3 tone = mix(uSkyHorizon, uSkyZenith, pow(up, uSkyCurve));
    vec2 plan = R.xz / max(1e-4, length(R.xz));
    float toward = max(0.0, dot(plan, uSunBearing));
    float w = pow(toward, ${GLOW_FOCUS.toFixed(1)}) * pow(1.0 - max(0.0, R.y), ${GLOW_REACH.toFixed(1)}) * uGlowStrength;
    tone = mix(tone, uSkyGlow, min(1.0, w));
    return tone * (1.0 - 0.5 * clamp(-R.y * 6.0, 0.0, 1.0));
  }

  void main() {
    vec3 toEye = cameraPosition - vWorld;
    float away = length(toEye);
    vec3 V = toEye / max(1e-3, away);
    vec3 N = normalize(vNormal);

    // THE RIPPLES: the tile in wind space, the fine layer and the coarse,
    // scrolled downwind, faded with distance.
    mat2 wind = mat2(uWindRot.x, uWindRot.y, uWindRot.z, uWindRot.w);
    mat2 turn = mat2(${Math.cos(COARSE_TURN).toFixed(4)}, ${Math.sin(COARSE_TURN).toFixed(4)}, ${(-Math.sin(COARSE_TURN)).toFixed(4)}, ${Math.cos(COARSE_TURN).toFixed(4)});
    vec2 tile = wind * vWorld.xz;
    vec2 fine = tile / ${RIPPLE_METRES.toFixed(2)} + vec2(0.0, -uTime * uRipplePace);
    vec2 coarse = (turn * tile) / ${(RIPPLE_METRES * RIPPLE_COARSE).toFixed(2)} + vec2(0.13, -uTime * uRipplePace * 0.31);
    vec2 slope = (texture2D(uRipple, fine).rg * 2.0 - 1.0) * 0.6 + ((texture2D(uRipple, coarse).rg * 2.0 - 1.0) * turn) * 0.4;
    float detail = uRippleStrength * (1.0 - smoothstep(${RIPPLE_FADE[0].toFixed(1)}, ${RIPPLE_FADE[1].toFixed(1)}, away));
    slope = (slope * detail) * wind;
    vec3 Nd = normalize(N + vec3(slope.x, 0.0, slope.y));

    // THE BODY, lit as three's Lambert lights the hull: the hemisphere by
    // how much the face looks up, the key by its angle to the sun.
    float upness = N.y * 0.5 + 0.5;
    vec3 irradiance = mix(uHemiGround, uHemiSky, upness) + uKey * max(0.0, dot(N, uSunDir));
    vec3 body = vColor.rgb * irradiance * RECIPROCAL_PI;
    // …and the light through a crest with the sun behind it.
    float back = max(0.0, dot(-V, uSunDir));
    float lift = clamp(vHeight / uScatterHeight, 0.0, 1.0);
    body += uScatter * lift * (0.12 + 0.6 * pow(back, 3.0));

    // THE MIRROR.
    float cosV = clamp(dot(Nd, V), 0.0, 1.0);
    float F = 0.02 + 0.98 * pow(1.0 - cosV, 5.0);
    vec3 R = reflect(-V, Nd);
    vec3 col = mix(body, skyToward(R), F);

    // THE GLINT: Fresnel at the half vector, so a low sun's road blazes
    // and a high sun's sparkle stays polite; soft-clipped so the peak
    // goes white rather than past it.
    vec3 H = normalize(uSunDir + V);
    float Fh = 0.02 + 0.98 * pow(1.0 - clamp(dot(H, V), 0.0, 1.0), 5.0);
    float tight = pow(max(0.0, dot(Nd, H)), 900.0);
    float broad = pow(max(0.0, dot(N, H)), 60.0);
    vec3 glint = 1.0 - exp(-uGlint * Fh * (tight * 40.0 + broad * 1.5));

    // THE FOAM: the vertex's share, broken up by the tile — a light share
    // shows only the tile's brightest streaks, and shows them thin; a
    // full one is near solid. Squared, because a tint that read as a
    // faint wash when it was mixed into the vertex reads as a white road
    // once it is streaks with edges.
    float share = vColor.a * vColor.a;
    float pattern = texture2D(uFoam, vWorld.xz / ${FOAM_METRES.toFixed(1)}).a;
    float foam = clamp((pattern - (1.0 - share)) / 0.3, 0.0, 1.0) * (0.25 + 0.75 * share);
    vec3 foamCol = uFoamColor * irradiance * RECIPROCAL_PI;
    col = mix(col + glint, foamCol, foam);

    // THE WINDOW: opaque by the share the mirror took, by the column's own
    // opacity straight down, and wherever there is foam.
    float alpha = clamp(mix(vWindow, 1.0, F) + foam, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
    #include <fog_fragment>
    #include <colorspace_fragment>
  }`;

export type WaterMaterial = THREE.ShaderMaterial;

const SHALLOW = new THREE.Color(PALETTE.seaShallow);

export function createWaterMaterial(): WaterMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uRipple: { value: rippleTexture() },
      uFoam: { value: foamTexture() },
      uTime: { value: 0 },
      uWindRot: { value: new THREE.Vector4(1, 0, 0, 1) },
      uRipplePace: { value: RIPPLE_PACE },
      uRippleStrength: { value: RIPPLE_BASE },
      uHemiSky: { value: new THREE.Color(0xffffff) },
      uHemiGround: { value: new THREE.Color(0x53808c) },
      uKey: { value: new THREE.Color(0xfff2dc) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uGlint: { value: new THREE.Color(0xfff2dc) },
      uScatter: { value: new THREE.Color(0x000000) },
      uScatterHeight: { value: 0.25 },
      uSkyHorizon: { value: new THREE.Color(0xd7e9f0) },
      uSkyZenith: { value: new THREE.Color(0x1f6fd8) },
      uSkyGlow: { value: new THREE.Color(0xfff3c8) },
      uGlowStrength: { value: 0.35 },
      uSkyBand: { value: 1 },
      uSkyCurve: { value: 0.62 },
      uSunBearing: { value: new THREE.Vector2(0, -1) },
      uFoamColor: { value: new THREE.Color(PALETTE.foam) },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    vertexColors: true,
    fog: true,
    // Transparent, and still writing depth. The wake and the spray sit ON
    // the water and depth-test against it, and they are drawn after it
    // because their `renderOrder` is higher than this material's default;
    // the far grid is sunk under the near one and the same depth test is
    // what keeps it from painting over it.
    transparent: true,
    depthWrite: true,
  });
}

/**
 * LIGHT THE WATER FOR A SKY. The two lights are the scene's own, already
 * set for the preset by `environment.ts`, so the sea is lit by exactly what
 * lights the hull; the preset itself says what the wave faces reflect and
 * how much of the sun arrives as a beam to glint.
 */
export function applySky(
  m: WaterMaterial,
  p: Preset,
  hemi: THREE.HemisphereLight,
  key: THREE.DirectionalLight,
): void {
  const u = m.uniforms;
  (u.uHemiSky.value as THREE.Color).copy(hemi.color).multiplyScalar(hemi.intensity);
  (u.uHemiGround.value as THREE.Color).copy(hemi.groundColor).multiplyScalar(hemi.intensity);
  (u.uKey.value as THREE.Color).copy(key.color).multiplyScalar(key.intensity);
  (u.uSunDir.value as THREE.Vector3).copy(key.position).normalize();
  const sea = seaReflection(p);
  (u.uSkyHorizon.value as THREE.Color).set(sea.horizon);
  (u.uSkyZenith.value as THREE.Color).set(sea.zenith);
  (u.uSkyGlow.value as THREE.Color).set(sea.glow);
  u.uGlowStrength.value = sea.glowStrength;
  u.uSkyBand.value = sea.band;
  u.uSkyCurve.value = sea.curve;
  (u.uSunBearing.value as THREE.Vector2).set(Math.sin(p.sunBearing), Math.cos(p.sunBearing));
  // The glint is the sun's own light, at its own strength, for the share
  // of it that is a beam.
  (u.uGlint.value as THREE.Color).copy(key.color).multiplyScalar(p.sunIntensity * sea.glint);
  // What a crest passes: the shallow's green, in the key's light.
  (u.uScatter.value as THREE.Color).copy(SHALLOW).multiply(u.uKey.value as THREE.Color);
}

/** Tell the ripples which way the wind blows and how hard, and the scatter
 * how high a crest stands in this sea. Once per sea. */
export function applySea(
  m: WaterMaterial,
  windFrom: number,
  windSpeed: number,
  crestHeight: number,
): void {
  const u = m.uniforms;
  // The tile's v axis runs DOWNWIND; u is across it. Columns of the 2×2,
  // as GLSL wants them.
  const dx = -Math.sin(windFrom);
  const dz = -Math.cos(windFrom);
  (u.uWindRot.value as THREE.Vector4).set(dz, dx, -dx, dz);
  u.uRipplePace.value = RIPPLE_PACE + RIPPLE_PACE_PER_WIND * windSpeed;
  u.uRippleStrength.value = RIPPLE_BASE + RIPPLE_PER_WIND * windSpeed;
  u.uScatterHeight.value = crestHeight;
}

/** The engine's clock, for the ripples' drift. Every frame. */
export function applyClock(m: WaterMaterial, t: number): void {
  m.uniforms.uTime.value = t;
}
