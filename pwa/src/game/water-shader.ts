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
//                rider and sky out toward the horizon. The angle is the
//                WAVE's — the grid's normal — and never the ripples': a
//                rough surface's reflectance is the average over its
//                slopes, which is smooth, and a Fresnel term read off every
//                capillary crest flickers at a grazing angle instead.
//                What it reflects is THE SKY THAT IS ACTUALLY OVER IT —
//                `skyAlong` in `sky-glsl.ts`, the same function the dome
//                is painted with, sharing the same uniforms — so a cirrus
//                veil lies along the crests, a cumulus drifts across the
//                sea under it, and a squall's black ceiling puts its own
//                black on the water. Reflected BLURRED (fewer octaves, a
//                wider rim band, softer edges, a skyline that fades rather
//                than cuts): a real sea reflects the sky through a spread
//                of wave slopes, and a sharp reflection lands as hard white
//                streaks that read as foam the sea does not have.
//                AND WHAT STANDS OVER IT: the shore, the wood on it, the
//                rocks, the gates, the craft and the rider — drawn once a
//                frame from under the water into a small texture
//                (`reflection.ts`) and laid over the analytic sky wherever
//                it has a picture, wobbled by the wave's slope and read
//                blurred, because a tree line in chop is a smear with the
//                tree's colour in it, not a second tree.
//   THE RAIN     the rings a downpour pocks the surface with — a grid of
//                impacts, each one expanding and dying — perturbing the
//                normal and lifting a little foam at the core. Drawn out to
//                a reach the DETAIL row sets and no further: past a few
//                metres a real ring is under a pixel, and what the eye is
//                actually reading out there is the sheet in the air and the
//                fog behind it.
//   THE GLINT    the sun's image in the surface: ONE lobe over the slope
//                distribution Cox and Munk measured on a wind-roughened sea
//                (1954: σ² = 0.003 + 0.00512·U, U in m/s), which is the road
//                a low sun lays across the water toward the rider and the
//                sparkle in it at once. ELLIPTICAL, because their surface
//                was: a sea tilts more along the wind than across it, so the
//                road is drawn out along the wind rather than laid down as a
//                disc. Near the lens, where the ripple tile is resolved,
//                the tile carries part of that variance explicitly and the
//                lobe is tightened by the same share; where the tile has
//                faded the whole variance is the lobe's, so the far sea
//                is shaded by the roughness its geometry cannot show
//                (Bruneton, Neyret and Holzschuch 2010's transition from
//                geometry to BRDF, in its cheapest form). The beam's only —
//                a sun behind a squall's ceiling has no image to give.
//   THE RIPPLES  the wind's capillary chop, too fine for any grid: a normal
//                tile transformed out of the sea's own spectrum
//                (`ripple-tile.ts`), scrolled downwind at two scales, and
//                faded with distance where its own mip levels would have
//                flattened it anyway. It changes the light and never the
//                surface, so a probe reading the same water agrees. Its
//                slope is the tile's share of Cox and Munk's variance for
//                the wind. HOW FAR it survives is the WATER row's
//                (`WaterLook.rippleFade`): past the fade the glint's lobe
//                carries the roughness on its own.
//   THE LAMP     the craft's own lamp after dark: the one spotlight in the
//                scene, read off the very light three lights the hull and
//                the buoys with, laid on the water as a pool that falls off
//                with the square of the distance the way a real lamp's
//                does, with its own glint in the ripples. By day it is off
//                and costs the shader a few multiplies.
//   THE FOAM     the vertex's foam SHARE (the colour attribute's alpha),
//                broken up by the foam tile, so a whitecap is streaks and
//                holes rather than a white vertex.
//   THE WAKE     what the craft did to this water, read off the map
//                `wake.ts` rasterises round it each frame: a foam share of
//                its own (the road, drawn by the SAME foam term as a
//                whitecap, in the same light, off the same tile read finer
//                and square, because a road is the pump's boil and not the
//                wind's streaks), a CHURN that bends the mirror and the
//                glint with a boiling normal, lightens the body toward foam
//                — the fan either side of a road is water the hull aerated
//                rather than whitened — and closes the window, and a crest
//                and a hollow that move the surface itself: the vertex
//                shader lifts every vertex by the map's height — read
//                BLURRED to the grid's scale, so the relief is as smooth
//                as a wave and no vertex jumps as the trail sweeps over it
//                — and this shader lights it by the same blurred gradient,
//                so the transom's trough and the fan's edge are relief the
//                mesh is too coarse to carry on its own. All of it fades out
//                over the map's last few metres so its edge is never a line
//                on the sea. HOW MUCH OF IT IS READ is the DETAIL row's
//                (`WAKE_LOOK`): the relief is the dear half — four reads of
//                the map's gradient on every vertex and pixel it covers —
//                and a stop can keep the foam and the churn without it, or
//                read no map at all.
//   THE COCKPIT  the one place the sea is told the hull is there: a fragment
//                inside the craft's cockpit opening and under its rail is
//                dropped rather than lit, so the sea cannot stand in a
//                footwell with the gunwale dry either side. `water-cut.ts`.
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

import { PALETTE } from "../identity.ts";
import { anisotropic, foamTexture } from "./fx-textures.ts";
import {
  RIPPLE_COARSE,
  RIPPLE_METRES,
  RIPPLE_RMS_SLOPE,
  RIPPLE_SIZE,
  rippleNormals,
} from "./ripple-tile.ts";
import {
  WATER_LOOK,
  type ReflectionLook,
  type WakeLook,
  type WaterLook,
} from "./settings-video.ts";
import { mirrorBuild, skyGlsl, type SkyUniforms } from "./sky-glsl.ts";
import { type Preset } from "./sky.ts";
import { WAKE_HEIGHT, WAKE_MAP } from "./wake-profile.ts";
import { WELL_GLSL, wellUniforms } from "./water-cut.ts";

/** THE SEA'S SLOPE VARIANCE for a wind, Cox and Munk (1954) from the sun's
 * glitter photographed off Hawaii: the total mean-square slope of a
 * wind-roughened surface, `σ² = 0.003 + 0.00512·U`, U the wind in m/s. It
 * is the width of the glint's lobe and the strength of the ripple tile,
 * so the sparkle and the road come from one measurement. */
const SLOPE_VAR_CALM = 0.003;
const SLOPE_VAR_PER_WIND = 0.00512;
/** …and the same paper's fits to the two COMPONENTS of that variance, m/s
 * again: across the wind σ_c² = 0.003 + 0.00192·U, along it σ_u² =
 * 0.00316·U. Only their RATIO is taken — the total above stays the paper's
 * own total fit, so one measurement sizes the glint's lobe and the shape of
 * it cannot drift away from the size. */
const SLOPE_VAR_CROSS_CALM = 0.003;
const SLOPE_VAR_CROSS_PER_WIND = 0.00192;
const SLOPE_VAR_ALONG_PER_WIND = 0.00316;
/** How the two ripple layers are mixed, and the factor that makes the mix
 * carry the WHOLE of the tile's slope. Two uncorrelated fields summed with
 * weights w1 and w2 have w1² + w2² of one field's variance, so a 0.6 / 0.4
 * mix on its own hands the water 52% of the slope the tile was built at —
 * while the lobe below is told the tile took its full share. */
const RIPPLE_FINE = 0.6;
const RIPPLE_COARSE_MIX = 0.4;
const RIPPLE_NORM = 1 / Math.hypot(RIPPLE_FINE, RIPPLE_COARSE_MIX);
/** How much of that variance the RIPPLE TILE carries where it is resolved;
 * the rest is under a texel and stays in the lobe. Where the tile has faded
 * with distance the lobe takes this share back. */
const RIPPLE_SHARE = 0.4;
/** What the glint's radiance is scaled by before the soft clip: the sun's
 * irradiance times Fresnel times the slope density (1/sr) over 4·cosθv, and
 * a disc half a degree wide is not a point — an eye-set gain that puts the
 * road's core just past white. */
const GLINT_GAIN = 0.2;

/** R31 — how many BUOY LAMPS the water can carry at once, and how far one
 * of them throws, m.
 *
 * Four, because that is `circuit.mark.count`'s ceiling: a lap is ridden
 * round at most four lit marks, and a fixed-size loop with a branch-free
 * body is a handful of instructions per fragment where an array sized at
 * runtime would recompile the shader every time a level changed. A lap with
 * fewer simply carries black lamps, which cost the same and light nothing.
 *
 * The reach is what a mark's lantern is worth ON THE WATER rather than how
 * far off it can be SEEN — the glare carries for kilometres and the pool
 * does not, and a pool stretched past this reads as a lit sea rather than a
 * lit buoy. */
export const BUOY_LAMPS = 4;
const BUOY_REACH = 78;
/** The lantern's own warm white, and what its pool is worth in the water's
 * own irradiance units — the craft's headlamp is 640 cd over a cone, and
 * this is an unshaded lantern of a few tens spreading all round itself. */
const BUOY_LIGHT = 0xffe6a8;
const BUOY_POOL = 120;
/** How fast the ripples travel downwind, tile lengths per second, with no
 * wind and per m/s of it. Slower than a real capillary wave's phase speed:
 * the tile is a texture and a texture at full pace strobes. */
const RIPPLE_PACE = 0.25;
const RIPPLE_PACE_PER_WIND = 0.018;
/** The foam tile's edge across the wind, m, and how many times longer it
 * is read DOWNWIND: foam on a sea is streaks the wind lays along its own
 * direction — the spume lines of a fresh breeze, the drawn-out tails a
 * broken crest leaves — and a tile read square is a scatter of blobs. */
const FOAM_METRES = 3.5;
const FOAM_STREAK = 2.6;
/** How far the coarse ripple layer is turned off the wind, rad: the two
 * layers share one tile, and laid the same way they tile together into
 * corduroy. */
const COARSE_TURN = 0.7;
/** THE MIRROR'S PICTURE, as read: how far across its frame a unit of wave
 * slope shifts the sample (a real slope of s bends the reflected ray by 2s,
 * which on a reflection a few tens of metres off is a shift of metres). The
 * shift is mostly UP the frame: a face tilting toward or away from the lens
 * moves what it reflects up and down the shore, and sideways only a
 * little. How many mip levels down the picture is read is the REFLECTION
 * lever's (`ReflectionLook.blur`, `applyMirrorLook`): a sea is a rough
 * mirror, and a tree line read sharp off it is a second tree line standing
 * on its head, so even the top stop reads it down the chain. */
const MIRROR_WOBBLE_ACROSS = 0.12;
const MIRROR_WOBBLE_ALONG = 0.32;
/** THE WAKE, as read. The foam tile's edge, m, for the road's own mottling
 * — finer than the sea's and read square, in world space, so the foam
 * stands where the water put it as the craft leaves it behind. The churn's
 * slope at full churn (a boil is broken water, steeper than any wind
 * ripple), the edge the ripple tile is read at for it, m, and how fast the
 * boil rolls, tile lengths a second. How far the churn lightens the body
 * toward foam — aerated water — and how far it closes the window: both a
 * LIGHT touch, because most of the near sea's tone is the dark bed showing
 * through it, and a fan that closes the window comes back as a milky white
 * cone rather than as stirred water. And how
 * far in from the map's edge the whole of it fades, as a share of the map,
 * so the map's edge is never a line on the sea. `WAKE_FOAM_GAIN` is what a
 * full share of the map's foam is worth to the lace — set so a fresh road
 * is white with the tile's darkest holes still cut into it (past 1.35 the
 * lace saturates into a flat white blanket, and under about 0.7 the road
 * is a chain of speckles), breaking into patches as it fades. */
const WAKE_FOAM_METRES = 1.6;
const CHURN_SLOPE = 0.35;
const CHURN_METRES = 0.8;
const CHURN_PACE = 0.25;
const CHURN_LIGHTEN = 0.2;
const CHURN_ALPHA = 0.12;
const WAKE_FADE = 0.08;
const WAKE_FOAM_GAIN = 1.0;
/** THE RELIEF IS READ BLURRED — this many mip levels down the map, so the
 * crest, the hollow and the slope the surface is pushed along are as smooth
 * at the grid's scale as a wave is. Read sharp, a hollow two metres wide is
 * caught by one vertex at a time and each jumps as the trail sweeps over it
 * — a twitch the sea's own waves never show. Three levels is a two-metre
 * blur, which is also the narrowest a mark may be laid and still be SEEN. */
const WAKE_RELIEF_LOD = 3;
/** How far a vertex is pushed SIDEWAYS along the wake's slope, m per unit
 * of slope — Gerstner's horizontal term, in which the water piles toward a
 * crest and drains away from a trough, so the transom's hollow shoves the
 * surface outward and the stern wave's mound bunches it. The whole sea
 * pattern bends round the trail with it, which is what the eye reads as
 * water moved aside. */
export const WAKE_PUSH = 1.5;

/** Where a plan point falls on the wake's map, and how far inside its edge
 * it is — shared by both shaders, so a vertex is lifted exactly where the
 * pixel over it is lit — and so is the wake lab's section probe, which
 * compiles these very functions rather than a copy that could answer for a
 * surface the water never gets. */
export const WAKE_GLSL = `
  uniform sampler2D uWake;
  uniform vec3 uWakeBox;
  // What the WAKE lever reads off the map: 0 nothing, 1 the foam and the
  // churn, 2 the relief as well (\`applyWakeLook\`). A uniform rather than
  // a compile: every pixel of a frame takes the same branch, which costs
  // nothing, where a third copy of this shader would be a stall on the
  // press.
  uniform float uWakeMode;
  vec2 wakeUv(vec2 plan) {
    return (plan - uWakeBox.xy) / (2.0 * uWakeBox.z) + 0.5;
  }
  float wakeEdge(vec2 uv) {
    vec2 d = abs(uv - 0.5);
    return 1.0 - smoothstep(${(0.5 - WAKE_FADE).toFixed(2)}, 0.5, max(d.x, d.y));
  }
  // The wake's relief, m, read off the blurred level of the map: the crest
  // less the hollow.
  float wakeRelief(vec2 uv) {
    vec4 m = textureLod(uWake, uv, ${WAKE_RELIEF_LOD.toFixed(1)});
    return (m.b - m.a) * ${WAKE_HEIGHT.toFixed(2)};
  }
  // The slope of that relief, ∂h/∂x and ∂h/∂z in m/m, off the blurred
  // level's own gradient, two of ITS texels apart.
  vec2 wakeGrad(vec2 uv, float edge) {
    float texel = ${(2 ** WAKE_RELIEF_LOD).toFixed(1)} / ${WAKE_MAP.toFixed(1)};
    float e = wakeRelief(uv + vec2(texel, 0.0));
    float w = wakeRelief(uv - vec2(texel, 0.0));
    float n = wakeRelief(uv + vec2(0.0, texel));
    float s = wakeRelief(uv - vec2(0.0, texel));
    float metres = 2.0 * uWakeBox.z * texel;
    return vec2(e - w, n - s) * (edge / (2.0 * metres));
  }`;

/** The tile as three holds it: `ripple-tile.ts`'s normal map, wrapped, and
 * filtered for a surface seen along its own plane. Made once.
 *
 * Seen along the water without anisotropy the ripples are streaks radiating
 * from the lens and the sea reads as brushed metal — the chase lens sits two
 * metres up and looks along the sea, so every texel is minified far harder
 * across the view than along it. How many samples is the WATER row's, so the
 * tile is registered rather than set. */
let ripple: THREE.DataTexture | null = null;
function rippleTexture(): THREE.DataTexture {
  if (ripple) return ripple;
  ripple = new THREE.DataTexture(rippleNormals(), RIPPLE_SIZE, RIPPLE_SIZE, THREE.RGBAFormat);
  ripple.wrapS = ripple.wrapT = THREE.RepeatWrapping;
  ripple.minFilter = THREE.LinearMipmapLinearFilter;
  ripple.magFilter = THREE.LinearFilter;
  ripple.generateMipmaps = true;
  anisotropic(ripple);
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
  varying vec2 vWakeUv;
  #include <fog_pars_vertex>
${WAKE_GLSL}
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    // THE WAKE's relief: the crest less the hollow, off the map, on top of
    // the engine's own surface — a few centimetres, behind the hull, where
    // no probe reads — and the surface pushed SIDEWAYS up its own slope,
    // so the water piles on the bow wave's crest and drains from the
    // transom's trough. The map is read where the vertex STOOD, so the foam
    // and the churn move with the water they are on.
    vWakeUv = wakeUv(world.xz);
    float wEdge = uWakeMode > 1.5 ? wakeEdge(vWakeUv) : 0.0;
    if (wEdge > 0.001) {
      world.xz += wakeGrad(vWakeUv, wEdge) * ${WAKE_PUSH.toFixed(2)};
      world.y += wakeRelief(vWakeUv) * wEdge;
    }
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

/** How far the mirror's gradient is averaged either side of the reflected
 * ray, in RMS slopes of the variance the pixel does not resolve. A slope of
 * s bends the reflection by 2s, and the grid already carries the gravity
 * waves' share of Cox and Munk's total, so one sigma is the honest window
 * rather than two. */
const MIRROR_SPREAD = 1.0;
/** THE SEA UNDER THE SKYLINE: how far either side of the horizon (a ray's
 * y) the mirror turns from the sky to the water a reflected ray actually
 * lands on, and how much sky that other water still carries. */
const MIRROR_UNDER = 0.06;
const MIRROR_UNDER_SKY = 0.35;

/** THE RAIN'S RINGS. The grid one impact lands per, m — a raindrop's ring
 * spreads to something like a hand's width before it is gone, and a grid
 * this size at a fall of one puts a few hundred of them in the near frame,
 * which is what a downpour on flat water looks like. */
const RAIN_CELL = 0.4;
/** How long one ring lives, s, and how far out it gets in that time as a
 * share of the cell. */
const RAIN_LIFE = 0.9;
const RAIN_REACH = 0.42;
/** How steep a ring's wall is at its steepest, as a surface slope. A ring is
 * a millimetre high and its whole effect is on the SPECULAR — it is read as
 * the light turning over, never as relief — so this is well under the wind
 * chop's own. Driven harder the sea comes out corrugated, which reads as
 * hammered metal rather than as rain. */
const RAIN_SLOPE = 0.45;

/** What the gaussian ring's own derivative peaks at, for the wall width
 * below — so `RAIN_SLOPE` is a slope in the shader rather than a number
 * somebody has to guess the scale of. */
const RING_PEAK = 11.4;

function fragmentFor(layers: number): string {
  return `
  #include <common>
  uniform sampler2D uRipple;
  uniform sampler2D uFoam;
  uniform float uTime;
  uniform vec4 uWindRot;
  uniform float uRipplePace;
  uniform float uRippleStrength;
  uniform vec2 uRippleFade;
  uniform vec3 uHemiSky;
  uniform vec3 uHemiGround;
  uniform vec3 uKey;
  uniform vec3 uSunDir;
  uniform vec3 uGlint;
  uniform vec3 uScatter;
  uniform float uScatterHeight;
  uniform vec3 uFoamColor;
  uniform float uRainFall;
  uniform vec2 uRainFade;
  uniform float uSlopeVar;
  uniform float uSlopeAlong;
  uniform sampler2D uMirror;
  uniform mat4 uMirrorMatrix;
  uniform vec3 uMirrorRight;
  uniform vec3 uMirrorForward;
  uniform float uMirrorOn;
  uniform float uMirrorBlur;
  uniform vec3 uLampPos;
  uniform vec3 uLampDir;
  uniform vec3 uLampColor;
  uniform vec2 uLampCone;
  uniform float uLampReach;
  uniform vec3 uBuoyPos[${BUOY_LAMPS}];
  uniform vec3 uBuoyColor[${BUOY_LAMPS}];
  uniform float uBuoyReach;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec4 vColor;
  varying float vHeight;
  varying float vWindow;
  varying vec2 vWakeUv;
  #include <fog_pars_fragment>
${WAKE_GLSL}
${WELL_GLSL}
${skyGlsl(mirrorBuild(layers))}

  // Three uncorrelated draws for one cell of the rain grid: where in the
  // cell the drop landed, and where in its own life the ring is.
  vec3 rainHash(vec2 c) {
    vec3 p = fract(vec3(c.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.xxy + p.yzz) * p.zyx);
  }

  /** THE RINGS a downpour pocks the surface with: one impact per cell of a
   * grid, each expanding from where it landed and dying as it goes. Returns
   * the slope it adds to the surface; 'crest' comes back as the white the
   * impact itself throws up. Nine cells, because a ring reaching nearly half
   * a cell from a centre that can be anywhere in it has to be able to arrive
   * from any quadrant. */
  vec2 rainRings(vec2 p, float t, float fall, out float crest) {
    vec2 slope = vec2(0.0);
    crest = 0.0;
    vec2 base = floor(p);
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 cell = base + vec2(float(i), float(j));
        vec3 h = rainHash(cell);
        // Light rain is FEWER impacts, not fainter ones: a ring is a ring.
        if (h.z > 0.25 + 0.75 * fall) continue;
        float age = fract(t / ${RAIN_LIFE.toFixed(2)} + h.z * 7.31);
        vec2 to = p - (cell + h.xy);
        float d = length(to) + 1e-4;
        float r = age * ${RAIN_REACH.toFixed(2)};
        // A gaussian ring, and the slope is its own derivative: up the
        // outside of the wall and down the inside, which is what turns the
        // light over as the ring passes.
        float wall = 0.075;
        float e = (d - r) / wall;
        float w = exp(-e * e);
        float amp = 1.0 - age;
        slope += (to / d) * (-2.0 * e / wall) * w * amp;
        // …and the splash at the moment of impact, gone in a blink.
        crest += exp(-d * d * 45.0) * max(0.0, 1.0 - age * 4.0);
      }
    }
    return slope * ${(RAIN_SLOPE / RING_PEAK).toFixed(5)};
  }

  void main() {
    vec3 toEye = cameraPosition - vWorld;
    float away = length(toEye);
    vec3 V = toEye / max(1e-3, away);

    // THE COCKPIT IS NOT THE SEA (water-cut.ts).
    if (insideTheHull(vWorld)) discard;

    // THE WAKE: what the craft did to this water (wake.ts's map) — its foam
    // share, its churn, and the slope of its relief off the map's own
    // gradient, because the mesh carries the crest and the hollow only at
    // its vertices and the light has to see the trough between them.
    float wEdge = uWakeMode > 0.5 ? wakeEdge(vWakeUv) : 0.0;
    vec4 mark = wEdge > 0.001 ? texture2D(uWake, vWakeUv) : vec4(0.0);
    float wakeFoam = mark.r * ${WAKE_FOAM_GAIN.toFixed(2)} * wEdge;
    float churn = min(1.0, mark.g * wEdge);
    vec2 wakeSlope = vec2(0.0);
    vec2 boil = vec2(0.0);
    if (wEdge > 0.001 && uWakeMode > 1.5) {
      // A height field's normal is (−∂h/∂x, 1, −∂h/∂z).
      wakeSlope = -wakeGrad(vWakeUv, wEdge);
      // …and the boil: broken water, the ripple tile read square and fine
      // and rolling with the clock, as steep as the churn says.
      vec2 roll = vWorld.xz / ${CHURN_METRES.toFixed(2)} + vec2(uTime * ${CHURN_PACE.toFixed(2)}, -uTime * ${(CHURN_PACE * 0.7).toFixed(2)});
      boil = (texture2D(uRipple, roll).rg * 2.0 - 1.0) * churn * ${CHURN_SLOPE.toFixed(2)};
    }
    // The relief is a real surface, so it goes into the WAVE's normal —
    // the one Fresnel is read off — and not only the ripples'.
    vec3 N = normalize(normalize(vNormal) + vec3(wakeSlope.x, 0.0, wakeSlope.y));

    // THE RIPPLES: the tile in wind space, the fine layer and the coarse,
    // scrolled downwind, faded with distance.
    mat2 wind = mat2(uWindRot.x, uWindRot.y, uWindRot.z, uWindRot.w);
    mat2 turn = mat2(${Math.cos(COARSE_TURN).toFixed(4)}, ${Math.sin(COARSE_TURN).toFixed(4)}, ${(-Math.sin(COARSE_TURN)).toFixed(4)}, ${Math.cos(COARSE_TURN).toFixed(4)});
    vec2 tile = wind * vWorld.xz;
    vec2 fine = tile / ${RIPPLE_METRES.toFixed(2)} + vec2(0.0, -uTime * uRipplePace);
    vec2 coarse = (turn * tile) / ${(RIPPLE_METRES * RIPPLE_COARSE).toFixed(2)} + vec2(0.13, -uTime * uRipplePace * 0.31);
    vec2 slope = ((texture2D(uRipple, fine).rg * 2.0 - 1.0) * ${RIPPLE_FINE.toFixed(2)}
      + ((texture2D(uRipple, coarse).rg * 2.0 - 1.0) * turn) * ${RIPPLE_COARSE_MIX.toFixed(2)})
      * ${RIPPLE_NORM.toFixed(4)};
    // How much of the tile this pixel RESOLVES, 0 to 1 — a share, and not
    // the strength it is read at. The two are different numbers and the
    // lobe below wants this one: past the fade there is no tile left to
    // take a share of the variance, whatever the wind.
    float resolved = 1.0 - smoothstep(uRippleFade.x, uRippleFade.y, away);
    slope = (slope * uRippleStrength * resolved) * wind;

    // THE RAIN, on the near water only: the rings are a real surface and a
    // real surface a hundred metres out is under a pixel. uRainFade is the
    // DETAIL row's reach and it is zero at the bottom stop, which compiles
    // to nothing being drawn rather than to rings nobody can see.
    float wet = uRainFall * (1.0 - smoothstep(uRainFade.x, uRainFade.y, away));
    float splash = 0.0;
    vec2 rings = vec2(0.0);
    if (wet > 0.002) {
      float crest;
      rings = rainRings(vWorld.xz / ${RAIN_CELL.toFixed(2)}, uTime, uRainFall, crest) * wet;
      splash = min(1.0, crest) * wet;
    }
    vec3 Nd = normalize(N + vec3(slope.x + rings.x + boil.x, 0.0, slope.y + rings.y + boil.y));

    // THE BODY, lit as three's Lambert lights the hull: the hemisphere by
    // how much the face looks up, the key by its angle to the sun.
    float upness = N.y * 0.5 + 0.5;
    vec3 irradiance = mix(uHemiGround, uHemiSky, upness) + uKey * max(0.0, dot(N, uSunDir));
    // THE LAMP: three's own spot — its cone between the two cosines, the
    // inverse square of the distance, and a cut-off at its reach — so the
    // pool on the water is the pool on the hull beside it.
    vec3 toLamp = uLampPos - vWorld;
    float lampD = length(toLamp);
    vec3 L = toLamp / max(lampD, 1e-3);
    float lampCone = smoothstep(uLampCone.x, uLampCone.y, dot(-L, uLampDir));
    float lampFall = (1.0 / max(lampD * lampD, 0.25)) * (1.0 - smoothstep(uLampReach * 0.6, uLampReach, lampD));
    vec3 lamp = uLampColor * lampCone * lampFall;
    // Not Lambert alone: a beam grazing a flat sea would light nothing at
    // all, and what a lamp on water is actually seen by is what the water
    // throws back up — the chop's facets, the foam, the silt in it — which
    // is the floor under the cosine.
    irradiance += lamp * (0.3 + 0.7 * max(0.0, dot(Nd, L)));
    // R31 — AND THE BUOYS' OWN LAMPS. A lantern on a mark is a POINT light
    // rather than a beam: it has to be seen from every bearing, so it
    // throws its pool all round itself and there is no cone to test. The
    // pool is what says a light is ON THE WATER rather than painted on the
    // sky behind it, and it pulses with the flash, which is the thing that
    // makes a rounding mark findable in the dark from a long way off.
    // The reach is written as nought when no lamp is lit this frame — a
    // coast sprint has no marks at all, and a circuit by day has dark ones —
    // and the whole loop goes with it rather than lighting the sea by four
    // black lamps a pixel.
    vec3 buoyGlint = vec3(0.0);
    if (uBuoyReach > 0.0) {
      for (int i = 0; i < ${BUOY_LAMPS}; i++) {
        vec3 toB = uBuoyPos[i] - vWorld;
        float dB = length(toB);
        vec3 Lb = toB / max(dB, 1e-3);
        float fallB =
          (1.0 / max(dB * dB, 1.0)) * (1.0 - smoothstep(uBuoyReach * 0.55, uBuoyReach, dB));
        vec3 litB = uBuoyColor[i] * fallB;
        irradiance += litB * (0.3 + 0.7 * max(0.0, dot(Nd, Lb)));
        // …and its image in the ripples: the column of light under a lamp,
        // which is most of what the eye actually reads a light on water by.
        buoyGlint += litB * pow(max(0.0, dot(Nd, normalize(Lb + V))), 300.0) * 0.7;
      }
    }
    vec3 body = vColor.rgb * irradiance * RECIPROCAL_PI;
    // …and the light through a crest with the sun behind it.
    float back = max(0.0, dot(-V, uSunDir));
    float lift = clamp(vHeight / uScatterHeight, 0.0, 1.0);
    body += uScatter * lift * (0.12 + 0.6 * pow(back, 3.0));
    // Foam is air in water, lit as the body is; churned water is on its way
    // to being foam, and is lightened toward it by how churned it is.
    vec3 foamCol = uFoamColor * irradiance * RECIPROCAL_PI;
    body = mix(body, foamCol, churn * ${CHURN_LIGHTEN.toFixed(2)});

    // THE MIRROR — the whole sky along the reflected ray, clouds and all
    // (skyAlong, sky-glsl.ts), from the wave face's own place so the sheet
    // overhead is pierced where it actually is.
    //
    // The ray is bent by only a THIRD of the ripple slope. A cloud edge is
    // the sharpest thing in the sky, and reflected through the full
    // capillary chop it lands as a field of noise: the reflection is
    // resolved per pixel while the ripples are a texture, so what comes back
    // is aliasing rather than sparkle. The full slope stays where it is
    // read at low frequency — the glint — which is where the ripples are
    // doing their real work anyway.
    // The RINGS keep their whole slope here where the ripples lose most of
    // theirs: a ring is resolved geometry a few pixels across, not a texture
    // being minified, so it turns the reflection over cleanly — and under a
    // rain deck there is no beam to glint, which makes the mirror the ONLY
    // place a dimple can show at all.
    // The BOIL keeps most of its slope in the mirror too: it is only ever a
    // few metres from the lens, and a reflection that does not break up over
    // a boiling road is what gives the road away as paint.
    vec3 Nr = normalize(N + vec3(slope.x * 0.35 + rings.x + boil.x * 0.7, 0.0, slope.y * 0.35 + rings.y + boil.y * 0.7));
    vec3 R = reflect(-V, Nr);
    // The slope variance this pixel does NOT resolve — Cox and Munk's, less
    // the share the ripple tile is carrying here. It is the glint's lobe
    // below, and here it is how far the mirror's sky is blurred: a slope of
    // s bends the reflected ray by 2s, and a pixel of sea reflects the
    // gradient through a spread of them.
    float s2 = uSlopeVar * (1.0 - ${RIPPLE_SHARE.toFixed(2)} * resolved);
    vec3 mirror = skyAlong(R, vWorld, ${MIRROR_SPREAD.toFixed(2)} * sqrt(s2));
    // A reflected ray that dips under the skyline lands on the SEA, not on
    // the fog the dome paints under its rim: the next wave's back, which is
    // dark water under a sky it mostly sees at a grazing angle. Without
    // this every wave back the lens sees at a grazing angle is the fog's
    // colour — a twenty-metre sea under a squall comes out as pale sheets
    // that read as foam, and a wind sea at noon as white bands.
    float under = 1.0 - smoothstep(${(-MIRROR_UNDER).toFixed(3)}, ${MIRROR_UNDER.toFixed(3)}, R.y);
    mirror = mix(mirror, mix(body, mirror, ${MIRROR_UNDER_SKY.toFixed(2)}), under);
    // …and what stands over the water, where the mirror's picture has any:
    // the flat mirror's own image of this point, shifted by the face's tilt
    // — a face leaning away from the lens shows what is lower on the shore —
    // and read a level or two down the mip chain.
    if (uMirrorOn > 0.0) {
      vec4 seat = uMirrorMatrix * vec4(vWorld, 1.0);
      vec3 tilt = vec3(Nr.x, 0.0, Nr.z);
      vec2 wobble = vec2(
        dot(tilt, uMirrorRight) * ${MIRROR_WOBBLE_ACROSS.toFixed(3)},
        dot(tilt, uMirrorForward) * ${MIRROR_WOBBLE_ALONG.toFixed(3)});
      vec4 seen = texture2D(uMirror, seat.xy / seat.w + wobble, uMirrorBlur);
      mirror = mix(mirror, seen.rgb, seen.a * uMirrorOn);
    }
    // Schlick on the WAVE's angle, not the ripples' — see the header — and
    // averaged over the slopes the pixel does not resolve: Bruneton, Neyret
    // and Holzschuch's fit of the mean Fresnel over a Gaussian slope
    // distribution of variance s2, which lowers and softens the grazing
    // rise the rougher the sea is.
    float cosV = clamp(dot(N, V), 0.0, 1.0);
    float F = 0.02 + 0.98 * pow(1.0 - cosV, 5.0 * exp(-2.69 * s2)) / (1.0 + 22.7 * pow(s2, 1.5));
    vec3 col = mix(body, mirror, F);

    // THE GLINT: Beckmann's slope density at the half vector, over the
    // variance the pixel cannot resolve — Cox and Munk's, less the share the
    // ripple tile is carrying here — times Fresnel at the half vector, so a
    // low sun's road blazes and a high sun's sparkle stays polite; soft-
    // clipped so the peak goes white rather than past it. The 4·cosθv of the
    // microfacet form is floored: a grazing pixel is a wide one, not a
    // brighter one.
    vec3 H = normalize(uSunDir + V);
    float Fh = 0.02 + 0.98 * pow(1.0 - clamp(dot(H, V), 0.0, 1.0), 5.0);
    // Cox and Munk's distribution is ELLIPTICAL: a sea tilts more along the
    // wind than across it, so the sun's image in it is drawn out along the
    // wind rather than laid down as a disc. The half vector is taken into
    // the surface's own frame — up is the normal the ripples have already
    // turned, the other two axes downwind and across it — and the slope it
    // asks a facet for is weighed against each variance on its own.
    vec3 up = Nd;
    vec3 downwind = vec3(uWindRot.y, 0.0, uWindRot.w);
    vec3 along = normalize(downwind - up * dot(up, downwind));
    vec3 across = cross(up, along);
    float cosH = max(dot(up, H), 1e-3);
    vec2 facet = vec2(dot(H, across), dot(H, along)) / cosH;
    float varAlong = max(s2 * uSlopeAlong, 1e-7);
    float varAcross = max(s2 * (1.0 - uSlopeAlong), 1e-7);
    float c2 = cosH * cosH;
    float density =
      exp(-0.5 * (facet.x * facet.x / varAcross + facet.y * facet.y / varAlong)) /
      (2.0 * PI * sqrt(varAcross * varAlong) * c2 * c2);
    vec3 glint = 1.0 - exp(-uGlint * Fh * density * ${GLINT_GAIN.toFixed(2)} / max(cosV, 0.25));
    // …and the lamp's own image in the ripples, a scatter of sparks under
    // the bow: the same tight lobe, off the lamp's direction.
    vec3 Hl = normalize(L + V);
    glint += lamp * pow(max(0.0, dot(Nd, Hl)), 400.0) * 0.6;
    glint += buoyGlint;

    // THE FOAM: the vertex's share says how much of the face has gone over,
    // the tile says WHERE on it — read in wind space, its long axis laid
    // downwind, so what it draws is streaks the wind has combed. LACE, not
    // paint: a light share reaches only the tile's brightest streaks and
    // shows them half see-through, which is aerated water before it is
    // white; a full share is white with the tile's darkest holes still
    // open on the water under it. A sheet with no holes is a snowfield.
    float share = vColor.a;
    vec2 foamUv = wind * vWorld.xz;
    float pattern = texture2D(uFoam, vec2(foamUv.y / ${(FOAM_METRES * FOAM_STREAK).toFixed(2)}, foamUv.x / ${FOAM_METRES.toFixed(1)})).a;
    float lace = smoothstep(1.0 - share, 1.35 - share, pattern);
    float foam = lace * (0.45 + 0.55 * share);
    // …and the WAKE's, off the map, through the same lace: the tile read
    // square and fine in world space, so the road's patches stand where the
    // water put them and the craft leaves them behind. STILL in the world —
    // a pattern that jogs with the clock reads as jitter, not as a boil;
    // the boil is the churn's normal. The louder of the two foams wins;
    // they never sum. Two octaves: the tile, and the tile again a third the
    // size, because the road is the nearest foam in the frame and at one
    // octave a fresh road is a flat white blanket rather than broken water.
    if (wakeFoam > 0.001) {
      float wakePattern = mix(
        texture2D(uFoam, vWorld.xz / ${WAKE_FOAM_METRES.toFixed(2)}).a,
        texture2D(uFoam, vWorld.xz / ${(WAKE_FOAM_METRES / 3).toFixed(2)}).a,
        0.35);
      float wakeLace = smoothstep(1.0 - wakeFoam, 1.35 - wakeFoam, wakePattern);
      foam = max(foam, wakeLace * min(1.0, 0.45 + 0.55 * wakeFoam));
    }
    // …and the white a raindrop's own impact throws up. A fraction of the
    // wake's: a drop is a pinprick of air in the water, not a crest going
    // over, and driven any harder a downpour turns the sea to porridge.
    foam = clamp(foam + splash * 0.5, 0.0, 1.0);
    col = mix(col + glint, foamCol, foam);

    // THE WINDOW: opaque by the share the mirror took, by the column's own
    // opacity straight down, wherever there is foam, and by how churned the
    // water is — aerated water is not a window either.
    float alpha = clamp(mix(vWindow, 1.0, F) + foam + churn * ${CHURN_ALPHA.toFixed(2)}, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
    #include <fog_fragment>
    #include <colorspace_fragment>
  }`;
}

export type WaterMaterial = THREE.ShaderMaterial;

/** WHAT THE MIRROR HANDS THE WATER — the very objects `reflection.ts`
 * writes each frame, held by the material rather than copied: its picture,
 * the world-to-texture matrix, and the mirrored lens's right and forward
 * for the wobble. */
export type MirrorSeat = {
  texture: THREE.Texture;
  matrix: THREE.Matrix4;
  right: THREE.Vector3;
  forward: THREE.Vector3;
};

/** WHAT THE WAKE HANDS THE WATER — the very objects `wake.ts` writes each
 * frame, held by the material rather than copied: its map, and the box the
 * map covers (the centre's plan x and z, and its reach either side, m). */
export type WakeMap = {
  texture: THREE.Texture;
  box: THREE.Vector3;
};

/** A picture with nothing in it — one transparent black texel — for a
 * material built without a mirror or a wake: the mirror's read is defined
 * and shows the sky, the wake's reads as no wake at all. */
let blank: THREE.DataTexture | null = null;
function blankTexture(): THREE.DataTexture {
  if (!blank) {
    blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat);
    blank.needsUpdate = true;
  }
  return blank;
}

const SHALLOW = new THREE.Color(PALETTE.seaShallow);

/** How many cloud sheets each material was COMPILED for. Not on the material
 * itself, because that is three's object and this is a fact about the source
 * standing in it. */
const builtLayers = new WeakMap<WaterMaterial, number>();

/**
 * The one material both water grids are drawn with. `sky` is the SHARED
 * uniform bundle `environment.ts` writes the sky into — the very objects the
 * dome's material holds, so the sea can never reflect a sky that is not the
 * one over it.
 */
export function createWaterMaterial(
  sky: SkyUniforms,
  look: WaterLook = WATER_LOOK.medium,
  mirror?: MirrorSeat,
): WaterMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      ...sky,
      uRipple: { value: rippleTexture() },
      uFoam: { value: foamTexture() },
      uTime: { value: 0 },
      uWindRot: { value: new THREE.Vector4(1, 0, 0, 1) },
      uRipplePace: { value: RIPPLE_PACE },
      uRippleStrength: { value: Math.sqrt(SLOPE_VAR_CALM * RIPPLE_SHARE) / RIPPLE_RMS_SLOPE },
      uRippleFade: { value: new THREE.Vector2(look.rippleFade[0], look.rippleFade[1]) },
      uHemiSky: { value: new THREE.Color(0xffffff) },
      uHemiGround: { value: new THREE.Color(0x53808c) },
      uKey: { value: new THREE.Color(0xfff2dc) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uGlint: { value: new THREE.Color(0xfff2dc) },
      uScatter: { value: new THREE.Color(0x000000) },
      uScatterHeight: { value: 0.25 },
      uFoamColor: { value: new THREE.Color(PALETTE.foam) },
      uRainFall: { value: 0 },
      uRainFade: { value: new THREE.Vector2(0, 0) },
      uSlopeVar: { value: SLOPE_VAR_CALM },
      uSlopeAlong: { value: 0.5 },
      uMirror: { value: mirror?.texture ?? blankTexture() },
      uMirrorMatrix: { value: mirror?.matrix ?? new THREE.Matrix4() },
      uMirrorRight: { value: mirror?.right ?? new THREE.Vector3(1, 0, 0) },
      uMirrorForward: { value: mirror?.forward ?? new THREE.Vector3(0, 0, 1) },
      uMirrorOn: { value: 0 },
      uMirrorBlur: { value: 1.5 },
      uBuoyPos: {
        value: Array.from({ length: BUOY_LAMPS }, () => new THREE.Vector3(0, -1000, 0)),
      },
      uBuoyColor: { value: Array.from({ length: BUOY_LAMPS }, () => new THREE.Color(0x000000)) },
      uBuoyReach: { value: BUOY_REACH },
      ...wellUniforms(),
      uLampPos: { value: new THREE.Vector3(0, -100, 0) },
      uLampDir: { value: new THREE.Vector3(0, -1, 0) },
      uLampColor: { value: new THREE.Color(0x000000) },
      uLampCone: { value: new THREE.Vector2(1, 1) },
      uLampReach: { value: 1 },
      uWake: { value: blankTexture() },
      uWakeBox: { value: new THREE.Vector3(0, 0, 1) },
      uWakeMode: { value: 2 },
    },
    vertexShader: VERTEX,
    fragmentShader: fragmentFor(0),
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
  builtLayers.set(material, 0);
  return material;
}

/**
 * LIGHT THE WATER FOR A SKY. The two lights are the scene's own, already
 * set for the preset by `environment.ts`, so the sea is lit by exactly what
 * lights the hull. What the wave faces REFLECT is not passed at all — it is
 * the shared sky uniforms, which the environment has already written — and
 * `layers` is the only thing about that sky this material has to be
 * recompiled for.
 */
export function applySky(
  m: WaterMaterial,
  p: Preset,
  hemi: THREE.HemisphereLight,
  key: THREE.DirectionalLight,
  layers: number,
): void {
  const u = m.uniforms;
  (u.uHemiSky.value as THREE.Color).copy(hemi.color).multiplyScalar(hemi.intensity);
  (u.uHemiGround.value as THREE.Color).copy(hemi.groundColor).multiplyScalar(hemi.intensity);
  (u.uKey.value as THREE.Color).copy(key.color).multiplyScalar(key.intensity);
  (u.uSunDir.value as THREE.Vector3).copy(key.position).normalize();
  // The glint is the sun's own light, at its own strength, for the share of
  // it that is a BEAM: a sun behind a squall's ceiling has no image to give.
  (u.uGlint.value as THREE.Color).copy(key.color).multiplyScalar(p.sunIntensity * p.beam);
  // What a crest passes: the shallow's green, in the key's light.
  (u.uScatter.value as THREE.Color).copy(SHALLOW).multiply(u.uKey.value as THREE.Color);
  if (builtLayers.get(m) !== layers) {
    builtLayers.set(m, layers);
    m.fragmentShader = fragmentFor(layers);
    m.needsUpdate = true;
  }
}

/**
 * HOW HARD IT IS RAINING ON THE SEA, and HOW FAR OUT the rings are worth
 * drawing (the DETAIL row's `rainReach`, m — where they begin to fade and
 * where they are gone). A reach of zero is the bottom stop, and it is not a
 * shorter fade: nothing is drawn at all.
 */
export function applyRain(m: WaterMaterial, fall: number, reach: readonly [number, number]): void {
  m.uniforms.uRainFall.value = reach[1] > 0 ? fall : 0;
  (m.uniforms.uRainFade.value as THREE.Vector2).set(reach[0], reach[1]);
}

/** THE CRAFT'S LAMP, read off the scene's own spotlight so the water is lit
 * by exactly what lights the hull: its world place and aim, its colour at
 * its intensity, the two cosines of its cone (the outer edge and where the
 * penumbra ends, the way three's spot reads them) and its reach. Every
 * frame — the lamp rides the hull. An invisible lamp is written as black
 * rather than skipped, so a lamp switched off by day leaves no pool. */
export function applyLamp(m: WaterMaterial, lamp: THREE.SpotLight): void {
  const u = m.uniforms;
  const pos = u.uLampPos.value as THREE.Vector3;
  const dir = u.uLampDir.value as THREE.Vector3;
  lamp.getWorldPosition(pos);
  lamp.target.getWorldPosition(dir).sub(pos).normalize();
  const lit = lamp.visible ? lamp.intensity : 0;
  (u.uLampColor.value as THREE.Color).copy(lamp.color).multiplyScalar(lit);
  (u.uLampCone.value as THREE.Vector2).set(
    Math.cos(lamp.angle),
    Math.cos(lamp.angle * (1 - lamp.penumbra)),
  );
  u.uLampReach.value = lamp.distance;
}

/** R31 — WHAT A LIT BUOY IS DOING TO THE SEA IT SITS ON: each lantern's
 * world place and what it is worth this frame, straight onto the water's
 * own uniforms.
 *
 * A mark's lamp is not in the scene as a light — four point lights would
 * recompile every Lambert material in the level and light a hull nobody is
 * standing beside — so the WATER carries them itself, which is where the
 * whole of the effect is anyway: the pool under the lantern and the column
 * of it down the ripples. Lamps past the fourth are dropped and lamps that
 * are dark this instant are written black, which costs the same and lights
 * nothing.
 *
 * `pwa/src/game/buoys.ts` owns what the lanterns are worth (the flash
 * character times the sky's own switch); this only spends it. */
export function applyBuoyLamps(
  m: WaterMaterial,
  lamps: readonly { x: number; y: number; z: number; lit: number }[],
): void {
  const pos = m.uniforms.uBuoyPos.value as THREE.Vector3[];
  const colour = m.uniforms.uBuoyColor.value as THREE.Color[];
  let any = false;
  for (let i = 0; i < BUOY_LAMPS; i++) {
    const lamp = i < lamps.length ? lamps[i] : null;
    if (!lamp || lamp.lit <= 0) {
      colour[i].setRGB(0, 0, 0);
      continue;
    }
    any = true;
    pos[i].set(lamp.x, lamp.y, lamp.z);
    colour[i].setHex(BUOY_LIGHT).multiplyScalar(lamp.lit * BUOY_POOL);
  }
  // The reach doubles as the switch: nought skips the whole loop in the
  // shader, so a level with no lit mark on it pays nothing for the four.
  m.uniforms.uBuoyReach.value = any ? BUOY_REACH : 0;
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
  // Cox and Munk's variance for this wind: the tile's share of it as the
  // tile's strength, the whole of it to the glint's lobe.
  const slopeVar = SLOPE_VAR_CALM + SLOPE_VAR_PER_WIND * windSpeed;
  u.uSlopeVar.value = slopeVar;
  // The SHAPE of that variance, as the share of it lying along the wind.
  // Under about 2.4 m/s the paper's two linear fits cross and the along-wind
  // component comes out the smaller, which no sea does: a wind too light to
  // have built its own chop is isotropic, not corrugated across itself.
  const along = SLOPE_VAR_ALONG_PER_WIND * windSpeed;
  const cross = SLOPE_VAR_CROSS_CALM + SLOPE_VAR_CROSS_PER_WIND * windSpeed;
  u.uSlopeAlong.value = Math.max(0.5, along / (along + cross));
  u.uRippleStrength.value = Math.sqrt(slopeVar * RIPPLE_SHARE) / RIPPLE_RMS_SLOPE;
  u.uScatterHeight.value = crestHeight;
}

/** THE WAKE'S MAP, held: the texture and the box are `wake.ts`'s own
 * objects, rewritten each frame, so this is called once when the two are
 * introduced rather than per frame. */
export function applyWake(m: WaterMaterial, map: WakeMap): void {
  m.uniforms.uWake.value = map.texture;
  m.uniforms.uWakeBox.value = map.box;
}

/** HOW MUCH OF THE WAKE IS READ — the DETAIL row's `WAKE_LOOK`: whether the
 * map is read at all, and whether its relief is. On a change of row, not
 * per frame. */
export function applyWakeLook(m: WaterMaterial, look: WakeLook): void {
  m.uniforms.uWakeMode.value = !look.map ? 0 : look.relief ? 2 : 1;
}

/** The engine's clock, for the ripples' drift. Every frame. */
export function applyClock(m: WaterMaterial, t: number): void {
  m.uniforms.uTime.value = t;
}

/** Whether the mirror has a picture this frame (`Reflection.live`): off,
 * the water reflects the analytic sky alone. Every frame. */
export function applyMirror(m: WaterMaterial, live: boolean): void {
  m.uniforms.uMirrorOn.value = live ? 1 : 0;
}

/** HOW BLURRED the mirror's picture is read — the REFLECTION lever's
 * `blur`, mip levels down. On a change of row, not per frame. */
export function applyMirrorLook(m: WaterMaterial, look: ReflectionLook): void {
  m.uniforms.uMirrorBlur.value = look.blur;
}
