// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The engine's state and event types. The renderer, the HUD and the bot all
// read this shape; only craft.ts, collision.ts, course.ts and step.ts write
// it during a run, and place.ts stands one at a moment before it starts. Sign conventions: heading 0 points along +z and grows clockwise seen
// from above (positive steer turns the nose clockwise in map view); pitch
// is nose-up positive; roll is right-side-down positive; body-frame angular
// velocities are right-handed about the craft's right, up and forward axes
// (`lib/quat.ts` owns the sign flip between the two readings).

import type { Rng } from "../lib/prng.ts";
import type { Quat } from "../lib/quat.ts";
import type { Level } from "../mapgen/types.ts";
import type { CraftSpec } from "./defs/craft.ts";
import type { SeaState } from "./water.ts";
import type { WindState } from "./wind.ts";

export type CraftInput = {
  /** -1..1; positive steers clockwise (right in map view). */
  steer: number;
  /** 0..1, analogue — the throttle lever. */
  throttle: number;
  /** 0..1, analogue — the BRAKE AND REVERSE lever, which drops the bucket
   * over the jet and opens the throttle enough to feed it. The only brake
   * a watercraft has, and a craft with no bucket fitted (`spec.bucket
   * .reverse` 0) does nothing with it at all. Held against `throttle`
   * rather than signed onto it because the two are separate levers on the
   * bars and the engine never runs backwards. */
  reverse: number;
  /** -1..1; +1 is the rider leaning BACK (nose up), -1 forward. In the air
   * it is the pitch control; afloat it also carries the nozzle's TRIM on a
   * craft that has one. */
  lean: number;
  /** Edge-triggered: put the craft back at the last gate passed, facing
   * the next one, at rest. */
  reset: boolean;
};

export const NEUTRAL_INPUT: CraftInput = {
  steer: 0,
  throttle: 0,
  reverse: 0,
  lean: 0,
  reset: false,
};

export type CraftState = {
  spec: CraftSpec;
  /** Centre of gravity, m, world frame. */
  x: number;
  y: number;
  z: number;
  /** Velocity, m/s, world frame. */
  vx: number;
  vy: number;
  vz: number;
  /** Orientation, body → world. Full 3D so a backflip is representable. */
  q: Quat;
  /** Angular velocity, BODY frame, rad/s, right-handed about right (x), up
   * (y) and forward (z). */
  wx: number;
  wy: number;
  wz: number;
  /** Derived from `q` each step, rad, for the HUD, the camera and the bot:
   * nobody integrates these. */
  heading: number;
  pitch: number;
  roll: number;
  /** Engine speed, rpm. */
  rpm: number;
  /** The throttle as the engine sees it, 0..1, after its lag. */
  throttleEff: number;
  /** Steering nozzle deflection, rad, positive for a clockwise turn. */
  nozzle: number;
  /** Nozzle TRIM, rad, positive aimed up (which lifts the bow); 0 on a
   * craft with no trim system. Lags the lean. */
  trim: number;
  /** How far the reverse bucket has swung down, 0..1; 0 on a craft with no
   * bucket. Lags the brake lever by the gate's own travel time. */
  bucket: number;
  /** Where the rider's mass currently sits, m: aft (positive) of nominal,
   * and toward the craft's right. Lags the inputs. */
  riderAft: number;
  riderRight: number;
  /** Share of the bottom probes under the surface, 0..1, area-weighted. */
  wetted: number;
  /** True while nothing on the hull is touching water, ground or ramp;
   * `airTime` is the seconds since it left, 0 when afloat. */
  airborne: boolean;
  airTime: number;
  /** How far onto the plane the hull is, 0..1 — the dynamic lift's share of
   * the weight, eased so the HUD and the spray can read it. */
  planing: number;
  /** How deep the deepest probe sits under the surface, m; 0 when dry. */
  submergedDepth: number;
  /** |v|, m/s — what the speedo reads. */
  speed: number;
  /** Seconds since the last landing; starts large so nothing reads a
   * landing that never happened. */
  landing: number;
  /** Whether a probe was on a ramp or the ground this step — what stops a
   * ramp ride reading as flight until the lip. */
  onRamp: boolean;
  onGround: boolean;
  /** Cooldowns, s, so a contact held over several steps reports once. */
  hitCooldown: number;
  groundCooldown: number;
  /** The launch's vertical speed, m/s, remembered for the `land` event. */
  launchVy: number;
  /** Whether the landing in progress has already been reported as a dive,
   * and whether a launch is waiting to be confirmed by a flight long
   * enough to count. */
  dived: boolean;
  launchPending: boolean;
  /** Seconds the hull has lain on its back, and seconds of righting left
   * once the rider is climbing back on (0 when not). */
  capsizedFor: number;
  righting: number;
  /** Seconds the lean has been held back since the lip, while the pull
   * is still on offer; −1 once it has been taken or let go this flight. */
  pull: number;
};

export type Progress = {
  /** Index of the next gate to cross; `gates.length` once finished. */
  nextGate: number;
  /** Gate indices passed, in the order they were passed. */
  passed: number[];
  /** Gate indices skipped past and charged for. */
  missed: number[];
  /** Run clock at each gate, s, by gate index (NaN for a gate not yet
   * reached). */
  splits: number[];
  /** The run clock, s, penalties included; stops at the finish. */
  time: number;
  /** Seconds of penalty folded into `time`. */
  penalty: number;
  finished: boolean;
  /** Run clock the last gate was taken at, s; 0 on the line — and the
   * clock the craft was last reset at, s, so "no progress for a while"
   * is measured from whichever came later. */
  lastGatePassedAt: number;
  lastResetAt: number;
};

export type GameEvent =
  | { kind: "gate"; t: number; gate: number; split: number }
  | { kind: "airGate"; t: number; gate: number; split: number; height: number }
  | { kind: "missedGate"; t: number; gate: number; penalty: number }
  /** The hull leaving the water with `vy` m/s upward, off a ramp or a wave. */
  | { kind: "launch"; t: number; vy: number; speed: number }
  /** The hull arriving. `vy` is the descent, m/s (negative), `airTime` how
   * long it was up, `pitch` the attitude it met the water at. */
  | { kind: "land"; t: number; vy: number; airTime: number; pitch: number; speed: number }
  /** A landing that buried the bow: the nose went in `depth` metres. */
  | { kind: "dive"; t: number; depth: number; speed: number }
  /** A solid met at `speed` m/s closing. */
  | { kind: "hit"; t: number; solid: string; speed: number }
  /** The keel on the ground — a beach, a reef. */
  | { kind: "ground"; t: number; speed: number }
  /** The hull has lain on its back long enough: the rider is righting it. */
  | { kind: "capsize"; t: number; speed: number }
  | { kind: "reset"; t: number; gate: number }
  | { kind: "finish"; t: number; time: number };

export type GamePhase = "running" | "finished";

export type GameState = {
  seed: number;
  rng: Rng;
  /** Sim time since creation, s, and the number of steps taken. */
  t: number;
  tick: number;
  level: Level;
  sea: SeaState;
  wind: WindState;
  craft: CraftState;
  /** The input the last step was given — what the HUD and the bot read
   * back. */
  input: CraftInput;
  progress: Progress;
  phase: GamePhase;
  /** This step's events, cleared at the top of each step. */
  events: GameEvent[];
};
