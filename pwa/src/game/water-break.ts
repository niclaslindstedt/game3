// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT IS BREAKING — the one rule that says how much of a piece of sea has
// gone over, as a number 0..1. `water-mesh.ts` asks it per vertex and sows
// the answer into the foam field; `scripts/surf-lab.mjs` draws it against the
// distance from the shore; `tests/water_break_test.ts` holds it. Three-free
// and DOM-free on purpose, so all three can read the SAME statement of the
// rule rather than three that agree until one of them moves.
//
// THREE THINGS PUT WHITE WATER ON A SEA, and they are not the same thing:
//
//   THE SHOAL      the bed comes up, the wave cannot stand in the water it
//                  has left, and it falls over. This is SURF — the band off
//                  a beach where every wave goes, whatever the wind is
//                  doing. It is the one that is a function of the DEPTH.
//   THE CREST      out in deep water the top of a steep wave still spills
//                  down its own face. A few crests in a running sea, never
//                  the faces under them.
//   THE WIND       past about a fresh breeze the wind blows the tops off:
//                  whitecaps. A SPRINKLE at the winds a level is dealt and
//                  a field of white in the storm past the rim.
//
// The order matters because it is the order of SIZE. Measured coverage of a
// real sea (Monahan & O'Muircheartaigh 1980, W ≈ 3.84e-6·U^3.41) is about
// 1 % of the surface at 10 m/s and 4 % at 15 — a scatter — while the surf
// line off a beach is continuous white. A model that reads them the other way
// round is an ocean painted like a snowfield with a clean beach in front of
// it, which is exactly backwards from what a rider sees.
//
// WHERE THE SHOAL BAND COMES FROM, and why it is not a depth in metres: the
// engine already states the sea a given depth can hold — `TUNING.sea.breakingHs`
// × the depth, Nelson (1994)'s depth-limited significant height, which is
// what `surfaceAt` clips the field to. So the honest measure of "is this
// water tripping the sea" is the sea's height over that limit — the DEPTH
// LOAD below. It is 0 in deep water and 1 exactly where the engine's own clip
// bites, and it scales itself: a three-metre sea starts standing up in eleven
// metres of water and a half-metre one in under two, with no second number
// anywhere saying so.

import { TUNING } from "@engine";

/** THE DEPTH LOAD the surf band is read against: where the sea here first
 * starts standing up on the bed, and where it is going over along its whole
 * face. 1 is the depth-limited height itself (`TUNING.sea.breakingHs`·d), the
 * ceiling `surfaceAt` clips the field to.
 *
 * It opens well under 1 because a wave does not wait for the clip to trip:
 * shoaling has been growing it and the bed has been shortening it for a
 * while by then, and the visible surf line off a beach is a BAND tens of
 * metres wide, not the single contour where the arithmetic saturates. 0.4 is
 * about eleven metres of water under a three-metre sea, and full white by
 * five — which is the ribbon of surf a rider crosses on the way in. */
const SHOAL_FROM = 0.4;
const SHOAL_TO = 0.9;
/** ...and the tilt (1 − n_y) a shoaling face needs before it counts. Low, and
 * deliberately: in the surf the bed has the whole wave, so the face goes over
 * along its length and the broken water fills the trough behind it. This is
 * only here to keep the flat water between two breakers from whitening. */
const SHOAL_TILT_FROM = 0.012;
const SHOAL_TILT_TO = 0.05;

/** THE TILT BANDS ARE RELATIVE TO THE SEA THEY ARE READ IN. A tilt (1 − n_y)
 * of 0.09 is the surface standing at Michell's breaking steepness, so as an
 * ABSOLUTE threshold it is the right place to foam a wind sea — whose crests
 * only just reach it. But a big quoted swell is steep over its whole face by
 * construction, and an absolute band paints every one of its vertices white:
 * a twenty-metre sea comes out a snowfield with a jet ski on it. So each band
 * is held against the SEA'S OWN characteristic tilt as well — the tilt of a
 * sinusoid of its significant height at its peak wavelength — and the wider
 * of the two wins. A gentle sea is unchanged (its own tilt puts the relative
 * band back at the absolute one); a monster sea foams only where it is steep
 * FOR ITSELF. */
const FOAM_REL_FROM = 3.5;
const FOAM_REL_TO = 8;
const FOAM_TILT_MIN = 0.04;
const FOAM_TILT_MAX = 0.09;

/** A STEEP FACE ALONE DOES NOT FOAM. A swell is steep over its whole face and
 * rolls in green; what goes white is the TOP going over. So the deep-water
 * breaking is gated to the crest — how high a vertex stands, as a share of
 * the sea's significant height, before its steepness counts.
 *
 * It starts at a THIRD of the significant height and not a tenth. A sea's
 * surface is near enough Gaussian with σ = Hs/4, so a tenth of Hs is 0.4σ —
 * which is thirty-odd per cent of the whole sea, and gating a breaking rule
 * to "the upper third of every wave" is not a gate at all. 0.35 Hs is 1.4σ
 * (8 % of the surface) and 0.8 Hs is 3.2σ (a rare crest), so what this passes
 * is the top of a big wave rather than most of the water. */
const BREAK_CREST_FROM = 0.35;
const BREAK_CREST_TO = 0.8;

/** WHITECAPS: the wind, m/s, they start blowing at and the wind at which
 * every crest carries one; how high a crest stands, as a share of the
 * significant height, before it caps; the tilt band (1 − n_y) that says the
 * cap is on the steep face; and what a full cap is worth against the other
 * two terms.
 *
 * THE WIND BAND IS WHAT SEPARATES A COAST FROM A GALE, and it is the only
 * thing that does — the other two gates are shares of the sea's own height
 * and so read the same on any sea. R12 deals a level 6–13 m/s and the storm
 * past the rim blows 25 (`sea.open.wind`), so a band of 7–14 put every ridden
 * level at most of the way to full caps: MEASURED on seed 38 (`make surf`),
 * 7.6 % of the open water inside the level was white and none of the surf
 * line was, which is the ocean painted like a snowfield in front of a clean
 * beach. At 10–22 the same level reads 0.24 of full and the storm past the
 * rim still reads all of it, so the caps are a sprinkle that grows with the
 * wind rather than a covering: that water went to 1.7 %, and the storm kept
 * caps of its own.
 *
 * THE WIND IS THE ONE THIS WATER FEELS, not the level's headline: the mean
 * under the point's own `shelter` (`fetch.ts`), freshening toward the open
 * ocean's storm as the coast falls astern — `oceanWind`, the same reading the
 * sea itself is grown from. A bay in the lee of a headland is glassy for
 * exactly the reason its water is flat.
 *
 * The CREST gate stays loose (0.3 Hs is 1.2σ of a Gaussian sea, so about a
 * tenth of the surface) because the wind band is already doing the work: a
 * cap is meant to be on any crest worth the name once it is blowing hard
 * enough, and tightening this instead takes the caps off the storm too. */
const WHITECAP_WIND = 10;
const WHITECAP_WIND_FULL = 22;
const WHITECAP_CREST = 0.3;
const WHITECAP_CREST_FULL = 0.7;
const WHITECAP_TILT = 0.012;
const WHITECAP_TILT_FULL = 0.035;
const WHITECAP_WEIGHT = 0.6;

/** The two tilt bands this sea breaks at — worked out once a frame from the
 * sea standing over the craft and read by every vertex. */
export type BreakBands = {
  /** The deep-water breaking band, (1 − n_y). */
  readonly tiltFrom: number;
  readonly tiltTo: number;
  /** ...and the whitecaps', which sits under it. */
  readonly capFrom: number;
  readonly capTo: number;
};

/** The three terms of the rule, kept apart so a lab can draw which one is
 * putting the white on the water and a session can tell surf from spume. */
export type BreakParts = {
  /** The top of a steep wave spilling down its own face, deep water. */
  crest: number;
  /** The bed tripping the whole wave — surf. */
  shoal: number;
  /** The wind blowing the tops off. */
  cap: number;
};

/** The sea's characteristic tilt: a sinusoid of significant height `hs` at
 * the deep-water wavelength its peak period `tp` carries, at its steepest
 * point. What the relative bands above are measured against. */
function seaTilt(hs: number, tp: number): number {
  const lambda = (TUNING.g * tp * tp) / (2 * Math.PI);
  const slope = lambda > 0 ? (Math.PI * hs) / lambda : 0;
  return 1 - 1 / Math.hypot(1, slope);
}

/** The bands for the sea standing over a point: the coast's own, and the
 * storm past the rim, whichever is steeper — out there it is the storm's face
 * every band is judging. */
export function breakBands(hs: number, tp: number, stormHs: number, stormTp: number): BreakBands {
  const tilt = Math.max(seaTilt(hs, tp), seaTilt(stormHs, stormTp));
  return {
    tiltFrom: Math.max(FOAM_TILT_MIN, FOAM_REL_FROM * tilt),
    tiltTo: Math.max(FOAM_TILT_MAX, FOAM_REL_TO * tilt),
    capFrom: Math.max(WHITECAP_TILT, FOAM_REL_FROM * tilt * 0.3),
    capTo: Math.max(WHITECAP_TILT_FULL, FOAM_REL_TO * tilt * 0.4),
  };
}

/** HOW MUCH OF THIS PIECE OF SEA HAS GONE OVER, 0..1, and which of the three
 * things above put it there — written into `out` rather than returned, so the
 * water mesh can ask it of five thousand vertices a frame without allocating.
 *
 * `tilt` is 1 − n_y at the sample, `height` the surface height there (m, from
 * the still water), `hsHere` the significant height of the sea THIS water is
 * running (m — sheltered water inside a bay runs a fraction of the open sea,
 * and judged against the open sea's height its crests never cap at all),
 * `depth` the still water depth (m) and `wind` the mean this water feels
 * (m/s). */
export function breakingParts(
  bands: BreakBands,
  tilt: number,
  height: number,
  hsHere: number,
  depth: number,
  wind: number,
  out: BreakParts,
): number {
  const hs = Math.max(0.05, hsHere);
  out.crest =
    smoothstep(bands.tiltFrom, bands.tiltTo, tilt) *
    smoothstep(BREAK_CREST_FROM * hs, BREAK_CREST_TO * hs, height);
  out.shoal =
    smoothstep(SHOAL_FROM, SHOAL_TO, depthLoad(hs, depth)) *
    smoothstep(SHOAL_TILT_FROM, SHOAL_TILT_TO, tilt);
  out.cap =
    smoothstep(WHITECAP_WIND, WHITECAP_WIND_FULL, wind) *
    smoothstep(WHITECAP_CREST * hs, WHITECAP_CREST_FULL * hs, height) *
    smoothstep(bands.capFrom, bands.capTo, tilt) *
    WHITECAP_WEIGHT;
  const all = out.crest + out.shoal + out.cap;
  return all < 0 ? 0 : all > 1 ? 1 : all;
}

/** How hard this water is pressing on the sea standing in it: the significant
 * height over the most the depth can hold (`TUNING.sea.breakingHs`·d, the
 * ceiling `surfaceAt` clips the field to). 1 is the sea at its depth limit.
 * Exported because it is what a lab plots to find the surf line. */
export function depthLoad(hs: number, depth: number): number {
  const cap = TUNING.sea.breakingHs * Math.max(depth, TUNING.sea.minDepth);
  return cap > 0 ? hs / cap : 0;
}

function smoothstep(a: number, b: number, x: number): number {
  if (b === a) return x >= b ? 1 : 0;
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
