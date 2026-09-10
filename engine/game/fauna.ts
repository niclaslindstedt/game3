// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEA LIFE, MOVING — where one animal of a pod is at a moment.
//
// This is the fauna's `surfaceAt`, and deliberately the same KIND of thing:
// a pure function of the placement and the clock, with no state anywhere and
// nothing to step. The generator laid a loop (R20, `mapgen/fauna.ts`); this
// says where on it the pod stands at `t`, where in the pod's formation the
// i-th animal swims, which way it is pointing, and — for a cetacean — how
// far through a breath it is. Give it the same arguments twice and it gives
// the same answer twice, on any machine, which is what lets the renderer
// draw a whale without the engine ever having simulated one.
//
// THE MODEL, in three layers:
//
//   THE LOOP. The pod walks a closed ellipse at a constant rate — one turn
//   every `pod.period` seconds, which the placer set from the animal's own
//   cruising speed and the loop's circumference, so a herring school drifts
//   and a dolphin pod covers ground. The pod's heading is the tangent, so
//   it always faces where it is going.
//
//   THE FORMATION. Each animal holds a fixed station in the pod's own frame
//   — so many bodies to the side, so many back, so many down — hashed off
//   the pod's `scatter` so the shape is the level's and not a draw at
//   render time. On top of it a slow WEAVE, a different period for every
//   animal, which is what stops a school reading as a rigid lattice being
//   dragged round a track. The whole formation scales with `spread` and the
//   animal's length: herring pack tight, minke keep two lengths apart.
//
//   THE RISE. Most of the catalog has a reason to come up: a cetacean has
//   to breathe (`breath`), and a porbeagle does not but hunts and lies at
//   the surface anyway (`bask`). Either way the animal leaves its holding
//   depth on that beat, comes up until its centreline is `awash` body
//   radii under the water — about one, which puts the BACK awash and the
//   DORSAL, and only the dorsal, clear of it — rolls, and goes back down.
//   A raised-cosine bump over `SURFACE_SPAN` of the cycle, with its own
//   phase per animal so a pod of five does not surface in unison. The
//   pitch comes out of the same bump's slope rather than being invented
//   separately, so the animal is always pointing the way it is actually
//   moving. A fish (neither beat set) never comes up.
//
//   THE BREACH. And a bull — only a bull (`isMale`), of the one species
//   the catalog gives a `breach` to at all — throws itself clear. That one
//   is not a bump but a BALLISTIC ARC, thrown in place of one of his
//   breaths: it drives up from the holding depth under a constant
//   acceleration chosen to bring it
//   through the surface at exactly the launch speed a leap of
//   `BREACH_APEX` body lengths needs, flies the parabola gravity gives it,
//   and decelerates back down to depth on the mirror of the climb. There
//   is no kink in the arc where the water is because the underwater half
//   is solved from the airborne half, and the whole manoeuvre is a couple
//   of seconds out of a `breach`-second cycle — which is why it reads as
//   an event rather than as a rhythm.
//
// EVERY DEPTH HERE IS MEASURED DOWN FROM THE WATER OVER THE POD, not from
// the plane y = 0. A level's sea is metres high; an animal that surfaced to
// a fixed height above mean sea level would spend half of every swell
// buried under a crest, and the fin that is the whole sighting would be the
// half nobody saw. The caller hands the datum in (`waterY` — `surfaceAt`'s
// height at the pod, which is the same thing the hull and the water mesh
// read), and it defaults to the flat sea a test stages.
//
// The engine's sign conventions hold: heading 0 is +z and grows clockwise
// from above, pitch is NOSE-UP positive.

import { TAU } from "../lib/math.ts";
import { hash2 } from "../lib/noise.ts";
import { fromEuler, type Quat } from "../lib/quat.ts";
import type { Pod } from "../mapgen/types.ts";
import { faunaById, type FaunaSpec } from "./defs/fauna.ts";

/** Where one animal is, and how it is standing. Written into a caller's own
 * object: the renderer asks for a few hundred of these a frame and must not
 * allocate one each time. */
export type FaunaPose = {
  /** The centre of the body, world m; `y` is against sea level. */
  x: number;
  y: number;
  z: number;
  /** Engine heading, rad, and nose-up pitch, rad. */
  heading: number;
  pitch: number;
  /** Bank, rad, right side down positive — a turning animal leans into it. */
  roll: number;
  /** The same three angles as an orientation, so a host can put the body
   * down without knowing the sign conventions `lib/quat.ts` owns. */
  q: Quat;
  /** 0 at the holding depth, 1 at the top of an ordinary rise, and past 1
   * in a breach, where the animal is clear of the water altogether. A
   * species with no reason to come up is never above 0. */
  surfacing: number;
  /** Where this animal is in its own tail beat, rad — the phase a renderer
   * flexes the body on, so two fish side by side are not one fish drawn
   * twice. */
  beat: number;
};

export function freshPose(): FaunaPose {
  return {
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    q: { x: 0, y: 0, z: 0, w: 1 },
    surfacing: 0,
    beat: 0,
  };
}

/** The share of a surfacing cycle an animal spends coming up, rolling and
 * going back down. The rest of it is spent at the holding depth. */
const SURFACE_SPAN = 0.22;
/** How far the weave carries an animal off its station, in body lengths,
 * and the band of periods the weave runs at, s. */
const WEAVE = 0.45;
const WEAVE_PERIOD = { min: 4, max: 9 };
/** Tail beats a second per unit of body length — a small fish beats fast, a
 * whale slow (`beat = BEAT_RATE / length`), which is the one thing that
 * makes a school of herring read as small from a distance. */
const BEAT_RATE = 1.1;
/** How hard an animal banks into its loop, rad per (m/s)² of lateral
 * acceleration — an arcade dial, not a measurement: enough that a turning
 * pod shows its flank and catches the light. */
const BANK = 0.09;
/** The most an animal pitches on an ordinary rise, rad — and the much
 * larger angle a breach is allowed, which is not a clamp so much as a
 * backstop: an animal leaving the water at three times its cruising speed
 * is honestly pointing 60° up, and that steep nose is the whole shape of a
 * leap. */
const MAX_PITCH = 0.45;
const BREACH_PITCH = 1.25;
/** How high a breach throws the animal's centreline over the water, in body
 * lengths, and the gravity that brings it back — the leap's LENGTH IN TIME
 * is derived from these two and nothing else, so an apex that is raised
 * lengthens the hang the way it would in the world. */
const BREACH_APEX = 0.75;
const GRAVITY = 9.81;
/** How far above or below its pod's depth one animal may hold, as a share
 * of that depth — the thickness of a school. A share rather than a distance
 * so that no formation, however wide, can put a fish through the surface or
 * into the bed; `podClearance` (mapgen/fauna.ts) reads this same number when
 * it decides how much water a pod needs. */
export const POD_LAYER = 0.3;

/** A deterministic 0..1 from a pod's scatter, an animal's index and a
 * channel — the one source of every per-animal number here. */
function jitter(pod: Pod, i: number, channel: number): number {
  return hash2(i, channel, pod.scatter);
}

/** How deep the animal's centreline is at the top of a rise, m below the
 * water over its pod. Body radii, so what clears the surface is the same
 * share of a herring as of a whale — its fin, and nothing under it. */
function riseTop(spec: FaunaSpec): number {
  return spec.awash * 0.5 * spec.beam * spec.length;
}

/** Seconds between one visit to the surface and the next, 0 for an animal
 * that has no reason to make one. A cetacean's is a breath and a
 * porbeagle's is a basking run; the catalog states them apart because they
 * are different facts, and the model reads them as one beat. */
function surfaceEvery(spec: FaunaSpec): number {
  return spec.breath > 0 ? spec.breath : spec.bask;
}

/** Is animal `i` of `pod` a bull? Deterministic in the pod's scatter, like
 * every other per-animal fact here, so a seed's pod has the same males
 * every time it is ridden. Only the males breach — which is most of why a
 * breach is rare enough to be worth seeing. */
export function isMale(pod: Pod, i: number): boolean {
  return jitter(pod, i, 8) < 0.5;
}

/**
 * Where animal `i` of `pod` is at time `t`, written into `out`.
 *
 * `t` is the engine's own clock (`state.t`), so a replayed run puts every
 * animal back exactly where it was. `waterY` is the height of the sea over
 * the pod — `surfaceAt(sea, level, pod.x, pod.z, t).height` — and every
 * depth below is measured down from it; a caller that wants the flat sea
 * (a test, a plan view) leaves it out. It is asked for per POD rather than
 * per animal on purpose: a pod's loop is a dozen metres across and the
 * swell it rides is fifty, so one sample carries the whole school and the
 * hot loop pays for one wave sum instead of thirty.
 */
export function faunaPose(pod: Pod, i: number, t: number, out: FaunaPose, waterY = 0): FaunaPose {
  const spec = faunaById(pod.species);
  const len = spec.length;

  // ── The loop ────────────────────────────────────────────────────────
  const a = pod.phase + pod.sense * TAU * (t / pod.period);
  const ch = Math.cos(pod.heading);
  const sh = Math.sin(pod.heading);
  const along = pod.radius * Math.cos(a);
  const across = pod.radius * pod.ovality * Math.sin(a);
  const cx = pod.x + along * sh + across * ch;
  const cz = pod.z + along * ch - across * sh;
  // The tangent, from the derivative of the same two terms.
  const dAlong = -pod.radius * Math.sin(a) * pod.sense;
  const dAcross = pod.radius * pod.ovality * Math.cos(a) * pod.sense;
  const vx = dAlong * sh + dAcross * ch;
  const vz = dAlong * ch - dAcross * sh;
  const heading = Math.atan2(vx, vz);

  // ── The formation ───────────────────────────────────────────────────
  // A station in the pod's frame: side, back and down. Animal 0 leads, on
  // the axis; the rest fill a wedge behind it whose reach grows as the root
  // of the count, so a school of thirty is not ten times a school of three.
  const reach = spec.spread * len * Math.sqrt(Math.max(1, pod.count));
  const side = i === 0 ? 0 : (jitter(pod, i, 1) - 0.5) * 2 * reach;
  const back = i === 0 ? 0 : -jitter(pod, i, 2) * reach * 1.6;
  const sink = i === 0 ? 0 : (jitter(pod, i, 3) - 0.5) * 2 * pod.depth * POD_LAYER;
  // The weave: its own period per animal, so the school breathes.
  const wp = WEAVE_PERIOD.min + jitter(pod, i, 4) * (WEAVE_PERIOD.max - WEAVE_PERIOD.min);
  const wPhase = jitter(pod, i, 5) * TAU;
  const weave = Math.sin((TAU * t) / wp + wPhase) * WEAVE * len;
  // Forward is (sin h, cos h); right is (cos h, -sin h).
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const lateral = side + weave;
  out.x = cx + fx * back + fz * lateral;
  out.z = cz + fz * back - fx * lateral;

  // ── The rise, and the breach ────────────────────────────────────────
  // `height` is the centreline against the water over the pod (0 is in it,
  // negative under it) and `climb` how fast that is changing; the pitch is
  // that climb against the animal's own way through the water, so it never
  // has to be invented.
  const hold = pod.depth + sink;
  const top = riseTop(spec);
  const travel = hold - top;
  let surfacing = 0;
  let height = -hold;
  let climb = 0;
  let ceiling = MAX_PITCH;
  const every = surfaceEvery(spec);
  if (every > 0) {
    const cycle = t / every + jitter(pod, i, 6);
    const p = cycle - Math.floor(cycle);
    if (p < SURFACE_SPAN) {
      const u = p / SURFACE_SPAN;
      // A raised cosine: nose-down at the depth, nose-up on the way, level
      // at the top, and the slope is the pitch.
      surfacing = 0.5 - 0.5 * Math.cos(TAU * u);
      height = -hold + travel * surfacing;
      climb = (Math.PI / (SURFACE_SPAN * every)) * Math.sin(TAU * u) * travel;
    }
  }
  if (spec.breach > 0 && isMale(pod, i)) {
    // The arc, solved from its apex: `v0` is what leaving the water at
    // takes, `air` how long gravity keeps it up, and `drive` the climb (and
    // the mirror plunge) that reaches and leaves the surface at that same
    // speed — so velocity is continuous where the water is.
    const apex = BREACH_APEX * len;
    const v0 = Math.sqrt(2 * GRAVITY * apex);
    const air = (2 * v0) / GRAVITY;
    const drive = (2 * hold) / v0;
    // A BREACH IS ONE OF THE BREATHS, thrown higher: it starts where a
    // rise would have started, at the depth, and it REPLACES that rise —
    // so the arc leaves the hold and comes back to it with nothing else
    // moving the animal, and the rise's own cosine is not still halfway
    // up when the arc ends. Run on a clock of its own, the two overlapped
    // and the end of a breach was a step of a metre.
    let tau: number;
    if (every > 0) {
      const perBreach = Math.max(1, Math.round(spec.breach / every));
      const cycle = t / every + jitter(pod, i, 6);
      const k = Math.floor(cycle);
      const turn = Math.floor(jitter(pod, i, 9) * perBreach);
      const breaching = ((k % perBreach) + perBreach) % perBreach === turn;
      tau = breaching ? (cycle - k) * every : Infinity;
      if (breaching) {
        // The rise this cycle would have been is the arc instead.
        surfacing = 0;
        height = -hold;
        climb = 0;
      }
    } else {
      const cycle = t / spec.breach + jitter(pod, i, 9);
      tau = (cycle - Math.floor(cycle)) * spec.breach;
    }
    if (tau < 2 * drive + air) {
      if (tau < drive) {
        height = -hold + (0.5 * v0 * tau * tau) / drive;
        climb = (v0 * tau) / drive;
      } else if (tau < drive + air) {
        const u = tau - drive;
        height = (v0 - 0.5 * GRAVITY * u) * u;
        climb = v0 - GRAVITY * u;
      } else {
        const u = tau - drive - air;
        height = -0.5 * v0 * u * (2 - u / drive);
        climb = -v0 + (v0 * u) / drive;
      }
      // Past 1 the moment the animal is higher than a rise would take it,
      // which is what tells a host this is a leap and not a roll.
      surfacing = (height + hold) / travel;
      ceiling = BREACH_PITCH;
    }
  }
  let pitch = Math.atan2(climb, spec.speed);
  if (pitch > ceiling) pitch = ceiling;
  else if (pitch < -ceiling) pitch = -ceiling;
  out.y = waterY + height;
  out.surfacing = surfacing;
  out.pitch = pitch;
  out.heading = heading;

  // ── The bank, and the beat ──────────────────────────────────────────
  // Lateral acceleration on the loop: v²/r with the loop's own mean radius.
  const meanR = pod.radius * (0.5 + 0.5 * pod.ovality);
  out.roll = -pod.sense * BANK * ((spec.speed * spec.speed) / Math.max(1, meanR));
  out.beat = (TAU * t * BEAT_RATE) / Math.max(0.2, len) + jitter(pod, i, 7) * TAU;
  const q = fromEuler(heading, pitch, out.roll);
  out.q.x = q.x;
  out.q.y = q.y;
  out.q.z = q.z;
  out.q.w = q.w;
  return out;
}

/** How many animals a level's pods hold in total — what a roster line and a
 * renderer's instance budget both want. */
export function faunaCount(pods: readonly Pod[]): number {
  let n = 0;
  for (const pod of pods) n += pod.count;
  return n;
}
