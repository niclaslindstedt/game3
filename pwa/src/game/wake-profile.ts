// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WAKE'S SHAPE — what a hull's passage does to a cross-section of the
// water behind it, by how fast it went and how long ago. Three-free and
// DOM-free so `tests/wake_test.ts` can hold the claims below; `wake.ts`
// lays these sections along the trail and rasterises them into the map the
// water shader reads.
//
// The reference is the aerial photograph of a runabout at speed: three
// things in it, each with its own life.
//
//   THE ROAD   the jet's churned white core, about a beam wide, solid at the
//              transom and lasting several seconds — long enough that the
//              trail behind a craft at pace runs out of the picture before
//              it runs out of white — breaking into mottled patches as the
//              bubbles pop rather than paling evenly.
//   THE BOIL   the bulb right behind the transom, wider than the road,
//              where the jet's hole collapses and the chine sheets land: the
//              widest, whitest, most turbulent water in the picture, and
//              gone in under a second, which is what necks the road in
//              behind it.
//   THE FAN    the V either side, Kelvin's angle whatever the speed, of
//              water the hull has aerated rather than whitened: paler than
//              the sea, speckled, its outer edge the diverging wave's crest
//              and the one line in the fan that reads as foam. It spreads
//              with SPEED — a crawl leaves a ripple, a craft on the plane
//              leaves a fan a dozen metres across — and fades in a few
//              seconds.
//
// Each section carries four things the map has a channel for: FOAM (the
// white share, drawn by the water's own foam term), CHURN (how broken the
// surface is — it bends the reflection, lightens the body and animates the
// foam), and a hollow and a crest (the surface displaced down or up, m —
// and SIDEWAYS along the slope between them, so the transom's trough
// shoves the surface outward and the bow wave piles it on its crest).
// Foam is gated to pace and the pump the way a real road is; the churn and
// the displacement start from a crawl, because a hull pushed through water
// disturbs it long before it whitens it.

import { TUNING } from "@engine";

import { clamp } from "../lib/util.ts";

/** Kelvin's angle — the half-angle of the V a hull's diverging waves make,
 * whatever the hull and whatever its speed — as its tangent (19.47°). */
export const KELVIN_TAN = 0.3536;

/** Below this along-track speed, m/s, the pump churns no white; the road's
 * strength ramps to full over `SPEED_FULL`. */
export const SPEED_MIN = 2.5;
export const SPEED_FULL = 14;
/** The speed, m/s, at which the disturbance itself — the churn, the hollow,
 * the fan's crest — is at full strength. */
export const WASH_FULL = 8;

/** How long the road's white lives, s, and the power its fade runs on —
 * steep at first, then a long pale tail. */
export const ROAD_LIFE = 5;
const ROAD_FADE_POWER = 1.2;
/** The road's half-width at the transom as a share of the beam, what a m/s
 * of pace adds to it, m, and how fast it spreads with age, m/s. */
const ROAD_HALF_BEAM = 0.42;
const ROAD_HALF_PER_SPEED = 0.008;
const ROAD_SPREAD = 0.1;
/** Where the road's flat top ends, as a share of its half-width; outside it
 * the section feathers to nothing. */
const ROAD_CORE = 0.55;
/** How long the boil lives, s, and how much wider than the road it is at
 * the transom, as a share of the beam. */
export const BOIL_LIFE = 0.9;
const BOIL_HALF_BEAM = 0.6;
/** How long the churn behind the transom lives, s, and how deep the
 * transom's hollow is at full wash, m, with its own life. */
const CHURN_LIFE = 1.6;
const HOLLOW = 0.22;
const HOLLOW_LIFE = 1.4;
/** HOW LONG THE RELIEF TAKES TO FORM, s — the hollow collapsing into the
 * hole the jet leaves, the bow wave rolling out from the chine. The water
 * shader moves the surface by this relief, and a trough that stood at full
 * depth the instant the transom passed would drop every vertex under it
 * by its whole depth within a few frames: a twitch, where the sea's own
 * waves, which take seconds to pass, are silk. A quarter of a second is
 * enough to make the forming a motion rather than a step. */
const RELIEF_RISE = 0.25;

/** The relief's envelope at an age: rising over `RELIEF_RISE`, then dying
 * over `life`. */
function relief(age: number, life: number): number {
  return (1 - Math.exp(-age / RELIEF_RISE)) * Math.exp(-age / life);
}

/** How long the fan's aeration lives, s; its half-width at the transom as a
 * share of the beam, and the most it may ever spread to, m. */
export const FAN_LIFE = 3.2;
const FAN_HALF_BEAM = 0.6;
export const FAN_HALF_MAX = 14;
/** The fan's foam at full pace — light: the fan is aerated water, and only
 * its outer crest reads white — and its churn. */
const FAN_FOAM = 0.4;
const FAN_CHURN = 0.9;
/** THE BOW WAVE: the water the hull shoved aside, travelling outward along
 * the fan's edge as a crest with a trough drawn in behind it — how high the
 * crest stands and how deep the trough runs at full wash, m, and how long
 * the wave lives, s. It is a WAVE the water shader displaces the surface
 * by, up at the crest, down in the trough and sideways along the slope
 * between them, which is what moves the water to the side. It grows with
 * the SQUARE of the wash, the way a hull's wave-making does: a crawl barely
 * lifts it, a craft on the plane throws it. */
const CREST = 0.18;
const TROUGH = 0.09;
const CREST_LIFE = 2.5;
/** Where across the fan the crest stands, as a share of its half-width, and
 * where it rises from; the trough sits just inside it. */
const RIDGE = 0.85;
const RIDGE_FROM = 0.6;
const TROUGH_AT = 0.55;
const TROUGH_FROM = 0.3;

/** One cross-section's worth of a channel each: reused, never allocated. */
export type WakeSection = {
  foam: number;
  churn: number;
  /** The surface lifted, m, and the surface hollowed, m — both ≥ 0. */
  up: number;
  down: number;
  /** The section's coverage, 0..1: the feathered edge, and 0 outside it. */
  cover: number;
};

export function wakeSection(): WakeSection {
  return { foam: 0, churn: 0, up: 0, down: 0, cover: 0 };
}

/** How white the pump churns the road at a speed and a pump share. */
export function roadStrength(speed: number, pump: number): number {
  const pace = clamp((speed - SPEED_MIN) / (SPEED_FULL - SPEED_MIN), 0, 1);
  return pace * (0.55 + 0.45 * clamp(pump, 0, 1));
}

/** How strongly the hull has disturbed the water at a speed, 0..1. */
export function washOf(speed: number): number {
  return clamp(speed / WASH_FULL, 0, 1);
}

/** The road's half-width at an age, m: the boil's bulb at the transom
 * decaying into the road proper, which spreads slowly. */
export function roadHalf(beam: number, speed: number, age: number): number {
  return (
    beam * ROAD_HALF_BEAM +
    speed * ROAD_HALF_PER_SPEED +
    ROAD_SPREAD * age +
    beam * BOIL_HALF_BEAM * Math.exp(-age / BOIL_LIFE)
  );
}

/** The fan's half-width at an age, m: Kelvin's V at the speed the hull was
 * making, capped so a long trail at pace is not a map full of fan. */
export function fanHalf(beam: number, speed: number, age: number): number {
  return Math.min(FAN_HALF_MAX, beam * FAN_HALF_BEAM + age * speed * KELVIN_TAN);
}

function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** THE ROAD'S SECTION at `s` across it (−1..1 of `roadHalf`), for a sample
 * laid at `speed` with `strength` of white, `age` seconds ago. */
export function roadAt(s: number, age: number, speed: number, strength: number, out: WakeSection) {
  const a = Math.abs(s);
  const edge = 1 - smoothstep(ROAD_CORE, 1, a);
  const wash = washOf(speed);
  const fade = Math.pow(Math.max(0, 1 - age / ROAD_LIFE), ROAD_FADE_POWER);
  const boil = Math.exp(-age / BOIL_LIFE);
  out.foam = strength * Math.min(1, fade + boil * 0.5);
  out.churn = wash * (0.5 + 0.5 * boil) * Math.exp(-age / CHURN_LIFE);
  out.up = 0;
  out.down = HOLLOW * wash * relief(age, HOLLOW_LIFE) * (1 - a * a);
  out.cover = age < ROAD_LIFE ? edge * edge : 0;
}

/** THE FAN'S SECTION at `s` across it (−1..1 of `fanHalf`). */
export function fanAt(s: number, age: number, speed: number, strength: number, out: WakeSection) {
  const a = Math.abs(s);
  const wash = washOf(speed);
  const life = Math.exp(-age / FAN_LIFE);
  // The crest along the outer edge, and the aeration inside it fading
  // toward the road: two profiles, the louder wins.
  const ridge = smoothstep(RIDGE_FROM, RIDGE, a) * (1 - smoothstep(RIDGE, 1, a));
  const trough = smoothstep(TROUGH_FROM, TROUGH_AT, a) * (1 - smoothstep(TROUGH_AT, RIDGE_FROM, a));
  const inside = 0.3 * (1 - a);
  const profile = Math.max(ridge, inside);
  const wave = wash * wash * relief(age, CREST_LIFE);
  out.foam = FAN_FOAM * strength * life * profile;
  out.churn = FAN_CHURN * wash * life * profile;
  out.up = CREST * wave * ridge;
  out.down = TROUGH * wave * trough;
  out.cover = age < FAN_LIFE ? 1 - smoothstep(0.9, 1, a) : 0;
}

// ── THE SPLASH ────────────────────────────────────────────────────────
// What a hull arriving from ABOVE does to a disc of water — a landing's
// plume falling back, a bow driven under, a hull coming down on its side —
// as against what a hull moving THROUGH it does (the road and the fan).
// Three things in it, each with its own life, all stamped into the same
// map so the water shader draws and moves them the way it draws the wake:
//
//   THE PATCH   the foam the plume leaves on the water: a disc that spreads
//               slowly and breaks up as the bubbles pop, churned hardest at
//               first — what the landing's stamp has always carried.
//   THE CRATER  the water the hull displaced: a hollow under it, forming
//               over the relief's rise and filling back in under a second.
//   THE RING    where the displaced water went — a ring wave rolling out
//               from the crater's rim with a trough drawn in behind its
//               crest, thinning as its circumference grows and lacing the
//               crest white. The wave is what the eye reads as the sea
//               taking the blow: a splash with no ring is paint.

/** How long the patch's foam lives, s, and how fast it spreads, m/s. */
export const SPLASH_LIFE = 2.6;
export const SPLASH_SPREAD = 0.9;
/** How long the crater takes to fill, s — the hollow's decay after the
 * relief's rise. */
export const CRATER_LIFE = 0.6;
/** THE RING WAVE: how fast it travels, m/s — a wave a few metres long at
 * deep-water celerity (√(gλ/2π) for λ ≈ 3 m) — its width crest to foot,
 * m, how long it lives, s, and its crest's height at the crater's rim as
 * a share of the crater's depth. The width is the wave's own scale AND the
 * grid's: the water shader reads the relief blurred to about two metres
 * (`WAKE_RELIEF_LOD`) and the near grid's cell is a metre and a half, so a
 * ring narrower than this is smoothed into nothing before a vertex ever
 * stands on it. */
export const RING_SPEED = 2.2;
export const RING_WIDTH = 3.2;
export const RING_LIFE = 2.4;
export const RING_SHARE = 1.2;
/** Where the ring's trough sits, in half-widths inside its crest, and how
 * deep it runs as a share of the crest. */
const RING_TROUGH_AT = 1.2;
const RING_TROUGH = 0.6;
/** How much white the crest carries at full strength, and how much churn. */
const RING_FOAM = 0.7;
const RING_CHURN = 1;
/** How much of a stamp's strength the patch's foam takes. */
const PATCH_FOAM = 0.7;
/** The stations a splash is laid across, centre to reach: the crater's
 * middle and its rim, the patch's edge, the ring's trough, crest and foot,
 * and the reach — placed ON the features rather than spread evenly, so a
 * crest a metre wide is a vertex and not a gap between two. */
export const SPLASH_STATIONS = 8;

/** How far out from its centre a splash reaches at an age, m — the further
 * of the patch's edge and the ring's foot, while the ring lives and is
 * drawn (`ring` is the DETAIL row's share of it, 0 for none). */
export function splashReach(radius: number, age: number, ring: number): number {
  const patch = radius + SPLASH_SPREAD * age;
  if (ring <= 0 || age >= RING_LIFE) return patch;
  return Math.max(patch, radius + RING_SPEED * age + RING_WIDTH);
}

/** The radii of a splash's stations at an age, m, ascending from 0 into
 * `out` (`SPLASH_STATIONS` long). */
export function splashStations(radius: number, age: number, ring: number, out: Float32Array): void {
  const reach = splashReach(radius, age, ring);
  const rc = radius + RING_SPEED * age;
  const half = RING_WIDTH / 2;
  out[0] = 0;
  out[1] = radius * 0.5;
  out[2] = radius;
  out[3] = radius + SPLASH_SPREAD * age;
  out[4] = rc - RING_TROUGH_AT * half;
  out[5] = rc;
  out[6] = rc + half;
  out[7] = reach;
  // Ascending, and inside the reach: the features overtake one another as
  // the ring outruns the patch, and a station past the reach is a vertex
  // with no cover, which is fine, but one out of order folds the fan.
  for (let i = 1; i < SPLASH_STATIONS; i++) {
    out[i] = Math.min(reach, Math.max(out[i - 1], out[i]));
  }
}

/** THE SPLASH'S SECTION at `r` m from its centre, for a splash of `radius`
 * m laid `age` seconds ago with `strength` of white, a crater `depth` m
 * deep at full, and `ring` of the ring wave (0..1). */
export function splashAt(
  r: number,
  radius: number,
  age: number,
  strength: number,
  depth: number,
  ring: number,
  out: WakeSection,
): void {
  const life = age / SPLASH_LIFE;
  if (age < 0 || life >= 1) {
    out.foam = out.churn = out.up = out.down = out.cover = 0;
    return;
  }
  // The patch: flat, feathered over its outer third, paling and settling.
  const patchR = radius + SPLASH_SPREAD * age;
  const inPatch = 1 - smoothstep(0.7, 1, r / patchR);
  const fade = Math.pow(1 - life, 1.6);
  let foam = strength * fade * PATCH_FOAM * inPatch;
  let churn = strength * fade * (1 - life) * inPatch;
  // The crater: a bowl over the radius, rising in and filling.
  const rim = Math.min(1, r / radius);
  let down = depth * relief(age, CRATER_LIFE) * (1 - rim * rim);
  let up = 0;
  // The ring: a crest at the wave's front and a trough inside it, its
  // height spread thinner round a growing circumference.
  if (ring > 0 && age < RING_LIFE) {
    const rc = radius + RING_SPEED * age;
    const amp =
      depth *
      RING_SHARE *
      ring *
      Math.sqrt(radius / rc) *
      Math.exp(-age / RING_LIFE) *
      (1 - Math.exp(-age / RELIEF_RISE));
    const d = (r - rc) / (RING_WIDTH / 2);
    const crest = Math.exp(-d * d * 2);
    const trough = Math.exp(-(d + RING_TROUGH_AT) * (d + RING_TROUGH_AT) * 2);
    up += amp * crest;
    down += amp * RING_TROUGH * trough;
    const lace = strength * ring * crest * Math.exp(-age / RING_LIFE);
    foam += RING_FOAM * lace;
    churn += RING_CHURN * lace;
  }
  out.foam = Math.min(1, foam);
  out.churn = Math.min(1, churn);
  out.up = up;
  out.down = down;
  out.cover = 1 - smoothstep(0.85, 1, r / splashReach(radius, age, ring));
}

// ── THE BRAKE ─────────────────────────────────────────────────────────
// What the reverse bucket does to the water ROUND the hull. With the gate
// down the jet does not leave astern: it is thrown forward and under, so
// the water alongside and ahead of the hull erupts white and stays white
// while the lever is held — a pool the craft sits in, wider than the hull
// and reaching past the bow, that the water shader draws with the same
// foam term as the road. Nothing here is a trail: the pool is laid under
// the hull every frame off its state (`bucket` and `throttleEff`, the two
// numbers the thrust is turned by), and the road behind carries what the
// hull has passed over. It is the one mark that says BRAKING from any
// camera, which is why it is as wide as it is.

/** A mark laid round the hull off its state — the boil under a capsized
 * hull, the pool under a braking one. Reused, never allocated. */
export type HullMark = {
  /** How hard, 0..1 — the mark's churn; nothing at 0. */
  stir: number;
  /** The white share at the mark's centre. */
  foam: number;
  /** The centre's offset ahead of the centre of gravity, m. */
  ahead: number;
  /** Half-reaches of the ellipse, m, along the hull and across it. */
  along: number;
  across: number;
  /** The share of the reach the mark holds its full strength over before
   * feathering to nothing at the rim: a pool is flat-topped, a boil under a
   * capsized hull peaks at its middle. */
  core: number;
};

export function hullMark(): HullMark {
  return { stir: 0, foam: 0, ahead: 0, along: 0, across: 0, core: 0 };
}

/** The pool's white at full, its half-reach along the hull and across it
 * as shares of the length and the beam, how far ahead of the centre of
 * gravity it stands as a share of the length, and what PACE adds to each:
 * at speed the reversed jet meets water rushing the other way and the
 * pool is thrown forward past the bow; at a stop it boils round the hull. */
const BRAKE_FOAM = 0.65;
const BRAKE_CORE = 0.6;
const BRAKE_ALONG = 0.55;
const BRAKE_ALONG_PACE = 0.35;
const BRAKE_ACROSS = 1.1;
const BRAKE_ACROSS_PACE = 0.5;
const BRAKE_AHEAD = 0.1;
const BRAKE_AHEAD_PACE = 0.3;
/** The gate's share past which the pool starts, and the pace, m/s, at
 * which it is thrown as far as it goes. */
const BRAKE_FROM = 0.05;
export const BRAKE_PACE_FULL = 12;
/** How much wider the road behind a braking hull is laid, as a multiple of
 * the beam at a full gate: the flow the bucket sends under the hull
 * aerates the water it passes over, chine to chine and beyond. */
export const BRAKE_ROAD_WIDEN = 0.6;

/** The pool under a hull with its `bucket` down and its pump at
 * `throttle`, going `along` m/s the way it points (astern negative). */
export function brakeMark(
  bucket: number,
  throttle: number,
  along: number,
  length: number,
  beam: number,
  out: HullMark,
): void {
  const gate = clamp((bucket - BRAKE_FROM) / (1 - BRAKE_FROM), 0, 1);
  // The pump at the throttle the lever opens on its own is the whole boil
  // — the gate never sees more flow than that unless the rider is also on
  // the throttle, and then it is no whiter.
  const stir = gate * clamp(throttle / TUNING.pump.bucketThrottle, 0, 1);
  const pace = clamp(Math.abs(along) / BRAKE_PACE_FULL, 0, 1) * Math.sign(along);
  out.stir = stir;
  out.foam = BRAKE_FOAM * stir;
  out.core = BRAKE_CORE;
  out.ahead = length * (BRAKE_AHEAD + BRAKE_AHEAD_PACE * pace);
  out.along = length * (BRAKE_ALONG + BRAKE_ALONG_PACE * Math.abs(pace));
  out.across = beam * (BRAKE_ACROSS + BRAKE_ACROSS_PACE * Math.abs(pace));
}

/** THE MAP the water shader reads the wake off: texels a side, and how far
 * it reaches either side of its centre, m. The centre stands
 * `WAKE_MAP_BACK` m behind the craft, because the wake is. */
export const WAKE_MAP = 512;
export const WAKE_REACH = 64;
export const WAKE_MAP_BACK = 24;
/** What one unit of a height channel is worth, m — the map is eight bits a
 * channel, so this is the deepest hollow and the tallest crest it can carry. */
export const WAKE_HEIGHT = 0.35;
