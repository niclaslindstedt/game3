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
  /** 0..1 — THE TUCK: how far the rider is asking to get down behind the
   * bars. Analogue so a body can be walked into it, and held rather than
   * toggled: it buys a smaller hole in the air and costs the rider every
   * lever that is their own weight. A keyboard's key is the only thing
   * that offers it — a thumb on the glass is already holding the bar and
   * the lever, and has no third hand (`pwa/src/game/input-model.ts`). */
  crouch: number;
  /** Edge-triggered: put the craft back at the last gate passed, facing
   * the next one, at rest. */
  reset: boolean;
};

export const NEUTRAL_INPUT: CraftInput = {
  steer: 0,
  throttle: 0,
  reverse: 0,
  lean: 0,
  crouch: 0,
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
  /** HOW FAR DOWN THE RIDER ACTUALLY IS, 0..1 — the body's own answer to
   * `CraftInput.crouch`, lagged by `TUNING.tuck.lag` because getting down
   * behind the bars and back up off them takes a moment. Everything the
   * tuck does reads this and never the input: the hole in the air
   * (`flight.ts`), the weight the rider can still shift and the lock they
   * can still swing (`craft.ts`), and the figure the app draws
   * (`pwa/src/game/rider-pose.ts`). */
  crouch: number;
  /** HOW FAR THE RIDER IS STOOD UP, 0..1 — off the seat and back over the
   * transom, the tuck's exact mirror and on its own lag
   * (`TUNING.stand.lag`). It is what stands the craft on its tail: a body
   * that far aft and that high is a nose-up moment the seated lean cannot
   * reach, and a centre of gravity too high to be steady there, which is
   * why holding it is a balance rather than a position. Asked for by
   * holding the lean back with the throttle open (`craft.ts`); read by the
   * figure the app draws (`pwa/src/game/rider-pose.ts`). */
  stand: number;
  /** How long the stand has been ASKED for, s — the lean and the throttle
   * both held with the hull carrying him. It has to reach
   * `TUNING.stand.dwell` before `stand` itself starts to rise, which is
   * what tells a deliberate stand-up from the burst of lean-back the ride
   * uses on every ramp. Reset the moment the ask drops. */
  standHold: number;
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
  /** The slam the hull took this step, N — the wedge impact of the probes
   * ENTERING the water (`hull.ts`), capped as the physics caps it. Zero on a
   * hull that is riding rather than landing. Read by the app's audio for the
   * slap of the bottom meeting a wave; nothing in the engine reads it back. */
  slam: number;
  /** |v|, m/s — what the speedo reads. */
  speed: number;
  /** Seconds since the last landing; starts large so nothing reads a
   * landing that never happened. */
  landing: number;
  /** Whether a probe was on a ramp or the ground this step — what stops a
   * ramp ride reading as flight until the lip. */
  onRamp: boolean;
  onGround: boolean;
  /** Cooldowns, s, so a contact held over several steps reports once — and
   * so the tornado past the ocean's far edge (`tornado.ts`) reports once a
   * throw rather than once a step. */
  hitCooldown: number;
  groundCooldown: number;
  tornadoCooldown: number;
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
  /** THE PUMP's stroke detector (`TUNING.flight`, `craft.ts`). `pumpMark`
   * is where the lean-back input has got to on this stroke, 0..1: its PEAK
   * while `pumpRising` (so a key held down cannot haul twice), and its
   * trough once the bars have started back (so the next rise of
   * `flight.pumpRise` is a fresh haul). Both are reset by every step the
   * hull is not flying. */
  pumpMark: number;
  pumpRising: boolean;
  /** How hard the last yank threw the rider back, 0..1, decaying over
   * `flight.yankFade`: the extra reach aft it is worth (`riderAft`), and
   * what the pose draws. */
  yank: number;
  /** Nose-up rate the pump has put into this spell of flight, rad/s —
   * what `flight.pumpCeiling` bounds, and zeroed the moment the water or
   * a deck has the hull again. */
  pumped: number;
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
  /** THE RUN'S AIR RECORD: the longest flight flown so far, s, counted from
   * `flight.airCounts` — 0 until one has been up that long. A landing that
   * beats it carries `record`, so a presentation flashes it once and the
   * number is here to read back after. It stands across a reset: the rider
   * flew it, and being put back at a gate does not un-fly it. */
  bestAir: number;
  /** The run clock that record was set at, s — 0 while `bestAir` is. A
   * presentation that holds the record on screen for a moment after the
   * landing measures the hold from here rather than running a clock of its
   * own, which is what keeps the HUD a reader of the state
   * (`pwa/src/game/snapshot.ts`). */
  bestAirAt: number;
};

/** What the hull did in the air to earn a multiplier. Both directions are
 * counted because both are rotations about the same axis; only the backflip
 * is one the rider can ASK for (THE PUMP is nose-up only), so a frontflip is
 * what an unlucky launch off a steep face buys. */
export type TrickKind = "backflip" | "frontflip";

/** THE SCORE'S STATE — the run's banked points and the combo still riding
 * on the rider being on the water at the end of it (`tricks.ts` owns every
 * rule; nothing else writes this). */
export type TrickState = {
  /** Points BANKED this run: combos that closed with the rider still on
   * the craft. A bail cannot touch it and a reset cannot touch it — it was
   * already paid. */
  score: number;
  /** THE COMBO IN PROGRESS: the base points ticked into it so far and the
   * multiplier those will be paid at. `mult` is 1 with no trick in it, and
   * a step per revolution turned (rising with the revolution's index — a
   * double backflip is ×4, not ×3). Both are 0 and 1 between combos. */
  base: number;
  mult: number;
  /** Seconds of the link window left, 0 when no combo is open — how long
   * the rider has on the water to start the next trick before the combo
   * closes and banks (`TUNING.tricks.linkWindow`). */
  link: number;
  /** THIS FLIGHT's rotation nose-over-tail, rad, nose-up positive, and how
   * many whole revolutions of it have already been paid for. Both are 0
   * whenever the hull is on the water. */
  rotation: number;
  spins: number;
  /** THE COMBO JUST RESOLVED and the run clock it resolved at, s — the
   * figure banked, or the figure lost when `lastBailed`. A readout holds
   * it on screen for a moment off `lastAt` rather than running a clock of
   * its own, the way the air record is held (`progress.bestAirAt`). */
  last: number;
  lastAt: number;
  lastBailed: boolean;
};

export type GameEvent =
  | { kind: "gate"; t: number; gate: number; split: number }
  | { kind: "airGate"; t: number; gate: number; split: number; height: number }
  | { kind: "missedGate"; t: number; gate: number; penalty: number }
  /** The hull leaving the water with `vy` m/s upward, off a ramp or a wave. */
  | { kind: "launch"; t: number; vy: number; speed: number }
  /** The hull arriving. `vy` is the descent, m/s (negative), `airTime` how
   * long it was up, `pitch` the attitude it met the water at. `record` is
   * true when that flight is the longest of the run so far and long enough
   * to count at all (`flight.airCounts`) — the run's new best, decided
   * where the run is orchestrated (`step.ts`) rather than by whoever reads
   * the event, because two readers comparing clocks of their own would
   * disagree about which landing set it. */
  | {
      kind: "land";
      t: number;
      vy: number;
      airTime: number;
      pitch: number;
      speed: number;
      record: boolean;
    }
  /** A landing that buried the bow: the nose went in `depth` metres. */
  | { kind: "dive"; t: number; depth: number; speed: number }
  /** A solid met at `speed` m/s closing. */
  | { kind: "hit"; t: number; solid: string; speed: number }
  /** The keel on the ground — a beach, a reef. */
  | { kind: "ground"; t: number; speed: number }
  /** The hull has lain on its back long enough: the rider is righting it. */
  | { kind: "capsize"; t: number; speed: number }
  /** THE TORNADO HAS THE RIDER — he rode out past the far edge of the open
   * ocean and a wave has just thrown him clear of the water inside it
   * (`tornado.ts`). `grip` is how much of the tornado stands there, 0..1 —
   * the reading a presentation wants, because it means the same thing at
   * every speed class where a wind in m/s does not (`tornadoBlow` is quoted
   * against what the craft can do). `wind` is that wind all the same, m/s,
   * and `speed` the craft's own. He is about to go some twenty-five metres up and a long
   * way back toward the start; nothing in the run is reset, and he is free
   * to ride straight back out and be thrown again. */
  | { kind: "tornado"; t: number; grip: number; wind: number; speed: number }
  /** A TRICK WON, the moment it completes — the beat a presentation pulses
   * on. `spins` is which revolution of THIS flight it was (1 for the first,
   * 2 for the second of a double), `points` what it added to the combo's
   * base and `mult` the multiplier the combo now stands at. */
  | {
      kind: "trick";
      t: number;
      trick: TrickKind;
      spins: number;
      points: number;
      mult: number;
    }
  /** A COMBO BANKED: the link window ran out with the rider still on the
   * craft, and `points` (= `base × mult`) went into `tricks.score`. */
  | { kind: "combo"; t: number; points: number; base: number; mult: number }
  /** ...and a COMBO LOST: he went over the bars, or put himself back at a
   * gate. `lost` is what it would have been worth. */
  | { kind: "bail"; t: number; lost: number }
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
  /** THE OTHER GAME ON THE SAME WATER: what the rider has been paid for
   * the air and the flips, and the combo still riding on him staying on
   * the craft (`tricks.ts`). The clock is the race and this is not — a run
   * has both and neither decides the other. */
  tricks: TrickState;
  /** THE ARCADE DIALS, 0..1 each — how much of `assist.ts`'s two hands
   * this run is ridden with (`TUNING.assist`).
   *
   * `assist` is THE AIR's: a flight predicted to end on its side or its
   * nose is turned toward the attitude it ought to land at over the last
   * moment before the water. `rampAssist` is THE RAMP's: the sideways
   * slide is taken out of a hull running up a deck and its bow is brought
   * round to the deck's axis, so a jump lined up roughly right is
   * followed through rather than skidded off the side.
   *
   * 1 is the full arcade, 0 the bare physics with the hull going wherever
   * it was thrown, and `TUNING.assist.air.strength` / `.ramp.strength`
   * are what a run is dealt when nothing says. A difficulty setting is
   * what is expected to move them, and to move them apart. Both are read
   * and never written during a run and draw no randomness, so a run
   * replays identically at any setting. */
  assist: number;
  rampAssist: number;
  /** ...and HOW LATE the AIR's hand arrives, s before the water. A third
   * dial, because it is a different thing from the strength: that scales
   * the correction, this decides how much of the flight is the rider's at
   * all. A hard difficulty shortens this rather than only softening the
   * spring (`TUNING.assist.band`, which moves all three together). */
  assistWindow: number;
  phase: GamePhase;
  /** This step's events, cleared at the top of each step. */
  events: GameEvent[];
};
