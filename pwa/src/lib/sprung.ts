// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A READING CARRIED ON A SPRING toward a moving one — a MASS, not a lag.
//
// An ease answers a step in its input with a step in its own VELOCITY: the
// output sets off toward the new value at full tilt in the very frame the
// input moved, and only the distance left to cover softens after that. That
// is a first-order filter, and it is what a thing with NO MASS does. It is
// also why a first-order camera reading feels twitchy however low its rate
// is set — the lag is visible, but the WEIGHT never is.
//
// A mass on a spring starts from rest. Its velocity has to be built up by
// the spring's pull, so a kink in the input arrives as a curve, and a bump
// shorter than the spring's own period is mostly never answered at all — the
// mass has not got going before the bump is over. The natural frequency says
// what counts as a bump and what counts as a movement; the damping ratio
// says whether it arrives or OVERSHOOTS.
//
// Under a damping ratio of 1 the overshoot is the whole point: a target that
// drops to nothing is a mass still travelling, and it swings THROUGH the new
// value before it settles back onto it. That is the bounce at the end of a
// gesture, and it is proportional to the gesture — because it is a share of
// whatever the mass had wound on to.
//
// Integrated in bounded substeps: a stiff spring stepped over a hitching
// tab's whole frame rings or runs away, and clamping the frame instead would
// make the spring run SLOW on a weak machine — which turns the reading into
// a frame-rate one.

export type SprungSpec = {
  /** Damping ratio: 1 is critical (arrives without overshooting), under 1
   * overshoots and settles back. */
  damping: number;
  /** A step this big between two readings is a teleport, in the reading's
   * own units: the mass is put down on it, at rest, instead of flying. */
  snap: number;
};

/** Longest step the spring is integrated over, s — the engine's own rate. */
const SUBSTEP = 1 / 120;

export type Sprung = {
  /** Advance the mass `dt` seconds toward `value`. `freq` is the natural
   * frequency in Hz and is taken PER CALL, so one reading may hang on a soft
   * spring in one condition and a stiff one in another with the mass
   * carrying its velocity across the change. */
  step: (value: number, freq: number, dt: number) => number;
  /** Let go: the next reading is taken where it is found, at rest — for a
   * follower that has been picked up and put down somewhere else. */
  drop: () => void;
};

export function createSprung(spec: SprungSpec): Sprung {
  let at = Number.NaN;
  let vel = 0;
  return {
    step: (value, freq, dt) => {
      if (Number.isNaN(at) || Math.abs(value - at) > spec.snap) {
        vel = 0;
        return (at = value);
      }
      const w = 2 * Math.PI * freq;
      const damp = 2 * spec.damping * w;
      for (let left = dt; left > 0; left -= SUBSTEP) {
        const h = Math.min(left, SUBSTEP);
        vel += (w * w * (value - at) - damp * vel) * h;
        at += vel * h;
      }
      return at;
    },
    drop: () => {
      at = Number.NaN;
      vel = 0;
    },
  };
}
