// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HIGHLIGHTS — the moments in a run worth leaving the boom for, and the
// director that cuts to them while the recording plays back.
//
// A LIVE CAMERA CANNOT DO THIS AND A REPLAY'S CAN, which is the whole reason
// the TV camera is replay-only (`camera-tv.ts`). A broadcast cuts to the
// trackside lens BEFORE the jump, because the shot is the rider arriving into
// a frame that is already standing there waiting for him — and a camera
// watching a run for the first time has no way of knowing a jump is coming.
// A replay does: the run already happened. So the moments are written down AS
// THEY HAPPEN, by the run itself, and the recording is watched by a director
// who has the list in his hand from the first frame.
//
// IT IS THE PAST, BACK-DATED. The thing that makes a flight worth watching is
// how long it stayed up and what was turned in it, and neither is known until
// the hull is back on the water — so the collector remembers where the craft
// was at the LAUNCH, waits for the landing, and then files the shot at the
// launch's own step. The cut can therefore land a second and a half before a
// lip the rider had not reached yet.
//
// WHAT EARNS ONE. Four kinds, and the list is short on purpose: a shot is an
// interruption, and an interruption every few seconds is not an interruption,
// it is the programme.
//
//   air      a flight that stayed up. The run's longest counts for more
//            (`land.record` — the engine decides which landing set it, so
//            two readers cannot disagree).
//   trick    a revolution, a corkscrew, a combo banked — one shot for the
//            whole flight it was turned in, never one per element.
//   bump     hull against hull: another rider met at speed (`bump`).
//   wipeout  it went wrong — over the bars, on its back, or the tornado took
//            him. NOT a buried bow: a `dive` is most landings on a chop, and
//            cutting to half of them is not punctuation.
//
// AND THE SLOW MOTION, which is the other thing only a replay may have. It is
// not a setting and not a key: it is part of the shot, and it runs over the
// thing worth watching — the whole of a flight, the half-second either side of
// a contact — ramping in before and out after so the picture eases into it
// rather than stepping down a gear.
//
// Three-free and DOM-free: this decides WHICH moment and WHEN, `camera-tv.ts`
// decides where the lens stands, and `tests/replay_test.ts` holds both without
// a browser.

import { TUNING, type GameState } from "@engine";

/** What a shot is OF. The word the replay bar prints is `strings.ts`'s
 * (§39.1 — nothing here names anything the player reads). */
export type ShotKind = "air" | "trick" | "bump" | "wipeout";

/** ONE MOMENT WORTH A CAMERA, as the run wrote it down. Steps rather than
 * seconds, because a step is the one clock a replay and the run it was cut
 * from can never disagree about. */
export type ReplayShot = {
  kind: ShotKind;
  /** The step the shot is ABOUT — the launch of the flight, the frame of the
   * contact. The cut lands `SHOTS.lead` seconds before it. */
  at: number;
  /** How long the thing worth watching runs for, steps: the flight, or the
   * beat a contact is given. The slow motion covers exactly this. */
  runs: number;
  /** How special it was, 0..1 and comparable ACROSS the kinds — which is
   * what lets the plan rank a double backflip against a 60 km/h shunt. */
  weight: number;
  /** Where the craft was at `at`, and how it was going. The lens is stood
   * off this (`camera-tv.ts`), so a stand can be planted before the craft
   * has arrived anywhere near it. */
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
};

/** THE WHOLE DIRECTOR, as numbers. Seconds, metres per second and steps. */
export const SHOTS = {
  /** THE SHORTEST FLIGHT WORTH A CAMERA, s. Under this a hull is skipping
   * off chop, which happens several times a second in a head sea and is not
   * an event. */
  airLeast: 0.9,
  /** ...and the flight a full-weight air shot is measured against, s. About
   * what a good ramp at racing pace buys. */
  airBig: 2.4,
  /** The closing speed a full-weight contact is measured against, m/s. A
   * shunt at this is two hulls that will both be pointing somewhere else
   * afterwards. */
  bumpHard: 9,
  /** ...and the least worth cutting for, m/s: below it hulls are simply
   * rafted up together in a pack, which they are for half a race. */
  bumpLeast: 3.5,
  /** How much a revolution and a banked combo are worth on top of the
   * flight's own air time. A single spin is a shot whatever the hang time;
   * a double is the best thing in most runs. */
  spinWorth: 0.3,
  multWorth: 0.06,
  /** What a wipeout is worth. Flat: they are all worth watching and none of
   * them is worth watching twice. */
  wipeout: 0.55,
  /** The beat a contact or a wipeout is given, s — a flight brings its own
   * length and these do not. */
  beat: 0.55,
  /** ...and the MOST of any moment that is framed and run slow, s. A flight
   * brings its own length and that length is not always a flight: a hull
   * thrown clear by the tornado is off the water for ten seconds and travels
   * half a kilometre while it is, which is one `launch` and one `land` and
   * reads to the collector exactly like a jump. Left uncapped it is a shot
   * whose subject leaves the frame and a slow-motion ramp that outlasts
   * anybody's patience; capped, it is the first four seconds of it, which is
   * the part worth seeing. */
  longest: 4,
  /** How far before the beat the cut lands, s. The craft has to come out of
   * the distance and arrive; anything shorter is a lens the hull is past
   * before the shot has read. */
  lead: 1.7,
  /** ...and how long the lens holds on after the thing is over, s. Short:
   * what a trackside camera is for is a craft ARRIVING, and every tenth
   * spent on a departing one is a tenth of the shot spent on its transom. */
  hold: 1.2,
  /** THE FLOOR ON WEIGHT. A moment under it keeps the boom. */
  least: 0.25,
  /** How much water the boom keeps to itself between two trackside shots,
   * s of the RECORDING's own clock. A replay cut every two seconds is a
   * slideshow with a craft in it. */
  rest: 5,
  /** The most shots one replay carries. A ninety-second race with a dozen
   * cuts in it is already a highlights reel; past that the drive stops being
   * the thing being watched. */
  most: 14,
} as const;

/** THE SLOW MOTION — the second thing only a replay may have. */
export const SLOW = {
  /** How slowly the picture runs at the bottom of the ramp, as a share of
   * real time. A third is where a backflip becomes legible as a rotation
   * rather than a blur; much under it and the water stops looking like
   * water, because every wave in this game is a function of the same clock. */
  rate: 0.34,
  /** How long the ramp down takes, s, and the ramp back up. Out is longer:
   * coming out of slow motion is the picture handing the run back, and a
   * jump cut back to speed reads as a dropped frame. */
  in: 0.45,
  out: 0.7,
} as const;

const HZ = TUNING.physicsHz;

function seconds(s: number): number {
  return Math.round(s * HZ);
}

/** Where a shot's window opens and closes, steps — the cut and the hand-back.
 * Stated once because the plan's spacing, the director and the tests all ask
 * the same question. */
export function shotWindow(shot: ReplayShot): { from: number; until: number } {
  return {
    from: Math.max(0, shot.at - seconds(SHOTS.lead)),
    until: shot.at + shot.runs + seconds(SHOTS.hold),
  };
}

export type ShotCollector = {
  /** One step of the run, AFTER it was taken: the events it produced and the
   * craft they left behind. Called with the player's own run and nobody
   * else's — a rival's bump is on the rival's events, and this is a
   * recording of one rider's afternoon. */
  step: (state: GameState, at: number) => void;
  /** Everything worth watching so far, ranked and spaced (`planShots`).
   * Callable mid-run, which is what the pause card's offer is built on. */
  plan: () => ReplayShot[];
};

/** The flight under way: where it started, and what has been turned in it.
 * One shot comes out of the whole of it — a backflip is not two events. */
type Flight = {
  at: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  spins: number;
  mult: number;
};

function poseOf(state: GameState, at: number): Omit<ReplayShot, "kind" | "runs" | "weight"> {
  const c = state.craft;
  return { at, x: c.x, y: c.y, z: c.z, heading: c.heading, speed: c.speed };
}

/** Watch a run and write down what was worth a camera. */
export function createShotCollector(): ShotCollector {
  const found: ReplayShot[] = [];
  let flight: Flight | null = null;
  return {
    plan: () => planShots(found),
    step: (state, at) => {
      for (const e of state.events) {
        switch (e.kind) {
          case "launch": {
            const c = state.craft;
            flight = {
              at,
              x: c.x,
              y: c.y,
              z: c.z,
              heading: c.heading,
              speed: c.speed,
              spins: 0,
              mult: 1,
            };
            break;
          }
          // A REVOLUTION IS THE FLIGHT'S, not its own shot. `spins` is which
          // revolution of this flight it was, so the largest is how many came
          // round — and an element turned on the water (the crest ride, the
          // laydown) simply finds no flight to credit and keeps the boom.
          case "trick":
            if (flight) {
              flight.spins = Math.max(flight.spins, e.spins);
              flight.mult = Math.max(flight.mult, e.mult);
            }
            break;
          case "land": {
            const open = flight;
            flight = null;
            if (!open) break;
            if (e.airTime < SHOTS.airLeast && open.spins === 0) break;
            // The air is worth what it stayed up for, and the run's own
            // longest is worth the top of the scale whatever the clock says.
            const air = e.record ? 1 : Math.min(1, e.airTime / SHOTS.airBig);
            const turned = open.spins * SHOTS.spinWorth + (open.mult - 1) * SHOTS.multWorth;
            found.push({
              kind: open.spins > 0 ? "trick" : "air",
              at: open.at,
              runs: Math.min(seconds(SHOTS.longest), Math.max(1, at - open.at)),
              weight: Math.min(1, air + turned),
              x: open.x,
              y: open.y,
              z: open.z,
              heading: open.heading,
              speed: open.speed,
            });
            break;
          }
          case "bump":
            if (e.speed < SHOTS.bumpLeast) break;
            found.push({
              kind: "bump",
              runs: seconds(SHOTS.beat),
              weight: Math.min(1, e.speed / SHOTS.bumpHard),
              ...poseOf(state, at),
            });
            break;
          // IT WENT WRONG, which is the other half of what anybody watches a
          // replay for. A `bail` is the combo going over the bars, a
          // `capsize` is the hull on its back, and the tornado is the sea
          // taking him — a `dive` is left out on purpose: a bow that goes in
          // is most landings on a chop and would cut to half of them.
          case "bail":
          case "capsize":
          case "tornado":
            found.push({
              kind: "wipeout",
              runs: seconds(SHOTS.beat),
              weight: SHOTS.wipeout,
              ...poseOf(state, at),
            });
            break;
          default:
            break;
        }
      }
    },
  };
}

/** THE RUNNING ORDER: what actually gets cut to, out of everything that
 * earned a mark.
 *
 * Ranked by weight and then spaced, rather than spaced and then ranked. A
 * pass down the run in order keeping whatever is far enough from the last one
 * kept gives the FIRST of a crowded pair, which on a rhythm section of ramps
 * is reliably the small one; taking them strongest-first and refusing any
 * that crowds a shot already taken gives the big one and moves on. */
export function planShots(found: readonly ReplayShot[]): ReplayShot[] {
  const rest = seconds(SHOTS.rest);
  const kept: ReplayShot[] = [];
  const ranked = found
    .filter((shot) => shot.weight >= SHOTS.least)
    .sort((a, b) => b.weight - a.weight || a.at - b.at);
  for (const shot of ranked) {
    if (kept.length >= SHOTS.most) break;
    const { from, until } = shotWindow(shot);
    const crowds = kept.some((held) => {
      const window = shotWindow(held);
      return from < window.until + rest && window.from < until + rest;
    });
    if (!crowds) kept.push(shot);
  }
  return kept.sort((a, b) => a.at - b.at);
}

/** What the director has decided for this step: the shot holding the frame,
 * or null for the boom, and how fast the picture is running. */
export type ShotCall = { shot: ReplayShot | null; rate: number };

/** THE DIRECTOR, asked once a frame. It reads the step and nothing else — no
 * lens, no clock, no state — so the whole edit is a pure function of how far
 * into the recording the picture has got. */
export function directAt(plan: readonly ReplayShot[], step: number): ShotCall {
  for (const shot of plan) {
    const { from, until } = shotWindow(shot);
    if (step < from) break;
    if (step > until) continue;
    return { shot, rate: rateFor(shot, step) };
  }
  return { shot: null, rate: 1 };
}

/** How fast the picture runs at `step`: full rate outside the thing worth
 * watching, `SLOW.rate` over it, and an ease at either end. */
function rateFor(shot: ReplayShot, step: number): number {
  const into = seconds(SLOW.in);
  const outOf = seconds(SLOW.out);
  const opens = shot.at - into;
  const closes = shot.at + shot.runs;
  if (step <= opens || step >= closes + outOf) return 1;
  if (step >= shot.at && step <= closes) return SLOW.rate;
  const share =
    step < shot.at ? (step - opens) / Math.max(1, into) : 1 - (step - closes) / Math.max(1, outOf);
  return 1 + (SLOW.rate - 1) * ease(share);
}

/** Smoothstep — the ramp has no corner at either end, so the picture never
 * visibly changes gear. */
function ease(t: number): number {
  const s = t < 0 ? 0 : t > 1 ? 1 : t;
  return s * s * (3 - 2 * s);
}
