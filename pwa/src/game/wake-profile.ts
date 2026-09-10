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
  out.down = HOLLOW * wash * Math.exp(-age / HOLLOW_LIFE) * (1 - a * a);
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
  const wave = wash * wash * Math.exp(-age / CREST_LIFE);
  out.foam = FAN_FOAM * strength * life * profile;
  out.churn = FAN_CHURN * wash * life * profile;
  out.up = CREST * wave * ridge;
  out.down = TROUGH * wave * trough;
  out.cover = age < FAN_LIFE ? 1 - smoothstep(0.9, 1, a) : 0;
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
