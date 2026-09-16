// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE WILDLIFE SHOTS ARE STANDING ON — which pod or flock a level's
// `wildlife`, `breach` and `birds` scenarios are about, and the moment in
// its own cycle each picture wants. All of it is a SEARCH over the models
// rather than a restatement of them: `faunaPose` and `birdPose` remain the
// only statements of where an animal is, and nothing here keeps a second
// opinion about a surfacing or a flush.
//
// It sits beside `scenarios.ts` rather than inside it for the reason
// `scenario-names.ts` and `scenario-water.ts` do — the switch over every
// staged moment is long enough without also owning the arithmetic three of
// them need. DOM-free and three-free, like the module it serves.

import {
  faunaById,
  faunaPose,
  freshPose,
  isMale,
  type FaunaId,
  type Level,
  type Pod,
} from "@engine";

import { FLUSH_SECONDS, birdPose, freshBirdPose, type Flock } from "./bird-plan.ts";
import { planBirds } from "./bird-roost.ts";

/** The RAREST pod on a level — the one the `wildlife` scenario is about.
 * Rarity is the catalog's `perKm` and nothing else, so the shot is of
 * whatever that seed was lucky enough to carry: a minke if it has one, a
 * school of herring if that is all there is. */
export function rarestPod(level: Level): Pod | null {
  let best: Pod | null = null;
  let rarest = Infinity;
  for (const pod of level.fauna) {
    const perKm = faunaById(pod.species).perKm;
    if (perKm < rarest) {
      rarest = perKm;
      best = pod;
    }
  }
  return best;
}

/** How far ahead of the pod's leader the wildlife shot stands, m. Close,
 * and for a reason a wider shot hides: the chase camera looks along the
 * water rather than down at it, so an animal at eight metres of depth
 * leaves the bottom of the frame by about twenty metres out. What can be
 * seen under the surface is what is nearly under the hull. */
export const WILDLIFE_STANDOFF = 12;

/** And how far off its track, m. The chase camera puts the rider's back in
 * the middle of the picture, so an animal dead ahead surfaces behind his
 * shoulders; a few metres to one side is the difference between a shot of
 * a whale and a shot of a man. */
export const WILDLIFE_SIDE = 5;

/** Where the BREACH shot stands relative to the leaping animal, m —
 * ABEAM of its track and a little behind it, not on the track looking
 * back down it. A breach is an ARC, and an arc seen end-on is a dot: a
 * dolphin flying straight at the camera shows its cross-section and
 * nothing else, which is a shot of a grey blob two metres over the water.
 * Further out than the wildlife shot, too, because a breaching bull is
 * ABOVE the water rather than under it — seeing into the sea does not
 * limit the range, the frame does, and an animal clearing two metres of
 * air needs room over its head. */
export const BREACH_ABEAM = 14;
export const BREACH_BEHIND = 4;
/** And how far the aim is swung off the animal, rad. The chase camera
 * puts the rider's back in the middle of the picture, so anything the
 * craft is pointed straight at leaps behind his shoulders. */
export const BREACH_AIM = 0.2;

/** How long the breach is worth watching once it has been stood at its
 * apex, s — the fall, the splash, and the water closing over it. */
export const BREACH_WATCH = 2.5;

/** How often an animal's own cycle repeats, s — the window a shot of it at
 * its highest has to search, and 0 for one that never comes up. */
export function surfaceCycle(id: FaunaId): number {
  const spec = faunaById(id);
  return spec.breach > 0 ? spec.breach : spec.breath > 0 ? spec.breath : spec.bask;
}

/** When animal `i` of `pod` is at its highest in the `span` seconds after
 * `from`. Found by SEARCHING `faunaPose` rather than by re-deriving the
 * arc: the swim model owns when an animal is where, and a second copy of
 * its timing here is a copy that would go quietly wrong the day the rise
 * or the leap is retuned. The step is fine enough to land inside the
 * second or so an animal spends at the top of either. */
export function highest(pod: Pod, i: number, from: number, span: number): number {
  let best = -Infinity;
  let at = from;
  const pose = freshPose();
  for (let t = from; t < from + span; t += 0.05) {
    const y = faunaPose(pod, i, t, pose).y;
    if (y > best) {
      best = y;
      at = t;
    }
  }
  return at;
}

/** How far up its own leap a breach is photographed, as a share of the
 * apex. NOT the apex itself: at the top of a ballistic arc the vertical
 * speed is zero, so the animal is level, and a level dolphin two metres
 * over a flat sea reads as one HOVERING. Half way up it is still climbing
 * at half its launch speed, which the pose turns into fifty-odd degrees of
 * nose — the attitude that says leap. */
const BREACH_UP = 0.5;

/** Walking back from an apex the search found: the moment on the way UP at
 * which the animal was `share` of the way to it. */
export function climbing(
  pod: Pod,
  i: number,
  apexAt: number,
  apexY: number,
  share: number,
): number {
  const pose = freshPose();
  const want = apexY * share;
  let t = apexAt;
  while (t > apexAt - 4 && faunaPose(pod, i, t, pose).y > want) t -= 0.02;
  return t;
}

/** The soonest breach after `from` on this level, and the moment part way
 * up it that a still of it wants. */
export function nextBreach(
  level: Level,
  from: number,
): { pod: Pod; index: number; at: number } | null {
  let best: { pod: Pod; index: number; at: number } | null = null;
  const pose = freshPose();
  for (const pod of level.fauna) {
    const spec = faunaById(pod.species);
    if (spec.breach <= 0) continue;
    for (let i = 0; i < pod.count; i++) {
      if (!isMale(pod, i)) continue;
      const apexAt = highest(pod, i, from, spec.breach);
      if (best && apexAt >= best.at) continue;
      const apexY = faunaPose(pod, i, apexAt, pose).y;
      best = { pod, index: i, at: climbing(pod, i, apexAt, apexY, BREACH_UP) };
    }
  }
  return best;
}

/** How far off a RAFT the birds shot is stood, m, and how fast it rides at
 * it: close enough that the seconds that follow carry the hull into the
 * raft's flush radius and put the birds up, which is the one moment they
 * answer to the craft. A rock's flock does not flush, so a shot of one
 * stands nearer and still, at a moment the flock is wheeling over it. */
export const BIRDS_RUN_IN = 48;
export const BIRDS_STANDOFF = 28;

/** The flock the birds shot is about: a raft on the water if the coast has
 * one, since a raft is the thing that gets up for a hull; otherwise the
 * first flock there is. */
export function shotFlock(level: Level): Flock | null {
  const plan = planBirds(level);
  return plan.flocks.find((f) => f.home.kind === "water") ?? plan.flocks[0] ?? null;
}

/** The soonest moment after `from` the flock's leader is where the shot
 * wants it — sitting, for a raft about to be put up; flying, for a flock
 * on a rock — found by searching the model rather than restating its
 * cycle. */
export function flockMoment(flock: Flock, from: number, sitting: boolean): number {
  const pose = freshBirdPose();
  for (let t = from; t < from + flock.cycle * 1.5; t += 0.25) {
    const air = birdPose(flock, 0, t, pose).airborne;
    if (
      sitting ? air === 0 && birdPose(flock, 0, t + FLUSH_SECONDS, pose).airborne === 0 : air === 1
    ) {
      return t;
    }
  }
  return from;
}
