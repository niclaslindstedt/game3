// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT CLOUD IS OVER THE COAST — the genera, at the heights the cloud chart
// puts them, dressed onto one level's sky by its weather, how heavy that
// weather is, and its seed. Everything here is a DECISION about the sky:
// what the sheets are, how much they cover, how big their cells are, how
// hard their edges, which way they streak, and how fast they ride the wind.
// What they LOOK like is `sky-glsl.ts`'s half — the same sheets sampled per
// pixel on the dome and again in the water's mirror.
//
// The heights are metres over the SEA, which here is also metres over the
// ground: this coast is at sea level by definition, so a cumulus base at
// twelve hundred is twelve hundred over the rider's head wherever they are.
// The chart, roughly (temperate latitudes, m over the sea):
//
//   LOW     stratus, stratocumulus, cumulus, nimbostratus    0 –  2 000
//   HIGH    cirrus, cirrostratus                         5 000 – 13 000
//   TALL    cumulonimbus, base low and the anvil high
//
// The one thing that makes a sunset sky a sunset sky is that the sun sets on
// these one at a time, lowest first (`litAt`, daylight.ts): the water goes
// grey, then the cumulus, and the cirrus burns for a quarter of an hour
// after.
//
// AND A CLEAR SKY IS EMPTY. Not a thin ring of cumulus, not one puff on the
// rim — nothing at all, from one horizon to the other. R19 already has a sky
// for "fair with something in it" and it is `high`; leaving a token cloud in
// `clear` is what made the two read as the same picture.
//
// THREE-FREE on purpose, and the NOISE is here twice — once as GLSL for the
// dome and the water, once as the same arithmetic in TypeScript — so a lab
// or a test can ask on the CPU how much cloud is between a point and the sun
// without standing a renderer up. The two agree to float precision, which is
// all a soft edge needs.

import type { Level, Weather } from "@engine";

export type CloudGenus =
  | "cumulus"
  | "stratocumulus"
  | "stratus"
  | "nimbostratus"
  | "cumulonimbus"
  | "cirrus"
  | "cirrostratus"
  | "scud";

/** One sheet of cloud, as the sky draws it: a plane at an altitude with a
 * noise field on it. */
export type CloudLayer = {
  genus: CloudGenus;
  /** Where the sheet's BASE is, m over the sea. */
  altitude: number;
  /** How thick it is, m — what the sun has to get through, which is what
   * decides how dark the underside is against the top. */
  thickness: number;
  /** How much of the sky it covers, 0..1. */
  coverage: number;
  /** The size of one cell of the noise, m — how big one cloud is. */
  scale: number;
  /** How hard the edge is, 0..1: a haze at nothing, a cauliflower at one. */
  sharpness: number;
  /** How far the cells are pulled out along the wind, 1 for not at all —
   * cirrus is combed into streaks, cumulus is not. */
  streak: number;
  /** How much of the lit-versus-shade contrast the body shows, 0..1. A
   * cumulus is a solid with a shadowed underside; a cirrus sheet is a veil
   * with no body to shade. */
  body: number;
  /** How fast it rides the level's mean wind, as a multiple of it. Scud
   * tears along under a base at nearly three times the wind on the water;
   * cirrus in the jet stream is fast too, but eight kilometres up it barely
   * seems to move. */
  drift: number;
  /** How much the sheet is combed into FIBRES, 0..1 — the fine filaments
   * along the wind that make a cirrus a cirrus (`cloudFibres`). Nothing on
   * a cumulus, which is a heap and not hair. */
  fibre: number;
  /** A seed offset into the noise, so no two sheets share a pattern. */
  seed: number;
  /** Whether the sheet is the DECK — the lid of a weathered sky, painted
   * from the preset's `Deck` rather than from the cloud tones. */
  deck: boolean;
  /** WHICH SHEET THIS SKY IS, counted from the one that matters: 0 is the
   * primary — the cloud the level is actually ridden under — and each step
   * up is a sheet the sky can be read without.
   *
   * It exists because the picture ladder drops sheets off the top of the
   * stack (`SkyLook.layers`), and altitude is the wrong order to drop them
   * in from EITHER end. Under weather the primary is the DECK and the scud
   * hangs below it, so the lowest sheet is the one to lose; on a high-cloud
   * day the primary is the veil and the cumulus under it is the one to
   * lose. Nothing about the two altitudes says that, so the chart says it
   * here instead. */
  rank: number;
};

/** Everything over one level. Ordered by altitude, lowest first — which is
 * the order the shader walks to paint them far-to-near. */
export type SkyDressing = {
  layers: CloudLayer[];
};

/** How many sheets the sky can draw at once — the uniform arrays are sized
 * to it. The chart below rolls at most three, and the fourth slot is
 * headroom for a chart that grows one. */
export const MAX_LAYERS = 4;

/** Where this coast's cumulus base sits, m over the sea. The base of a
 * cumulus is the condensation level; over cold northern water carrying a
 * lot of moisture it is low, which is what makes a taiga cumulus a fat heap
 * sitting on the tree line rather than a distant anvil. */
const CUMULUS_BASE: [number, number] = [900, 1400];

/** Under this much coverage a sheet is a whole field of noise sampled for
 * nothing: the density rule puts almost no pixel of it over the threshold
 * (`cloudDensity`), so what it costs is a slot in the budget and what it
 * returns is empty sky. Dropped instead. */
const THIN = 0.05;

/** A uniform draw on [0,1) from a seed — a tiny hash, so the same level
 * always dresses the same sky. Nothing in the simulation reads it, and
 * nothing here touches `Math.random`: the sky a seed brings back is the
 * same sky every time it is ridden. */
function dice(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

function between(roll: () => number, lo: number, hi: number): number {
  return lo + roll() * (hi - lo);
}

/** The seed a level's sky is dressed from: its own seed and the wind it was
 * dealt, so two levels under the same weather still get different clouds and
 * one level gets the same clouds every time. */
export function skySeed(level: Pick<Level, "seed" | "wind">): number {
  return (level.seed * 7919 + Math.floor(level.wind.from * 1000)) >>> 0;
}

/**
 * DRESS THE SKY for one level. `cover` is how heavy the weather is (0..1,
 * `skyCover`), and every wet sky reads it.
 *
 * `deckBase` is where the preset hangs the ceiling, m over the water — the
 * one number the lid and the sky's colours must agree on, so it is passed in
 * from the preset rather than rolled again here.
 */
export function dressSky(
  level: Pick<Level, "seed" | "wind">,
  weather: Weather,
  cover: number,
  deckBase: number | null,
): SkyDressing {
  const roll = dice(skySeed(level));

  // A CLEAR SKY IS EMPTY SKY.
  if (weather === "clear") return { layers: [] };

  if (deckBase !== null) {
    // THE DECK — one sheet that covers everything. Its altitude is the
    // preset's own base, and its genus is what is falling out of it.
    const layers: CloudLayer[] = [
      {
        genus:
          weather === "squall" ? "cumulonimbus" : weather === "rain" ? "nimbostratus" : "stratus",
        altitude: deckBase,
        thickness: weather === "squall" ? 4000 : weather === "rain" ? 1400 : 700,
        coverage: 1,
        scale: 380,
        sharpness: 0.15,
        streak: 1.3,
        body: 1,
        drift: 1,
        fibre: 0,
        seed: 3,
        deck: true,
        rank: 0,
      },
    ];
    // SCUD — the ragged fragments torn along under the base, darker than the
    // ceiling and moving visibly faster than anything else in the frame.
    // Most of what makes a squall read as violent rather than merely dark,
    // and over open water — no ridge, no tree, no roadside — it is the ONLY
    // thing in the sky that shows how hard it is blowing. A dry lid barely
    // has any: an overcast day is still air under a sheet.
    const ragged = weather === "overcast" ? 0.1 : 0.24;
    // Hung as a SHARE of the base rather than a fixed drop below it: a
    // squall's ceiling comes down to a hundred metres over the water, and a
    // rag ninety metres under that one is at mast height and fills the
    // frame with a black blob.
    layers.unshift({
      genus: "scud",
      altitude: deckBase * between(roll, 0.6, 0.78),
      thickness: 60,
      coverage: ragged + 0.3 * cover,
      scale: 190,
      sharpness: 0.35,
      streak: 1.35 + 0.6 * cover,
      body: 0.6,
      drift: weather === "overcast" ? 1.6 : 2.6,
      fibre: 0,
      seed: 5,
      deck: false,
      rank: 1,
    });
    return { layers: byAltitude(layers) };
  }

  // ── HIGH CLOUD ───────────────────────────────────────────────────────────
  // The sky that costs a game nothing and buys it most, and the reason it
  // has to be a real STACK rather than a milkier blue: a cirrostratus veil
  // eight kilometres up, combed into fibres along the jet, with fair-weather
  // cumulus riding a kilometre over the water underneath it. Two sheets at
  // two altitudes moving at two paces is what depth in a sky IS — and it is
  // the whole difference between this sky and the clear one beside it.
  //
  // The veil is deliberately kept short of covering the sky, and the heaps
  // under it deliberately generous: a cirrostratus at three-quarters cover
  // is a white sky with white cumulus in it, and the two floors that are the
  // whole point of this weather stop reading as two.
  const layers: CloudLayer[] = [
    wisps(between(roll, 7000, 9500), 0.3 + 0.26 * cover, roll, 0),
    heaps(
      "cumulus",
      between(roll, CUMULUS_BASE[0], CUMULUS_BASE[1]),
      between(roll, 0.3, 0.52),
      roll,
      1,
    ),
  ];
  return { layers: byAltitude(layers.filter((l) => l.coverage >= THIN).slice(0, MAX_LAYERS)) };
}

/** The stack in the order the sky paints it: lowest sheet first, so the
 * shader's walk from the far side comes out far-to-near whether the ray is
 * going up or down. The chart pushes in the order it THINKS in — the sheet
 * that defines the sky, then whatever is under it — and that is not always
 * the order the altitudes are in. */
function byAltitude(layers: CloudLayer[]): CloudLayer[] {
  return [...layers].sort((a, b) => a.altitude - b.altitude);
}

/** Fair-weather heaps: hard-edged, solid, shadowed underneath, riding the
 * wind at about the speed of the wind. */
function heaps(
  genus: CloudGenus,
  altitude: number,
  coverage: number,
  roll: () => number,
  rank: number,
): CloudLayer {
  return {
    genus,
    altitude,
    thickness: 500 + coverage * 900,
    coverage,
    scale: between(roll, 700, 1100),
    sharpness: 0.75,
    streak: 1.15,
    body: 1,
    drift: 1,
    fibre: 0,
    seed: 11,
    deck: false,
    rank,
  };
}

/** Cirrus and cirrostratus — ice eight kilometres up, combed into long
 * streaks along the wind, with no body to shade: what burns after the sun
 * has left the water. The sheet says where the veil is; the fibres are what
 * it is made of — the hair-like filaments a cirrus reads by, drawn over the
 * sheet rather than as it, so a big soft sweep of it still has fine
 * structure inside. */
function wisps(altitude: number, coverage: number, roll: () => number, rank: number): CloudLayer {
  return {
    genus: coverage > 0.55 ? "cirrostratus" : "cirrus",
    altitude,
    thickness: 120,
    coverage,
    scale: between(roll, 2600, 3600),
    sharpness: 0.18,
    streak: between(roll, 2.6, 3.6),
    body: 0.1,
    drift: 1.8,
    fibre: between(roll, 0.45, 0.65),
    seed: 29,
    deck: false,
    rank,
  };
}

// ── The noise, twice ───────────────────────────────────────────────────────
//
// Once as GLSL and once on the CPU, walking the same lattice with the same
// hash. Each octave is turned and scaled by the same matrix on both sides;
// a change to one is a change to the other, and `tests/cloud_field_test.ts`
// holds them together.

/** The two fbm arms `cloudField` reads an `octaves`-deep field from: the
 * MASS, and the detail that erodes its edges. Stated once, in TypeScript,
 * because the emitter below and every caller asking for a field have to
 * agree on which arms that field needs compiled. */
export function fieldArms(octaves: number): [number, number] {
  return [Math.min(octaves, 2), Math.max(octaves - 2, 1)];
}

/** How deep the FIBRES are read, whatever the sheet over them is read at —
 * see `cloudFibres`. The fibres are already the finest thing in the sky and
 * a third octave of them is shimmer. */
const FIBRE_OCTAVES = 2;

/**
 * THE NOISE, EMITTED AT THE DEPTHS THE CALLER ACTUALLY READS IT AT.
 *
 * The depth has to be a LITERAL, which is why this is an emitter and not one
 * `cloudFbm(p, octaves)` taking the depth as an argument. A trip count the
 * compiler cannot see is a loop it cannot unroll, so every octave of every
 * sample carries a compare, a branch and a live counter — on a shader that
 * covers the whole sky and, through the water's mirror, most of the rest of
 * the frame. One function per depth makes each bound a constant, which
 * unrolls, folds the amplitudes and the divisor, and leaves no control flow
 * at all.
 *
 * `fields` is the depths asked for: a `cloudField<n>` plus both its arms for
 * each. Ask for the depths that are read and no others — every one emitted
 * is another function for a phone to compile at the first frame it is
 * needed. The lattice and the fibres come out whatever is asked, because
 * every field is read off the one and can be combed by the other.
 */
export function cloudNoiseGlsl(fields: readonly number[]): string {
  const wanted = new Set<number>([FIBRE_OCTAVES]);
  for (const octaves of fields) for (const arm of fieldArms(octaves)) wanted.add(arm);
  const fbm = (n: number): string => `
float cloudFbm${n}( vec2 p ) {
  float v = 0.0;
  float a = 0.5;
  float total = 0.0;
  for ( int i = 0; i < ${n}; i ++ ) {
    v += a * cloudNoise( p );
    total += a;
    p = vec2( 1.6 * p.x + 1.2 * p.y, - 1.2 * p.x + 1.6 * p.y ) + vec2( 17.3, 9.1 );
    a *= 0.5;
  }
  return v / total;
}`;
  // THE FIELD a sheet is cut from: a few big masses, and detail that only
  // erodes their edges. Thresholding six octaves of fbm directly gives a sky
  // of small islands — a mackerel sky at noon whatever the genus — because
  // the fine octaves put the threshold over and under everywhere; weighting
  // the mass first is what makes a cumulus a heap with a ragged edge rather
  // than a scatter of flecks.
  const field = (n: number): string => {
    const [mass, detail] = fieldArms(n);
    return `
float cloudField${n}( vec2 uv ) {
  return 0.76 * cloudFbm${mass}( uv ) + 0.24 * cloudFbm${detail}( uv * 2.6 + vec2( 7.1, 3.3 ) );
}`;
  };
  const sorted = [...wanted].sort((a, b) => a - b);
  const once = [...new Set(fields)].sort((a, b) => a - b);
  return `${CLOUD_HASH_GLSL}${sorted.map(fbm).join("")}${CLOUD_FIBRES_GLSL}${once
    .map(field)
    .join("")}
${CLOUD_DENSITY_GLSL}`;
}

/** THE FIBRES a cirrus is combed into: the field read again at a pitch that
 * is fine ACROSS the wind and long along it (the uv is already stretched
 * along the wind by the streak, so the squeeze is across), and used to
 * modulate the sheet where it already is rather than to cut it — a filament
 * is a place the veil is denser, not a cloud of its own. */
const CLOUD_FIBRES_GLSL = /* glsl */ `
float cloudFibres( vec2 uv, float n, float fibre ) {
  if ( fibre <= 0.0 ) return n;
  float f = cloudFbm${FIBRE_OCTAVES}( vec2( uv.x * 1.7, uv.y * 9.0 ) + vec2( 3.7, 11.9 ) );
  return mix( n, n * ( 0.5 + 1.0 * f ), fibre );
}`;

/** The lattice itself, shared by every depth above. Value noise from a hash
 * that does not go through `sin` — the classic
 * `fract(sin(dot(...)) * 43758.5453)` loses its mind in mediump and
 * disagrees with itself between a phone and a desktop, and this one is
 * products and fractions the whole way. */
const CLOUD_HASH_GLSL = /* glsl */ `
float cloudHash( vec2 p ) {
  vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
  p3 += dot( p3, p3.yzx + 33.33 );
  return fract( ( p3.x + p3.y ) * p3.z );
}
float cloudNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  float a = cloudHash( i );
  float b = cloudHash( i + vec2( 1.0, 0.0 ) );
  float c = cloudHash( i + vec2( 0.0, 1.0 ) );
  float d = cloudHash( i + vec2( 1.0, 1.0 ) );
  return mix( mix( a, b, f.x ), mix( c, d, f.x ), f.y );
}`;

function fract(v: number): number {
  return v - Math.floor(v);
}

/** The same hash, on the CPU. */
export function cloudHash(x: number, y: number): number {
  let px = fract(x * 0.1031);
  let py = fract(y * 0.1031);
  let pz = fract(x * 0.1031);
  const d = px * (py + 33.33) + py * (pz + 33.33) + pz * (px + 33.33);
  px += d;
  py += d;
  pz += d;
  return fract((px + py) * pz);
}

export function cloudNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let fx = x - ix;
  let fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = cloudHash(ix, iy);
  const b = cloudHash(ix + 1, iy);
  const c = cloudHash(ix, iy + 1);
  const d = cloudHash(ix + 1, iy + 1);
  const top = a + (b - a) * fx;
  const bottom = c + (d - c) * fx;
  return top + (bottom - top) * fy;
}

export function cloudFbm(x: number, y: number, octaves: number): number {
  let v = 0;
  let a = 0.5;
  let total = 0;
  let px = x;
  let py = y;
  for (let i = 0; i < Math.min(6, octaves); i++) {
    v += a * cloudNoise(px, py);
    total += a;
    const nx = 1.6 * px + 1.2 * py + 17.3;
    const ny = -1.2 * px + 1.6 * py + 9.1;
    px = nx;
    py = ny;
    a *= 0.5;
  }
  return total > 0 ? v / total : 0;
}

/** The same field as `cloudField` in the GLSL: the mass at two octaves,
 * eroded by detail at the rest. */
export function cloudField(x: number, y: number, octaves: number): number {
  const [mass, detail] = fieldArms(octaves);
  return 0.76 * cloudFbm(x, y, mass) + 0.24 * cloudFbm(x * 2.6 + 7.1, y * 2.6 + 3.3, detail);
}

/** The same fibres as `cloudFibres` in the GLSL, on the CPU — at the same
 * fixed depth, so the cirrus dimming the sun is the cirrus on the dome. */
export function cloudFibres(u: number, v: number, n: number, fibre: number): number {
  if (fibre <= 0) return n;
  const f = cloudFbm(u * 1.7 + 3.7, v * 9.0 + 11.9, FIBRE_OCTAVES);
  return n + (n * (0.5 + 1.0 * f) - n) * fibre;
}

/** Where a sheet's noise is read for a point on it: the world position, the
 * sheet's own drift offset, turned so the streak runs along the wind and
 * scaled to the sheet's cells. Stated once so the GLSL and the CPU take the
 * same sample — the shader restates it (`cloudUv` in `sky-glsl.ts`), and
 * `tests/cloud_field_test.ts` holds the two together. */
export function cloudUv(
  layer: Pick<CloudLayer, "scale" | "streak" | "seed">,
  x: number,
  z: number,
  offsetX: number,
  offsetZ: number,
  windX: number,
  windZ: number,
): [number, number] {
  const px = x + offsetX;
  const pz = z + offsetZ;
  // Along the wind (`windX`, `windZ` is its unit vector) and across it.
  const along = px * windX + pz * windZ;
  const across = -px * windZ + pz * windX;
  return [along / (layer.scale * layer.streak) + layer.seed * 13.7, across / layer.scale];
}

/** How much cloud there is at a field value `n` on a sheet, 0..1: the
 * coverage sets the threshold and the sharpness how soft the edge is.
 * `cloudField` runs about 0.2..0.8, so the threshold walks that band and a
 * coverage of one is a sky with no hole in it. */
export function cloudDensity(layer: Pick<CloudLayer, "coverage" | "sharpness">, n: number): number {
  const threshold = 0.5 + (0.5 - layer.coverage) * 0.5;
  const soft = 0.04 + 0.3 * (1 - layer.sharpness);
  const t = (n - threshold) / soft + 0.5;
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

/** The same rule, as GLSL. */
const CLOUD_DENSITY_GLSL = /* glsl */ `
float cloudDensity( float coverage, float sharpness, float n ) {
  float threshold = 0.5 + ( 0.5 - coverage ) * 0.5;
  float soft = 0.04 + 0.3 * ( 1.0 - sharpness );
  return smoothstep( 0.0, 1.0, ( n - threshold ) / soft + 0.5 );
}
`;

/** How much of a sheet's fibres are drawn on a ray at this elevation (`up`,
 * the ray's or the sun's y), 0..1. Toward the horizon a sheet eight
 * kilometres up is seen a hundred kilometres away, where the fibres are
 * under a pixel and only sparkle: they are faded out over the lowest fifteen
 * degrees, and the veil is left to the haze. */
export function fibreAt(up: number): number {
  const t = Math.abs(up) / 0.25;
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

/**
 * HOW MUCH CLOUD IS BETWEEN A POINT AND THE SUN, 0..1 — what the key light
 * would be dimmed by if a sheet came over the sun. The ray from `(x, y, z)`
 * toward the sun pierces a sheet above it at one point; the noise there is
 * the answer. A sheet under the point does not shade it, and a sun on the
 * water shades nothing.
 *
 * Read with the same octaves the sky draws, so the cloud the rider sees over
 * the sun is the cloud the light answers to.
 */
export function sunOcclusion(
  layer: CloudLayer,
  x: number,
  y: number,
  z: number,
  sunDir: { x: number; y: number; z: number },
  offsetX: number,
  offsetZ: number,
  windX: number,
  windZ: number,
  octaves: number,
): number {
  if (sunDir.y <= 0.02 || layer.altitude <= y) return 0;
  const dist = (layer.altitude - y) / sunDir.y;
  const px = x + sunDir.x * dist;
  const pz = z + sunDir.z * dist;
  const [u, v] = cloudUv(layer, px, pz, offsetX, offsetZ, windX, windZ);
  const n = cloudFibres(u, v, cloudField(u, v, octaves), layer.fibre * fibreAt(sunDir.y));
  return cloudDensity(layer, n) * Math.min(1, layer.body + 0.3);
}
