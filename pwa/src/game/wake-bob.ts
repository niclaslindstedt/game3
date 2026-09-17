// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOB — the SHEEN on the rings a hull radiates while it lies in a
// seaway doing nothing. Three-free and DOM-free so `tests/wake_bob_test.ts`
// can hold the claims below; `wake.ts` stamps the rings and rasterises
// them into the same map the road and the fan are drawn from.
//
// THE RINGS THEMSELVES ARE THE ENGINE'S: a floating hull's plunge lays a
// source in the wash (`engine/game/wash.ts`) and the water grid carries
// the ring the way it carries the swell, so a rival drifting alongside is
// rocked by it. What this map lays on that ring is the CHURN — the
// reflection breaking along the crest, which is the whole of what the eye
// reads of a ripple on calm water and which a height of centimetres on a
// grid of metres could never carry. It rides out at the wash's own group
// speed so the sheen sits on the water that is actually moving.
//
// Everything else the wake carries is something the hull's PASSAGE left,
// so a craft with no way on leaves water the map says nothing about — and
// a floating hull is never actually still. The sea under it rises and
// falls, the hull follows it late, and every metre of that lag pushes
// water out of the way: a heaving float RADIATES, which is the one thing
// on a calm sea that says the craft is in the water rather than on it.
//
// Three things make it read:
//
//   THE PLUNGE  the reading. Not how high the hull is — a hull carried up
//               a swell in phase with it displaces nothing new — but how
//               deep it is sitting RELATIVE TO THE WATER UNDER IT. That
//               number is flat on a flat calm, small in a swell and large
//               in a chop, which is the ordering the eye expects.
//   THE RING    a crest with a trough drawn in behind it, born at the
//               hull's own waterline at the bottom of a plunge and rolling
//               out at a short wave's celerity, thinning as its
//               circumference grows.
//   THE SHEEN   churn, and no white at all. A bob does not aerate water:
//               what the eye actually reads on calm water is the
//               reflection breaking along the ring. The relief under it
//               is the engine's, and moves a vertex only when the bob is
//               big enough to.

import { WASH_GROUP } from "@engine";

import { clamp } from "../lib/util.ts";

function smoothstep(a: number, b: number, x: number): number {
  const s = clamp((x - a) / (b - a), 0, 1);
  return s * s * (3 - 2 * s);
}

/** How deep the hull must plunge relative to the water under it before the
 * bottom of that plunge is worth a ring, m, and the plunge that buys one at
 * full strength.
 *
 * Both are measured, not guessed: a skiff lying at rest on the synthetic
 * coast plunges at most 3 mm on a DEAD CALM — the solver settling, which
 * must buy nothing — and between one and seventeen centimetres on every
 * sea the generator deals, with the common plunge a couple of centimetres.
 * So the floor sits clear of the calm and full strength sits at a plunge a
 * moderate sea reaches a few times a minute. `tests/wake_bob_test.ts`
 * rides both ends. */
export const BOB_MIN = 0.008;
export const BOB_FULL = 0.06;

/** The least time between rings, s. A hull in a short chop reverses far
 * faster than a ripple can leave it; without this the rings are born on
 * top of one another and the map carries one smear instead of a train. */
export const BOB_GAP = 0.35;

/** How fast the sheen travels, m/s — the wash's group speed, where the
 * engine's ring packet stands — how wide it runs crest to foot, m, and how
 * long it lives, s. The WIDTH is the packet's, a broad gentle swell of a
 * thing, which is also what a ripple looks like beside a hull that is
 * barely moving. */
export const BOB_SPEED = WASH_GROUP;
export const BOB_WIDTH = 4;
export const BOB_LIFE = 4.5;

/** Where the sheen's inner foot sits, in half-widths inside its crest. */
const BOB_TROUGH_AT = 1.6;

/** How long the sheen takes to come up, s — a birth over a couple of
 * frames would be a step in the reflection at the hull's rim. */
const BOB_BIRTH = 0.3;

/** How much the ring breaks the reflection at its peak. It is the whole of
 * what the eye reads at a small plunge — a ripple on calm water is a line
 * where the reflection stops agreeing with itself, not a line of white —
 * so it is the one channel here that is not scaled off the relief. */
const BOB_CHURN = 0.6;
/** ...and the share of that a plunge at the FLOOR still carries. A ring
 * worth drawing at all is worth seeing; only its HEIGHT falls away with
 * the sea, which is the ordering the eye expects. */
const BOB_CHURN_FLOOR = 0.4;

/** Where the ring is born, as a share of the hull's plan half-diagonal:
 * just outside the waterline, so the crest leaves the hull rather than
 * standing under it. */
const BOB_BIRTH_HULL = 1.05;
/** ...and where the feather that keeps the ring out from under the hull
 * begins, as a share of that radius. */
const BOB_HOLLOW_IN = 0.4;

/** The pace, m/s, past which the hull's passage carries the water and the
 * bob is folded away. Under way the road, the stern wave and the fan are
 * all laid over this water, and a train of rings across them is two
 * accounts of the same surface. */
export const BOB_PACE_GONE = 4;

/** How long after a landing the bob stays quiet, s. A hull arriving from
 * the air sinks further against the water than any sea makes it, so the
 * step it re-primes on buys a full-strength ring — laid on top of the
 * crater and ring wave the SPLASH is already stamping there, where the two
 * reliefs sit inside one blur of each other and cancel. The splash owns
 * that water; the bob takes over once it has filled. */
export const BOB_SETTLE = 0.7;

/** The stations a ring is laid across, centre to reach: the birth radius,
 * the trough, the crest, the foot and the reach — placed ON the features,
 * so a crest is a vertex and not the gap between two. */
export const BOB_STATIONS = 6;

/** THE READING, carried between steps: how deep the hull sat under the
 * water last step, whether it was on its way down, and when the last ring
 * was born. Reused, never allocated. */
export type Bob = {
  /** The hull's sinkage relative to the water over it last step, m —
   * positive DOWN, so a hull dropping into a trough rises. */
  under: number;
  /** How far it has sunk since the last turn of the heave, m; negative
   * while it is on its way back up. */
  fell: number;
  /** The clock the last ring was born on, s. */
  born: number;
  /** Whether `under` has been read at all yet. */
  primed: boolean;
};

export function bobReading(): Bob {
  const bob = { under: 0, fell: 0, born: -1e9, primed: false };
  resetBob(bob);
  return bob;
}

/** Forget everything read so far: a fresh run, a craft stood somewhere
 * else. The next step re-primes rather than paying for the jump. */
export function resetBob(bob: Bob): void {
  bob.under = 0;
  bob.fell = 0;
  bob.born = -1e9;
  bob.primed = false;
}

/** Where a hull of these dimensions puts the ring it radiates, m from its
 * centre of buoyancy: its plan half-diagonal, a little outside, so the
 * crest leaves the waterline rather than standing on it. */
export function bobBirth(length: number, beam: number): number {
  return Math.hypot(length, beam) * 0.5 * BOB_BIRTH_HULL;
}

/** Read the heave. `under` is how far the hull is sitting below the water
 * over it, m (positive down); `t` the clock; `pace` the hull's way through
 * the water, m/s; `lying` whether the hull is in the water and not still
 * arriving in it (`BOB_SETTLE`).
 *
 * Returns the strength of the ring this step is worth, 0..1 — non-zero on
 * exactly the step a plunge deep enough to count turns back upward, which
 * is the moment the hull has pushed the most water out of its way. */
export function bobStep(bob: Bob, under: number, t: number, pace: number, lying: boolean): number {
  if (!lying) {
    bob.primed = false;
    bob.fell = 0;
    return 0;
  }
  if (!bob.primed) {
    bob.primed = true;
    bob.under = under;
    bob.fell = 0;
    return 0;
  }
  const step = under - bob.under;
  bob.under = under;
  // Sinking: add to the plunge. Rising: the plunge is over — pay for it if
  // it was deep enough, then start counting the next one from here.
  if (step > 0) {
    bob.fell = Math.max(0, bob.fell) + step;
    return 0;
  }
  const fell = bob.fell;
  bob.fell = 0;
  if (fell < BOB_MIN || t - bob.born < BOB_GAP) return 0;
  const pull = 1 - clamp(pace / BOB_PACE_GONE, 0, 1);
  const strength = clamp((fell - BOB_MIN) / (BOB_FULL - BOB_MIN), 0, 1) * pull;
  if (strength <= 0) return 0;
  bob.born = t;
  return strength;
}

/** How far out from its birth radius a ring has reached at an age, m. */
export function bobReach(radius: number, age: number): number {
  if (age < 0 || age >= BOB_LIFE) return radius;
  return radius + BOB_SPEED * age + BOB_WIDTH;
}

/** The radii of a ring's stations at an age, m, ascending from 0 into
 * `out` (`BOB_STATIONS` long). */
export function bobStations(radius: number, age: number, out: Float32Array): void {
  const reach = bobReach(radius, age);
  const rc = radius + BOB_SPEED * age;
  const half = BOB_WIDTH / 2;
  out[0] = 0;
  out[1] = radius;
  out[2] = rc - BOB_TROUGH_AT * half;
  out[3] = rc;
  out[4] = rc + half;
  out[5] = reach;
  for (let i = 1; i < BOB_STATIONS; i++) {
    out[i] = Math.min(reach, Math.max(out[i - 1], out[i]));
  }
}

/** THE RING'S SECTION at `r` m from its centre, for a ring born `age`
 * seconds ago at `radius` m with `strength` 0..1: churn, and nothing else
 * — the height is the engine's. */
export function bobAt(
  r: number,
  radius: number,
  age: number,
  strength: number,
  out: { foam: number; churn: number; up: number; down: number; cover: number },
): void {
  out.foam = 0;
  out.up = 0;
  out.down = 0;
  if (strength <= 0 || age < 0 || age >= BOB_LIFE) {
    out.churn = out.cover = 0;
    return;
  }
  const rc = radius + BOB_SPEED * age;
  // The envelope, with no strength in it: up over the birth, then a decay
  // that reaches exactly nothing at `BOB_LIFE` — an exponential cut off at
  // a third of its height is a ring that pops — and spread thinner as the
  // circumference it is wrapped round grows.
  const left = 1 - age / BOB_LIFE;
  const env = (1 - Math.exp(-age / BOB_BIRTH)) * left * left * Math.sqrt(radius / rc);
  const d = (r - rc) / (BOB_WIDTH / 2);
  const crest = Math.exp(-d * d * 2);
  // Nothing inside the waterline the ring was born on: the hull is
  // standing there, and a crest whose skirt reaches under it is a mound
  // the craft sits on top of for the first half second of its life. The
  // feather is cut off the BIRTH RADIUS rather than off the ring's width,
  // which is wider than the hull and would leave a skirt over its middle.
  const inside = smoothstep(radius * BOB_HOLLOW_IN, radius, r);
  const lift = BOB_CHURN_FLOOR + (1 - BOB_CHURN_FLOOR) * strength;
  out.churn = BOB_CHURN * lift * env * crest;
  out.cover = inside;
}
