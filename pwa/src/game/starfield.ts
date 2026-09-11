// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE NIGHT SKY ITSELF — the stars, and the galaxy they are a near corner
// of. Nothing here owns a mesh or a frame: it is where the sphere of fixed
// stars has TURNED to this hour, where the Milky Way lies across it, and
// the GLSL the dome paints that band with. Adapted from the sibling rally
// game's, which paints the same sky over a valley; over open water it is
// reflected too, though only as the moon's road — the mirror is rough, and
// a star field seen through a spread of wave slopes is grain, not stars.
//
// Three ideas, and the whole module is them:
//
//   THE TURN     The stars are on a sphere that wheels once a day about a
//                pole standing at the coast's own latitude (the same number
//                `daylight.ts` puts the sun's arc on). The hour spins it
//                and the SEASON offsets it, so a winter midnight and a
//                summer one look out at different parts of the sky.
//   THE GALAXY   A great circle tilted 63° to that pole, at the real
//                inclination, so the band rises steeply out of one horizon
//                instead of lying round the rim like a ring. Its core is a
//                bulge, its arms are mottled, and the Great Rift is a dark
//                lane of dust down the middle of the brightest part.
//   THE WASH     Nothing here is ever seen against a black page. What takes
//                the faint sky away is the air at the horizon, the moon's
//                own glare, and the cloud in front — the first two are this
//                module's, the third is the cloud sheets drawing OVER it.

import * as THREE from "three";
import { SOUTH, type Season } from "@engine";

import { sunVector } from "./sky.ts";

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

/** How deep the galaxy's mottle and its dust are read. Three octaves: the
 * band is a broad soft thing and a fourth octave of it is film grain, which
 * at this brightness is indistinguishable from the stars in front of it. */
export const GALAXY_OCTAVES = 3;

/** Where the sphere of fixed stars stands: the pole it turns about, and how
 * far round it has come. */
export type SkyTurn = {
  /** The celestial pole's elevation, radians — the coast's latitude. */
  pole: number;
  /** …and the heading it stands at: due north, in the engine's convention. */
  bearing: number;
  /** How far the sphere has turned about that pole, radians. */
  spin: number;
};

/** Where in the year each season's nights are, as a fraction of the way
 * round the sun — the same mid-season dates `DECLINATION` is written for
 * (`engine/lib/solar.ts`). It is what makes the sky at midnight a different
 * sky in June and December, and the offset is a whole turn a year, so a
 * quarter of the year is a quarter of the sky. */
const SIDEREAL: Record<Season, number> = {
  spring: 135 / 365,
  summer: 172 / 365,
  autumn: 268 / 365,
  winter: 355 / 365,
};

/** Where the sphere of stars has turned to at `hour`, this season, over a
 * coast at `latitude` degrees north. */
export function skyTurnAt(hour: number, season: Season, latitude: number): SkyTurn {
  return {
    pole: latitude * DEG,
    bearing: SOUTH + Math.PI,
    spin: -TAU * (hour / 24 + SIDEREAL[season]),
  };
}

/** The turn's three axes, as WORLD directions: the two spanning the equator
 * with the spin already in them, and the pole. A celestial direction times
 * these is the world one. */
function turnAxes(turn: SkyTurn): [THREE.Vector3, THREE.Vector3, THREE.Vector3] {
  const p = sunVector(turn.pole, turn.bearing);
  const pole = new THREE.Vector3(p.x, p.y, p.z);
  // Any two axes across the pole will do — the spin is measured from
  // whichever one is picked, and nothing outside this file knows which.
  const seed = Math.abs(pole.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const a = new THREE.Vector3().crossVectors(seed, pole).normalize();
  const b = new THREE.Vector3().crossVectors(pole, a);
  const c = Math.cos(turn.spin);
  const s = Math.sin(turn.spin);
  return [
    a.clone().multiplyScalar(c).addScaledVector(b, s),
    b.clone().multiplyScalar(c).addScaledVector(a, -s),
    pole,
  ];
}

/** The turn as a change of basis, written into `out`: multiply a WORLD
 * direction by this and out comes the same direction in celestial
 * coordinates. What the dome carries as a uniform, so that every pixel's
 * ray can be asked where on the sphere it is looking. */
export function turnBasis(turn: SkyTurn, out: THREE.Matrix3): THREE.Matrix3 {
  const [e1, e2, pole] = turnAxes(turn);
  // Rows, so the product takes world into celestial rather than the other
  // way about (`Matrix3.set` reads its arguments row by row).
  return out.set(e1.x, e1.y, e1.z, e2.x, e2.y, e2.z, pole.x, pole.y, pole.z);
}

/** THE GALACTIC FRAME, in celestial coordinates, at the real angles: the
 * north galactic pole stands 63° off the celestial one (declination +27°),
 * the centre lies 90° from it in the band, and the third axis closes the
 * set. Written out rather than derived so the shader can have them as
 * literals.
 *
 * These are what tilt the band. A Milky Way laid on the celestial equator
 * would circle the sky parallel to the horizon and read as a seam in the
 * dome; at 63° it comes up out of the north-east, crosses overhead and goes
 * down in the south-west, which is what a real one does and what makes a
 * night sky look like a photograph of one. */
const GAL_POLE = [-0.86767, -0.19807, 0.45598] as const;
const GAL_CENTRE = [-0.054878, -0.873439, -0.483831] as const;
const GAL_SIDE = [0.494103, -0.444829, 0.746987] as const;

/** A vector as a GLSL literal. Six places, which is what the galactic
 * frame's axes need to still be orthonormal on the other side. */
const vec3 = (v: readonly number[]): string => `vec3( ${v.map((n) => n.toFixed(6)).join(", ")} )`;

/** What the band is coloured. The arms are the cold blue-white of a
 * hundred thousand faint stars smeared together; the core, seen through the
 * whole thickness of the disc's dust, is reddened to a dim amber. Fixed
 * rather than authored per rung: the galaxy is not lit by anything this
 * game has, so all the sky may do to it is take it away. */
const GALAXY_ARM = 0x8fa4d8;
const GALAXY_CORE = 0xd8b487;

/** How wide the bright part of the band is, in sines of galactic latitude —
 * a tight core with a broad faint halo either side of it, because that is
 * the shape of a disc seen edge-on from inside it. */
const BAND_TIGHT = 22;
const BAND_BROAD = 5.5;

/** Where the band is given up as not worth drawing. It is SUBTRACTED rather
 * than tested against, so what is given up goes to nothing instead of
 * stopping: tested, the halo's own falloff crosses this number at about 62°
 * of galactic latitude and rules a hard circle round each galactic pole —
 * eight levels of a black sky, which the eye finds. Subtracting costs the
 * rest of the band a fraction of a per cent of a peak of one. */
const BAND_FLOOR = 0.004;

/** THE BAND'S OWN LATTICE, and why it is not the cloud one.
 *
 * A galaxy is mottled round a CIRCLE: galactic longitude comes back to
 * where it started after a full turn, and value noise on an open lattice
 * does not come back with it. Sampled at `atan`'s own longitude the two
 * ends of the turn land in unrelated noise, and the cut rules a hard line
 * down the sky — measured at seed 38's autumn 21:00, a step between two
 * neighbouring pixels eight to twenty-four times the biggest step anywhere
 * else in the band, straight through the brightest part of it. It reads as
 * the sky repeating.
 *
 * So the band's field WRAPS: a whole number of noise cells to the turn,
 * which is what lets the lattice be folded back on itself (`galNoise`).
 * These are the counts — the clumps read fine, the dust that wanders the
 * rift read at about half the pitch — and they MUST be whole, which is
 * what `tests/starfield_test.ts` holds them to.
 */
const CLUMP_CELLS = 28;
const DUST_CELLS = 16;

/** …and how many cells the same fields are read at ACROSS the band, per
 * sine of galactic latitude. Free of the wrap — there is nothing to come
 * back to across a band — so this is the pitch that decides how drawn-out
 * a star cloud is: the clumps run about three times longer along the band
 * than across it, which is the shape of the real thing. */
const CLUMP_ACROSS = 12.35;
const DUST_ACROSS = 6.83;

/** Where the band's two fields are sampled, given the ray's galactic
 * longitude and the sine of its galactic latitude. Stated here rather than
 * in the shader's own text so the wrap is a thing a test can check: a turn
 * of longitude has to move `uv.x` by exactly the whole number of cells the
 * lattice folds at, or the fold does not close. */
export function galaxyUv(
  lon: number,
  lat: number,
  cells: number,
  across: number,
): [number, number] {
  return [(lon / TAU) * cells, lat * across];
}

/** The two fields' cell counts, for the test that holds them whole. */
export const GALAXY_CELLS = { clumps: CLUMP_CELLS, dust: DUST_CELLS } as const;

/** HOW MUCH BAND THERE IS AT ALL, over the top of everything below. The one
 * number to move when the Milky Way is too much or not enough, and it is
 * bounded on both sides: under it the band stops being visible against the
 * dark sky's own zenith at all, and over it, it stops reading as a glow
 * behind the stars and starts reading as a light source parked behind the
 * skerries. `make sky`'s night columns are how it is judged. */
const BAND_GAIN = 0.78;

/** How far toward the centre the BULGE reaches, and how much it adds. Broad
 * and gentle: a tight peak here reads as a searchlight parked behind the
 * horizon, which is the one thing the core must never look like. */
const BULGE_REACH = 4;
const BULGE_LIFT = 0.55;

/** How far the DARK LANE is off the middle of the band and how tight it is
 * — the Great Rift, the dust in our own arm cutting the light of everything
 * behind it. Only bites where the band is bright, which is why it reads as
 * a rift rather than as a stripe painted over the sky. */
const RIFT_OFF = 0.02;
const RIFT_TIGHT = 26;

/** The SMUDGES: the other galaxies, each a faint oval a couple of degrees
 * across at a fixed place on the sphere. Three of them — a big spiral well
 * off the band, and the two ragged companions low on the other side. At a
 * naked eye's resolution that is honestly all any of them is.
 *
 * Each is a direction in celestial coordinates, the angular radius of its
 * long axis in radians, how much it is squashed across, and how bright. */
const SMUDGES: readonly { at: readonly number[]; size: number; squash: number; lit: number }[] = [
  { at: [0.562047, 0.415809, 0.714987], size: 0.055, squash: 0.42, lit: 0.55 },
  { at: [0.218878, -0.310569, -0.925008], size: 0.075, squash: 0.78, lit: 0.4 },
  { at: [0.356219, -0.127607, -0.925648], size: 0.045, squash: 0.85, lit: 0.28 },
];

/** THE NIGHT SKY AS GLSL — the stars, the band and the smudges, added to a
 * sky colour that has already been painted. Emitted rather than written out
 * because the frame it lands in has to compile the noise it reads at a
 * literal depth (`cloudNoiseGlsl` owns why), and because the caller decides
 * whether it is emitted at all.
 *
 * `cloudHash` is the caller's to provide (`cloudNoiseGlsl`) — every sky
 * already emits the lattice's hash, and a second one here would be a second
 * copy of the same four lines. The FIELDS are this module's own, because
 * the band's has to wrap where the cloud chart's must not (`galNoise`).
 *
 * The one function it leaves behind takes the ray in CELESTIAL coordinates
 * and its world elevation, and returns what to add. It is guarded on the
 * strengths by its caller: by day both are zero and none of it is
 * evaluated. */
export function starfieldGlsl(): string {
  return /* glsl */ `
const vec3 GAL_POLE = ${vec3(GAL_POLE)};
const vec3 GAL_CENTRE = ${vec3(GAL_CENTRE)};
const vec3 GAL_SIDE = ${vec3(GAL_SIDE)};

// A STAR'S OWN HASH, three dimensions in and one out. The cloud lattice's
// takes a vec2 and the sky is a vec3 of cells, and the obvious flattening
// — x + 57z, y + 13z — is not injective: the cells that collide are not
// scattered about, they satisfy one linear equation, so they lie along a
// circle on the sphere. A band of the sky comes out an EXACT copy of
// another band, the same stars at the same brightnesses in the same places
// in their cells. Four per cent of the coarse shell and five of the fine
// one were duplicates of somewhere else before this.
float starHash( vec3 p, float salt ) {
  vec3 p3 = fract( ( p + salt ) * 0.1031 );
  p3 += dot( p3, p3.zyx + 31.32 );
  return fract( ( p3.x + p3.y ) * p3.z );
}

// THE BAND'S OWN LATTICE: value noise that WRAPS in x at a whole number of
// cells, so a coordinate that goes once round the galaxy's longitude comes
// back to the noise it started in. Folding the cell index is the trick, and
// is why the octaves DOUBLE the lattice rather than rotating the domain the
// cloud field's do — a rotation mixes y into x and there is no period left
// to fold at. The offset each octave is across the band only, where there
// is nothing to come back to.
float galNoise( vec2 p, float period ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  float x0 = mod( i.x, period );
  float x1 = mod( i.x + 1.0, period );
  float a = cloudHash( vec2( x0, i.y ) );
  float b = cloudHash( vec2( x1, i.y ) );
  float c = cloudHash( vec2( x0, i.y + 1.0 ) );
  float d = cloudHash( vec2( x1, i.y + 1.0 ) );
  return mix( mix( a, b, f.x ), mix( c, d, f.x ), f.y );
}

float galField( vec2 p, float period ) {
  float v = 0.0;
  float a = 0.5;
  float total = 0.0;
  for ( int i = 0; i < ${GALAXY_OCTAVES}; i ++ ) {
    v += a * galNoise( p, period );
    total += a;
    a *= 0.5;
    p = p * 2.0 + vec2( 0.0, 19.3 );
    period *= 2.0;
  }
  return v / total;
}

// The colour of one star, from a spectral class rolled 0..1: blue-white
// through white to amber. The roll reaching this is already skewed warm,
// which is the sky's own census — the eye's brightest stars are a mixed
// bag but its faint ones are overwhelmingly small and orange.
vec3 starTone( float t ) {
  vec3 hot = vec3( 0.70, 0.80, 1.00 );
  vec3 mid = vec3( 1.00, 0.98, 0.94 );
  vec3 warm = vec3( 1.00, 0.78, 0.58 );
  return t < 0.5 ? mix( hot, mid, t * 2.0 ) : mix( mid, warm, ( t - 0.5 ) * 2.0 );
}

// ONE SHELL OF STARS: the sky quantised into cells, one star to a cell
// that rolls high enough, jittered off the cell's middle so the field is a
// field and not a lattice.
//
// The pixel argument is how many radians a screen pixel is worth (the
// caller measures it), and it is what a star is SIZED by. A star drawn at
// an angular size is the one thing here that cannot be authored: at a
// contact sheet's 240 pixels it comes out under a pixel across and
// vanishes, and at 1080p the same number is a five pixel blob. Sized in
// pixels instead, the grid is left doing the one job it is good at —
// deciding how MANY stars there are — and every screen gets the same sky.
vec3 starShell( vec3 sky, float cells, float thresh, float pixel, float time, float scint ) {
  vec3 sd = sky * cells;
  vec3 cell = floor( sd );
  float h = starHash( cell, 0.0 );
  if ( h < thresh ) return vec3( 0.0 );
  float rank = ( h - thresh ) / max( 1.0 - thresh, 1e-4 );
  float g = starHash( cell, 37.0 );
  // Where in its cell, and how bright. The magnitude is a steep power of
  // the rank, so a cell that only just qualifies is a speck and the rare
  // one at the top of the roll is a proper star.
  vec3 jitter = vec3( fract( g * 13.0 ), fract( g * 71.0 ), fract( g * 191.0 ) );
  float mag = pow( rank, 2.1 );
  float d = length( fract( sd ) - mix( vec3( 0.28 ), vec3( 0.72 ), jitter ) );
  // A pixel and a bit for the faintest, two and a half for the brightest,
  // in cells — and never past a cell's own half, which is where a star
  // would start being cut off by the grid that placed it.
  float radius = min( pixel * cells * ( 1.15 + 1.35 * mag ), 0.42 );
  float disc = smoothstep( radius, 0.0, d );
  if ( disc <= 0.0 ) return vec3( 0.0 );
  // SCINTILLATION: air, not the star. Each has its own rate and phase, and
  // the amplitude is the caller's — it grows toward the horizon, where the
  // line of sight runs the long way through the atmosphere.
  float rate = 2.0 + fract( h * 53.0 ) * 6.0;
  float twinkle = 1.0 + scint * sin( time * rate + g * 40.0 );
  // The floor is high on purpose. A star is a point light against a nearly
  // black sky and the eye finds it however faint it is; a star drawn as a
  // fraction of a pixel at a fraction of the sky's own brightness is not a
  // faint star, it is no star.
  return starTone( pow( fract( g * 29.0 ), 0.7 ) ) * disc * ( 0.55 + 1.15 * mag ) * twinkle;
}

// THE BAND. The argument is the ray in celestial coordinates; the return
// is how much galaxy is behind this pixel and what colour it is.
vec3 milkyWay( vec3 sky ) {
  float lat = dot( sky, GAL_POLE );
  float along = dot( sky, GAL_CENTRE );
  float across = dot( sky, GAL_SIDE );
  float lon = atan( across, along );
  // A disc seen edge-on: a tight bright ridge inside a broad faint halo.
  float band = 0.72 * exp( - lat * lat * ${BAND_TIGHT.toFixed(1)} )
             + 0.28 * exp( - lat * lat * ${BAND_BROAD.toFixed(1)} );
  band -= ${BAND_FLOOR.toFixed(3)};
  if ( band <= 0.0 ) return vec3( 0.0 );
  // THE BULGE toward the centre, and the arms falling away behind us.
  float bulge = pow( max( along, 0.0 ), ${BULGE_REACH.toFixed(1)} );
  band *= 0.42 + 0.58 * pow( max( along * 0.5 + 0.5, 0.0 ), 1.6 ) + ${BULGE_LIFT.toFixed(2)} * bulge;
  // The mottle, read along the band rather than across it, so the clumps
  // are drawn out the way star clouds are — and read off the WRAPPING
  // lattice, so the turn closes where the arc tangent's own cut runs.
  vec2 cu = vec2( lon * ${(CLUMP_CELLS / TAU).toFixed(6)}, lat * ${CLUMP_ACROSS.toFixed(2)} );
  vec2 du = vec2( lon * ${(DUST_CELLS / TAU).toFixed(6)}, lat * ${DUST_ACROSS.toFixed(2)} );
  float clumps = galField( cu + vec2( 0.0, 1.3 ), ${CLUMP_CELLS.toFixed(1)} );
  float dust = galField( du + vec2( 0.0, 7.0 ), ${DUST_CELLS.toFixed(1)} );
  band *= 0.42 + 1.05 * clumps;
  // THE GREAT RIFT: dust in our own arm, a dark lane wandering down the
  // brightest part of the band and nowhere else.
  float off = lat - ${RIFT_OFF.toFixed(3)} * ( 1.0 + 2.0 * dust );
  float lane = exp( - off * off * ${(RIFT_TIGHT * RIFT_TIGHT).toFixed(1)} );
  band *= 1.0 - 0.62 * lane * smoothstep( 0.0, 0.55, bulge + 0.25 );
  vec3 tone = mix( ${vec3(new THREE.Color(GALAXY_ARM).toArray())},
                   ${vec3(new THREE.Color(GALAXY_CORE).toArray())},
                   clamp( bulge * 0.9 + 0.1 * clumps, 0.0, 1.0 ) );
  return tone * band * ${BAND_GAIN.toFixed(2)};
}

vec3 smudge( vec3 sky, vec3 at, float size, float squash, float lit ) {
  float along = dot( sky, at );
  if ( along < 0.9 ) return vec3( 0.0 );
  // The offset from its middle, split into the oval's two axes.
  vec3 off = sky - at * along;
  vec3 major = normalize( cross( at, GAL_POLE ) );
  float u = dot( off, major );
  float v = length( off - major * u );
  float r = length( vec2( u, v / max( squash, 0.05 ) ) ) / size;
  // A core inside a halo, the way every one of them looks: bright middle,
  // long faint skirt.
  float glow = 0.55 * exp( - r * r * 2.2 ) + 0.45 * exp( - r * r * 0.35 );
  return vec3( 0.78, 0.80, 0.92 ) * glow * lit;
}

// The other galaxies: ovals, and small enough that the whole of each is
// two hashes' worth of light.
vec3 smudges( vec3 sky ) {
  vec3 sum = vec3( 0.0 );
${SMUDGES.map(
  (s) =>
    `  sum += smudge( sky, ${vec3(s.at)}, ${s.size.toFixed(3)}, ${s.squash.toFixed(2)}, ${s.lit.toFixed(2)} );`,
).join("\n")}
  return sum;
}

// EVERYTHING ABOVE, over one ray: the ray in celestial coordinates, its
// world elevation, how close it is to the moon (1 at the disc, 0 away from
// it), and the two strengths, which are the preset's own.
vec3 nightSky( vec3 sky, vec3 ray, float up, float glare, float stars, float galaxy, float time ) {
  // HOW BIG A PIXEL IS, in radians — measured off the view ray rather than
  // assumed, so the field is the same field on a phone, on a desktop and on
  // a contact sheet. Taken here, where the flow is still uniform: the
  // branch above is on a uniform and the ones below are not, and a
  // derivative asked for inside those is undefined.
  float pixel = max( length( fwidth( ray ) ), 1e-5 );
  // EXTINCTION: five airmasses at the rim take most of a star and all of a
  // galaxy, and under the horizon there is nothing to see through at all.
  float air = smoothstep( - 0.005, 0.10, up );
  air *= 0.42 + 0.58 * smoothstep( 0.03, 0.42, up );
  if ( air <= 0.0 ) return vec3( 0.0 );
  // The moon's own sky glow: a wash round the key that the faint sky
  // simply does not survive, and the reason a full moon is worth riding
  // under at all — it takes the galaxy and leaves the bright stars.
  float wash = 1.0 - 0.85 * glare;
  float scint = 0.14 + 0.55 * pow( 1.0 - min( up, 1.0 ), 7.0 );
  vec3 col = vec3( 0.0 );
  if ( galaxy > 0.0 ) {
    col += ( milkyWay( sky ) + smudges( sky ) ) * galaxy * air * wash * wash;
  }
  if ( stars > 0.0 ) {
    // Two shells: the naked eye's few hundred bright stars on a coarse
    // grid, and the thousands of faint ones on a fine one. The faint shell
    // is the one the band thickens — a Milky Way IS its unresolved stars,
    // so the drift of pinpricks and the glow behind them are the same
    // object seen at two resolutions.
    float lat = dot( sky, GAL_POLE );
    float crowd = exp( - lat * lat * 9.0 );
    // The counts these two thresholds buy, over the whole sphere: about
    // four hundred and fifty on the coarse grid and six thousand on the
    // fine one — a naked eye's census of a dark sky, split the way the eye
    // splits it into the stars it names and the ones it only registers as
    // a crowd.
    col += starShell( sky, 70.0, 0.9925, pixel, time, scint ) * stars * air;
    col += starShell( sky, 150.0, 0.9790 - 0.0120 * crowd, pixel, time, scint )
         * stars * air * wash * ( 0.50 + 0.30 * crowd );
  }
  return col;
}
`;
}
