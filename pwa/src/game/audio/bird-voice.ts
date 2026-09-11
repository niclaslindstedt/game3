// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE BIRDS SAY — the roster's voices as data, and the arithmetic
// that turns a flock into cries: which sound each species makes, how often
// a bird of it calls in the air and on its rock, how far off it can be
// heard, and the one deterministic draw that decides whether a flock cried
// in a given quarter second.
//
// DOM-free and plan-free. Nothing here knows where a flock is or reads a
// state; `bird-bed.ts` asks this module the questions and does the reading,
// and the audition page and the tests can hold the whole table without a
// level. The bank ids named here are `bank.ts`'s, and `tests/audio_test.ts`
// holds every one of them to it.
//
// THE CRIES ARE A HASH, NOT A DIE. Whether a flock cries in a slot is
// `hash2` of the slot's index and the flock's own scatter — the same draw
// the plan places its birds with — so a seed cries the same cries on every
// ride, a replay cries them again, and nothing here touches `state.rng`,
// which the engine's determinism contract keeps for the engine.

import { hash2 } from "@engine";

import type { BirdId } from "../bird-defs.ts";
import { SCREEN_TO_ENGINE } from "../input-model.ts";

/** One species' voice. */
export type BirdCall = {
  /** The bank id of its cry. */
  readonly sound: string;
  /** Calls per bird per minute in the air, and at rest. */
  readonly airborne: number;
  readonly perched: number;
  /** The distance at which the cry is heard at its authored level, m, and
   * the distance past which it is not heard at all. A bigger `ref` is a
   * louder bird: a crane is heard across a bay, a drake across a raft. */
  readonly ref: number;
  readonly reach: number;
  /** What the flock sounds like getting up off the water, if it makes a
   * sound of its own doing it — the eider's whirr. */
  readonly flush?: string;
};

/** The roster's voices, or null for a bird that keeps quiet: the cormorant
 * grunts only at its nest, and the eagle's thin yelp is a thing a coast
 * hears a few times a year — its silence over the water is the character.
 * The rates are a colony's, not a textbook's: the gull is the everyday
 * racket, the tern the shrillest, the raft a murmur, and the skeins call
 * to hold their line. */
export const BIRD_CALLS: Readonly<Record<BirdId, BirdCall | null>> = {
  gull: { sound: "gull_cry", airborne: 4, perched: 1, ref: 30, reach: 260 },
  tern: { sound: "tern_cry", airborne: 6, perched: 2, ref: 24, reach: 180 },
  cormorant: null,
  eider: {
    sound: "eider_coo",
    airborne: 0.5,
    perched: 2,
    ref: 18,
    reach: 90,
    flush: "eider_whirr",
  },
  eagle: null,
  goose: { sound: "goose_honk", airborne: 8, perched: 1, ref: 60, reach: 520 },
  swan: { sound: "swan_whoop", airborne: 4, perched: 1, ref: 70, reach: 600 },
  crane: { sound: "crane_bugle", airborne: 3, perched: 0.5, ref: 80, reach: 700 },
};

/** The slot the draw is made per, s. A flock cries at most once a slot,
 * which is the cap on a colony's racket: four cries a second from one
 * rock is a flock; twenty is a fault. */
export const CRY_SLOT = 0.25;

/** The most a slot may be asked to cry, as the chance it does: past this
 * a bigger flock is not a busier one. */
const MOST_PER_SLOT = 0.6;

/** How many cries a flush lets off, over how long, s, and how much louder
 * than an ordinary cry each is: birds going up shout. */
export const FLUSH_CRIES = { count: 3, spread: 1.4, gain: 1.4 };

/** How much a resting flock quietens in the dark, as the floor under the
 * day's activity: a roost is not silent, but it is nearly. */
const NIGHT_FLOOR = 0.15;

/** One cry the draw dealt: the slot's own second, and a 0..1 for the voice
 * to vary its pitch and its level by, so no two cries off one rock are one
 * waveform twice. */
export type Cry = { at: number; vary: number };

/**
 * The cries a flock of `count` birds, each calling `rate` times a minute,
 * lets off between `t0` and `t1` (engine seconds, `t0` exclusive), to
 * `visit`. A pure function of the slots the window covers and the flock's
 * `scatter`: ask twice, get the same cries twice. Returns how many.
 */
export function criesIn(
  scatter: number,
  count: number,
  rate: number,
  t0: number,
  t1: number,
  visit: (cry: Cry) => void,
): number {
  if (!(t1 > t0) || rate <= 0 || count <= 0) return 0;
  // A Poisson rate per slot, as the chance of at least one: a big loud
  // flock saturates rather than doubling.
  const lambda = (count * rate * CRY_SLOT) / 60;
  const p = Math.min(MOST_PER_SLOT, 1 - Math.exp(-lambda));
  const from = Math.floor(t0 / CRY_SLOT) + 1;
  const to = Math.floor(t1 / CRY_SLOT);
  let n = 0;
  for (let k = from; k <= to; k++) {
    if (hash2(k, 1, scatter) >= p) continue;
    n++;
    visit({ at: k * CRY_SLOT, vary: hash2(k, 2, scatter) });
  }
  return n;
}

/** The rate a flock calls at when `air` of it is flying and the day is
 * `activity` bright: the two rates blended, and the roost's share dimmed
 * toward the night floor. */
export function callRate(call: BirdCall, air: number, activity: number): number {
  const roost = call.perched * (NIGHT_FLOOR + (1 - NIGHT_FLOOR) * activity);
  return roost + (call.airborne - roost) * air;
}

/**
 * How loud a cry `distance` metres off is, 0..1: at its authored level
 * inside `ref`, falling on the inverse square past it, and faded to
 * nothing over the last third of `reach` so a flock going out of earshot
 * goes rather than stops.
 */
export function heardAt(distance: number, call: Pick<BirdCall, "ref" | "reach">): number {
  if (distance >= call.reach) return 0;
  const square = distance <= call.ref ? 1 : (call.ref / distance) ** 2;
  const edge = (call.reach - distance) / (call.reach / 3);
  const fade = edge >= 1 ? 1 : edge * edge * (3 - 2 * edge);
  return square * fade;
}

/** Where a cry sits between the ears, -1..1, for a source at `bearing`
 * heard by a rider on `heading` — through the one screen flip the input
 * model owns, as the surf's pan is. */
export function cryPan(bearing: number, heading: number): number {
  return Math.sin(bearing - heading) * SCREEN_TO_ENGINE;
}

/** The pitch a cry with `vary` is played at: a small spread either side of
 * the authored note, because a colony is many throats. */
export function cryPitch(vary: number): number {
  return 0.93 + vary * 0.14;
}
