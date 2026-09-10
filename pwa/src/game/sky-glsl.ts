// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKY ALONG A RAY — one GLSL function, `skyAlong`, and the uniforms it
// reads. It is the whole sky as a function of a direction: the gradient, the
// warm bleed round the sun, the sun's own disc and halo, and every cloud
// SHEET of `cloud-field.ts` projected onto the ray in perspective, so a
// cumulus a kilometre up foreshortens into the haze at the horizon the way a
// real one does and a cirrus sheet eight kilometres up hardly moves as the
// rider does.
//
// IT IS STATED ONCE BECAUSE TWO SURFACES ASK IT. `sky-dome.ts` paints the
// dome with it, and `water-shader.ts` reflects it per wave face — and over
// open water that second caller is the whole point. A sea that reflects a
// flat gradient under a sky with weather in it reads as a painted backdrop
// standing behind a swimming pool; a sea with the same cirrus lying along
// its crests is the picture this game is for. Two functions could never stay
// in step for one afternoon.
//
// WHY A SHADER AND NOT PUFFS. A cloud is not a shape, it is a field. Spheres
// on a ring can carry a fair-weather sky at arcade weight, and they cannot
// carry a cirrus veil, a ceiling with holes in it, or anything the water is
// meant to reflect — the ring the rider is looking at is behind them.
//
// THE UNIFORMS ARE SHARED OBJECTS, not copies: `environment.ts` makes one
// bundle and hands the same `THREE.IUniform`s to the dome's material and to
// the water's, so a sky is written once and both answer to it. The only
// thing that differs between the two is what the source was COMPILED for
// (`SkyBuild`) — the depth of the noise, how many sheets, whether the sun is
// in it, and how far the deck's rim is smeared for a rough mirror.

import * as THREE from "three";

import { MAX_LAYERS, cloudNoiseGlsl, type CloudLayer } from "./cloud-field.ts";
import { GLOW_FOCUS, GLOW_REACH, RIM_BAND, SKY_CURVE, type Preset } from "./sky.ts";

/**
 * WHAT ONE COPY OF THE SKY WAS COMPILED FOR.
 *
 * All of it is baked rather than carried as uniforms: the whole cost of the
 * sky is per pixel and the dome covers the frame, so the sheet loop gets the
 * drawn stack as its literal bound rather than breaking against one, the
 * fields get their depth as a name (`cloudNoiseGlsl`), and a copy with no
 * sun in it does not carry the disc at all rather than branching past it.
 * Moving any of them is a recompile.
 */
export type SkyBuild = {
  /** How many octaves of noise a sheet is read at. */
  octaves: number;
  /** How many sheets are stacked at once, at most `MAX_LAYERS`. */
  layers: number;
  /** Whether a second sample toward the sun lights the sides of the clouds
   * that face it. The difference between cloud and cotton wool, and the
   * dearest thing on the ladder. */
  sunlit: boolean;
  /** Whether the sun's disc, its glare and its halo are in this copy. The
   * dome draws them; the water does NOT — the sun's image on the sea is the
   * glint, computed from the real surface normal, and a second sun added
   * through the mirror is one sun too many. */
  sun: boolean;
  /** How tall the deck's lit rim is read, radians. `RIM_BAND` for the dome,
   * which is what the ceiling physically is; wider for the water, because a
   * sea is a ROUGH mirror — every pixel of it reflects the ceiling through a
   * spread of wave slopes, and a strip reflected sharp lands as hard white
   * streaks along every wave back that happens to point at it. */
  rimBand: number;
  /** Extra softness on every cloud edge, added to the density rule's own.
   * Zero on the dome, where an edge is an edge; a little on the water for
   * the same reason the rim is widened there. */
  soften: number;
};

/** How deep the SUNLIT sample reads. Two octaves shallower than the sheet
 * itself: it is differenced against the first sample to find which way the
 * cloud's surface faces, and a difference of two fine octaves is noise
 * rather than a slope. */
function sunlitOctaves(octaves: number): number {
  return Math.max(octaves - 2, 2);
}

/** THE SKY'S OWN UNIFORMS. One bundle per app; both materials hold these
 * very objects, so `writeSky` is written once and read twice. */
export type SkyUniforms = Record<string, THREE.IUniform>;

// Real vectors, not literals: three uploads an ARRAY of vec4 through each
// element's `toArray`, where a single vec4 takes any `{x, y, z, w}`.
const v4 = (): THREE.Vector4 => new THREE.Vector4();

export function createSkyUniforms(): SkyUniforms {
  return {
    uSkyZenith: { value: new THREE.Color(0x1f6fd8) },
    uSkyHorizon: { value: new THREE.Color(0xd7e9f0) },
    uSkyGlow: { value: new THREE.Color(0xfff3c8) },
    uSkyGlowStrength: { value: 0.35 },
    uSkyBand: { value: SKY_CURVE },
    uSkyBelow: { value: new THREE.Color(0xd7e9f0) },
    uSkyAz: { value: new THREE.Vector2(0, 1) },
    uSkySunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSkyKeyDir: { value: new THREE.Vector3(0, 1, 0) },
    uSkyDisc: { value: new THREE.Color(0xffffff) },
    uSkyDiscSize: { value: 0 },
    uSkyGlare: { value: 0 },
    uSkyHalo: { value: new THREE.Color(0xffffff) },
    uSkyHaloSize: { value: 0.1 },
    uSkyHaloOpacity: { value: 0 },
    uSkyThrough: { value: 1 },
    uSkyCloudLit: { value: new THREE.Color(0xffffff) },
    uSkyCloudShade: { value: new THREE.Color(0x8a97a8) },
    uSkySunColor: { value: new THREE.Color(0xffffff) },
    uSkyLayerA: { value: Array.from({ length: MAX_LAYERS }, v4) },
    uSkyLayerB: { value: Array.from({ length: MAX_LAYERS }, v4) },
    uSkyLayerC: { value: Array.from({ length: MAX_LAYERS }, v4) },
    uSkyLayerD: { value: Array.from({ length: MAX_LAYERS }, v4) },
    uSkyLayerE: { value: Array.from({ length: MAX_LAYERS }, v4) },
    uSkyDeckOverhead: { value: new THREE.Color(0x9fa8b2) },
    uSkyDeckRim: { value: new THREE.Color(0x9fa8b2) },
    uSkyDeckRelief: { value: 0 },
  };
}

/** Where the disc and the halo were authored: a plane at 86 % of the dome's
 * radius, sized in metres (that is what `sky-rungs.ts` states them in). The
 * shader wants angles. */
const AUTHORED_AT = 1800 * 0.86;

/** How wide the GLARE round the disc is, as a multiple of the disc's own
 * angle, and how strong it is in full beam. The hot core the eye cannot look
 * at: the halo is a third of the sky and pale, and without something between
 * it and the disc the sun is a coin pasted on a gradient — and a coin does
 * not light a sea. */
const GLARE_SPREAD = 5;
const GLARE_STRENGTH = 0.85;

/** The uniform block and every function `skyAlong` needs, for one build. */
export function skyGlsl(build: SkyBuild): string {
  const field = `cloudField${build.octaves}`;
  const sunField = `cloudField${sunlitOctaves(build.octaves)}`;
  const fields = build.sunlit ? [build.octaves, sunlitOctaves(build.octaves)] : [build.octaves];
  // ONLY WHAT THIS BUILD READS IS DECLARED. The bundle is shared, so a
  // build takes the part of it that build needs — a sky with no sheets in
  // it carries no layer arrays, and the water carries no sun. An unused
  // uniform is not free: three binds every one the program declares, and
  // `tests/water_shader_test.ts` holds the material to reading what it
  // declares and declaring what it reads.
  return /* glsl */ `
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uSkyGlow;
uniform float uSkyGlowStrength;
uniform float uSkyBand;
uniform vec3 uSkyBelow;
uniform vec2 uSkyAz;
${
  build.sun
    ? `uniform vec3 uSkyKeyDir;
uniform vec3 uSkyDisc;
uniform float uSkyDiscSize;
uniform float uSkyGlare;
uniform vec3 uSkyHalo;
uniform float uSkyHaloSize;
uniform float uSkyHaloOpacity;
uniform float uSkyThrough;`
    : ""
}
${
  build.layers === 0
    ? ""
    : `uniform vec3 uSkySunDir;
uniform vec3 uSkyCloudLit;
uniform vec3 uSkyCloudShade;
uniform vec3 uSkySunColor;
uniform vec4 uSkyLayerA[${MAX_LAYERS}];
uniform vec4 uSkyLayerB[${MAX_LAYERS}];
uniform vec4 uSkyLayerC[${MAX_LAYERS}];
uniform vec4 uSkyLayerD[${MAX_LAYERS}];
uniform vec4 uSkyLayerE[${MAX_LAYERS}];
uniform vec3 uSkyDeckOverhead;
uniform vec3 uSkyDeckRim;
uniform float uSkyDeckRelief;
${cloudNoiseGlsl(fields)}

// The same sample cloud-field.ts takes on the CPU (cloudUv).
vec2 skyCloudUv( vec2 p, vec4 c, float scale, float streak, float seed ) {
  vec2 q = p + c.xy;
  float along = q.x * c.z + q.y * c.w;
  float across = - q.x * c.w + q.y * c.z;
  return vec2( along / ( scale * streak ) + seed * 13.7, across / scale );
}`
}

vec3 skyAlong( vec3 ray, vec3 origin ) {
  float up = ray.y;
  float t = max( 0.0, up );
  // THE GRADIENT, and the warm bleed round the sun's bearing — sky.ts's
  // skyToneAt, in GLSL, off the same three constants.
  vec3 col = mix( uSkyHorizon, uSkyZenith, pow( t, uSkyBand ) );
  vec2 az = normalize( ray.xz + vec2( 1e-5, 0.0 ) );
  float toward = max( 0.0, dot( az, uSkyAz ) );
  float w = pow( toward, ${GLOW_FOCUS.toFixed(1)} ) * pow( 1.0 - t, ${GLOW_REACH.toFixed(1)} ) * uSkyGlowStrength;
  col = mix( col, uSkyGlow, min( 1.0, w ) );
  // Under the skyline the sky is the far water, which is fog.
  col = mix( uSkyBelow, col, smoothstep( - 0.04, 0.0, up ) );
${
  build.sun
    ? /* glsl */ `
  // THE DISC AND ITS HALO, under the clouds — so a sheet over the sun is a
  // bright patch with no edge, which is what a covered sun is.
  float cosA = dot( ray, uSkyKeyDir );
  float ang = acos( clamp( cosA, - 1.0, 1.0 ) );
  col += uSkyHalo * exp( - ang / max( uSkyHaloSize, 1e-3 ) * 2.5 ) * uSkyHaloOpacity * uSkyThrough;
  float glareAng = max( uSkyDiscSize * ${GLARE_SPREAD.toFixed(1)}, 1e-3 );
  col += uSkyDisc * exp( - ang / glareAng * 2.5 ) * uSkyGlare;
  float disc = ( 1.0 - smoothstep( uSkyDiscSize * 0.85, uSkyDiscSize, ang ) ) * uSkyThrough;
  col = mix( col, uSkyDisc, disc );
`
    : ""
}
${
  build.layers === 0
    ? ""
    : /* glsl */ `
  // THE CLOUD SHEETS, far to near: for a ray going up that is the highest
  // first, for one going down the lowest.
  for ( int k = 0; k < ${build.layers}; k ++ ) {
    int i = up > 0.0 ? ${build.layers} - 1 - k : k;
    vec4 A = uSkyLayerA[ i ];
    vec4 B = uSkyLayerB[ i ];
    vec4 C = uSkyLayerC[ i ];
    vec4 D = uSkyLayerD[ i ];
    vec4 E = uSkyLayerE[ i ];
    float dy = A.x - origin.y;
    if ( dy * up <= 0.0 || abs( up ) < 0.004 ) continue;
    // How high up the sky this piece of sheet is. The ceiling's whole
    // gradient runs on it, and so does the light on anything hanging under
    // the ceiling.
    float elev = asin( clamp( up, - 1.0, 1.0 ) );
    float rim = 1.0 - min( 1.0, elev / ${build.rimBand.toFixed(4)} );
    float dist = dy / up;
    vec2 p = origin.xz + ray.xz * dist;
    vec2 uv = skyCloudUv( p, C, A.w, B.y, D.x );
    // The fibres, faded out toward the rim the way fibreAt says
    // (cloud-field.ts) — under a pixel out there, they only sparkle.
    float fibre = E.x * smoothstep( 0.0, 0.25, abs( up ) );
    float n = cloudFibres( uv, ${field}( uv ), fibre );
    // Aerial perspective: a sheet seen the long way toward the horizon
    // dissolves into the air between. Mild — six kilometres of clear air
    // takes a quarter of a cloud, not half of it.
    float haze = 1.0 - exp( - dist * 0.00005 );
    vec3 hazeTone = up > 0.0 ? uSkyHorizon : uSkyBelow;
    if ( D.z > 0.5 ) {
      // THE DECK: a ceiling, overhead to rim by ELEVATION rather than by
      // distance, with its own lumps shading it. A rider sits a metre off
      // the water and looks along it, so read against distance the whole
      // visible ceiling comes out the rim's colour — a light grey sky in a
      // thunderstorm.
      vec3 tone = mix( uSkyDeckOverhead, uSkyDeckRim, pow( rim, 1.5 ) );
      tone *= 1.0 + 0.22 * uSkyDeckRelief * ( n * 2.0 - 1.0 );
      // How fast the ceiling closes over the sliver of open dome under its
      // base. On the dome that is what it physically is; in a rough mirror
      // it is smeared with the rim, or every wave face whose reflection
      // crosses the band in one pixel lands on a hard edge and the sea comes
      // out covered in flat bright plates.
      col = mix( col, tone, smoothstep( 0.0, ${(0.05 * (build.rimBand / RIM_BAND)).toFixed(4)}, up ) );
      continue;
    }
    float dens = cloudDensity( A.z, B.x * ${(1 - Math.min(0.9, build.soften)).toFixed(3)}, n ) * D.w;
    if ( dens <= 0.002 ) continue;
    // What sunlight there is at this altitude, and which face of the sheet
    // is being looked at (litAt, daylight.ts: the sun sets on the water
    // first, so a cirrus burns after the cumulus under it has gone grey).
    vec3 sunlit = mix( uSkyCloudShade, uSkyCloudLit, B.w );
    // A SHEET WITH A BODY IS DARK UNDERNEATH. The preset's shade is the
    // tone a THIN cloud's shaded side takes; a cumulus is half a kilometre
    // of water vapour and its base is a good deal darker than that, which is
    // the whole reason it reads as a heap rather than as a smear. B.z is
    // the sheet's own body — its thickness — so it is what deepens the
    // shade: a cirrus veil keeps the pale tone, a cumulus gets a real
    // underside.
    vec3 shade = uSkyCloudShade * mix( 1.0, 0.68, B.z );
    // …unless it is a RAG UNDER A CEILING. Scud hangs below the base, so the
    // only light on it is the ceiling's own — read at the rag's own place in
    // the sky, which is what keeps it right at both ends: near the skyline
    // it stands against the lit strip and reads dark, and thirty degrees up
    // it is a slightly darker patch of the same near-black underside. Read
    // at ONE fixed elevation instead (which is what a ring of cluster
    // billboards has to do, because they are objects at a height) it comes
    // out a flat pale veil over the whole sky, and a squall stops being
    // black.
    if ( E.y > 0.5 ) {
      vec3 ceiling = mix( uSkyDeckOverhead, uSkyDeckRim, pow( rim, 1.5 ) );
      sunlit = ceiling * 0.8;
      shade = ceiling * 0.55;
    }
    vec3 c;
    if ( up > 0.0 ) {
      // The underside: in the sheet's own shadow where it is thick, lit
      // through where it is thin, brighter on the sun's side of the sky
      // than away from it. A sheet with no body — cirrus — is lit through
      // wherever it is: ice that thin is white in every direction, not grey
      // on the far side of the sky.
      float sunward = 0.5 + 0.5 * dot( az, uSkyAz );
      float bottomLit = ( 1.0 - dens * B.z * 0.8 ) * mix( mix( 0.92, 0.6, B.z ), 1.0, sunward );
      ${
        build.sunlit
          ? `{
        float n2 = ${sunField}( uv + uSkySunDir.xz * 0.28 / max( B.y, 1.0 ) );
        bottomLit = mix( bottomLit, clamp( 0.5 + ( n - n2 ) * 5.0 * B.z, 0.0, 1.0 ), 0.5 * B.z );
      }`
          : ""
      }
      c = mix( shade, sunlit, bottomLit );
      // …and the light that comes STRAIGHT THROUGH a thin edge with the sun
      // behind it, which is the silver lining and most of what makes a
      // cumulus read as a body of water vapour rather than a sticker.
      float forward = pow( max( dot( ray, uSkySunDir ), 0.0 ), 8.0 );
      c += uSkySunColor * forward * ( 1.0 - dens ) * 0.45 * B.w;
    } else {
      // The top, seen from above — which over this coast is only ever the
      // scud under a low ceiling, looked down on from the apex of a launch.
      float topLit = 0.72 + 0.28 * ( 1.0 - dens * B.z );
      ${
        build.sunlit
          ? `{
        float n2 = ${sunField}( uv + uSkySunDir.xz * 0.28 / max( B.y, 1.0 ) );
        topLit = clamp( 0.65 + ( n - n2 ) * 4.0 * B.z, 0.0, 1.0 );
      }`
          : ""
      }
      c = mix( shade, sunlit, topLit );
    }
    c = mix( c, hazeTone, haze );
    col = mix( col, c, dens * ( 1.0 - 0.6 * haze ) );
  }
`
}
  return col;
}
`;
}

/** The sky's whole colour model, written into the shared uniforms. Once per
 * level — the sun does not move during a run. */
export function writeSky(u: SkyUniforms, p: Preset): void {
  (u.uSkyZenith.value as THREE.Color).set(p.zenith);
  (u.uSkyHorizon.value as THREE.Color).set(p.horizon);
  (u.uSkyGlow.value as THREE.Color).set(p.glow);
  u.uSkyGlowStrength.value = p.glowStrength;
  // How far up the sky the horizon's colour reaches. By day the band is the
  // broad one the dome was authored on; under a low sun it narrows, so a
  // sunset is a band of colour along the rim with the sky's own blue over it
  // rather than the whole dome painted orange.
  const lowSun = smooth01((0.26 - p.sunUp) / 0.26);
  u.uSkyBand.value = SKY_CURVE - 0.24 * lowSun;
  (u.uSkyBelow.value as THREE.Color).set(p.fog);
  (u.uSkyAz.value as THREE.Vector2).set(Math.sin(p.sunBearing), Math.cos(p.sunBearing));
  (u.uSkyDisc.value as THREE.Color).set(p.disc);
  u.uSkyDiscSize.value = (p.discSize / AUTHORED_AT) * 0.5;
  u.uSkyGlare.value = GLARE_STRENGTH * p.beam * (p.discSize > 0 ? 1 : 0);
  (u.uSkyHalo.value as THREE.Color).set(p.halo);
  u.uSkyHaloSize.value = (p.haloSize / AUTHORED_AT) * 0.5;
  u.uSkyHaloOpacity.value = p.haloOpacity;
  (u.uSkyCloudLit.value as THREE.Color).set(p.cloud);
  (u.uSkyCloudShade.value as THREE.Color).set(p.cloudShade);
  (u.uSkySunColor.value as THREE.Color).set(p.sun);
  if (p.deck) {
    (u.uSkyDeckOverhead.value as THREE.Color).set(p.deck.overhead);
    (u.uSkyDeckRim.value as THREE.Color).set(p.deck.rim);
    u.uSkyDeckRelief.value = p.deck.relief;
  }
}

/** Where the real sun and the key stand, and how much of the disc gets
 * through what is in front of it. */
export function writeSun(
  u: SkyUniforms,
  sun: THREE.Vector3,
  key: THREE.Vector3,
  through: number,
): void {
  (u.uSkySunDir.value as THREE.Vector3).copy(sun);
  (u.uSkyKeyDir.value as THREE.Vector3).copy(key);
  u.uSkyThrough.value = through;
}

/** The drawn stack, packed into the five vec4 arrays. `lit` is how much
 * daylight each sheet is standing in at its own altitude. */
export function writeLayers(
  u: SkyUniforms,
  drawn: readonly CloudLayer[],
  opacity: number,
  lit: (layer: CloudLayer) => number,
): void {
  const a = u.uSkyLayerA.value as THREE.Vector4[];
  const b = u.uSkyLayerB.value as THREE.Vector4[];
  const d = u.uSkyLayerD.value as THREE.Vector4[];
  const e = u.uSkyLayerE.value as THREE.Vector4[];
  drawn.forEach((layer, i) => {
    a[i].set(layer.altitude, layer.thickness, layer.coverage, layer.scale);
    b[i].set(layer.sharpness, layer.streak, layer.body, lit(layer));
    // A lid is a lid: only the fair-weather sheets thin with the sky's own
    // cloud opacity.
    d[i].set(layer.seed, layer.drift, layer.deck ? 1 : 0, layer.deck ? 1 : opacity);
    // E.y is the SCUD flag: a sheet hung under a ceiling, lit by its rim.
    e[i].set(layer.fibre, layer.genus === "scud" ? 1 : 0, 0, 0);
  });
}

/** Where each drawn sheet has drifted to, and which way the wind is
 * blowing. Every frame — it is five vec4s. */
export function writeDrift(
  u: SkyUniforms,
  drawn: readonly CloudLayer[],
  offsets: readonly { x: number; z: number }[],
  windX: number,
  windZ: number,
): void {
  const c = u.uSkyLayerC.value as THREE.Vector4[];
  drawn.forEach((_, i) => c[i].set(offsets[i].x, offsets[i].z, windX, windZ));
}

/** The rim band a rough mirror reads the ceiling's lit strip over — see
 * `SkyBuild.rimBand`. A sea reflects the sky through a spread of wave
 * slopes, so the strip that is nine degrees tall in the sky is smeared over
 * twenty on the water. */
export const MIRROR_RIM = RIM_BAND * 2.5;

/** THE SKY AS A ROUGH MIRROR REFLECTS IT — the build every surface that
 * mirrors the sky is compiled with: the water (`water-shader.ts`) and the
 * craft's shell and its rider's helmet (`craft-surface.ts`). Well under the
 * dome's: a mirror wants the sky's MASS rather than its edges, because an
 * edge reflected sharp through a spread of wave slopes or across a hull's
 * facets lands as hard streaks, and it is a far bigger pass than the sky.
 * Two sheets is every stack the cloud chart rolls (a deck and its scud, a
 * veil and its cumulus); three octaves is the mass and one arm of erosion;
 * and no sun, because a surface's own highlight IS the sun's image and a
 * second one added through the mirror is one sun too many. */
export function mirrorBuild(layers: number): SkyBuild {
  return { octaves: 3, layers, sunlit: false, sun: false, rimBand: MIRROR_RIM, soften: 0.35 };
}

function smooth01(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}
