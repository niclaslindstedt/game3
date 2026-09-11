// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE RIDER FEELS IN THEIR HANDS — which moments of a run are worth a
// pulse of vibration, and how big each one is.
//
// The same shape as the audio surface and for the same reason: the engine
// emits `GameEvent`s and has no idea any of them are felt, so the whole
// opinion lives out here in one table a reader can check. `audio/route.ts`
// is the sibling worth reading beside this one — an event that makes a big
// noise usually deserves a big pulse, and where the two disagree it is on
// purpose.
//
// THE SEA IS THE CONTINUOUS ONE, and it is the point of this surface. A
// runabout at speed does not ride water, it HAMMERS it: the flat of the
// bottom lands on the back of every chop and the rider takes each one
// through the bars and the footwells. That is not an event and never
// becomes one — it is `CraftState.slam`, the von Kármán wedge impact
// `hull.ts` already computes every step, read off the craft the same way
// the chop bed reads it (`audio/ride-bed.ts`'s SLAP) and paid out as a
// short pulse no oftener than {@link RUMBLE.slapGap}. Everything else in
// here is a BLOW: the hull arriving after air, the bow burying, a skerry, a
// bar of sand, going over.
//
// WHAT DOES NOT RUMBLE, and why. A phone has one motor and no mixer: two
// pulses at once are one pulse, so every buzz spent on news is a buzz taken
// off the next landing. A gate taken, a ring, a gate missed, a reset, the
// finish: read on the HUD and heard in the bank, never felt. `launch` is
// left out for a sharper reason still — the lip is the one moment in a run
// where the hull STOPS touching anything, and a buzz on the way up would be
// the machine contradicting the water.
//
// DOM-free, so the whole table is testable without a device: the pulse goes
// to a sink the caller hands in (`haptics.ts` is the one that touches a
// motor), and the clock is the frame's own `dt`.

import { TUNING, totalMass, type CraftState, type GameEvent } from "@engine";

/** One pulse, as the two things a device might be able to express.
 *
 * `ms` is how long the buzz lasts and is the only axis the web's Vibration
 * API has — an Android motor is on or off, and duration is the whole of how
 * big a browser pulse can be. `strength` is 0..1 of the hardest thing the
 * game ever asks for, which a native haptic engine spends on its own
 * vocabulary (`native/src/rumble.ts` turns it into a style and a count).
 * Both are authored per event rather than derived from each other: a slap
 * through a chop is short and moderate, a bow buried at speed is long and
 * hard. */
export type Rumble = { ms: number; strength: number };

/** The knobs behind the table below, in one place so "less of all of it" is
 * one edit rather than a sweep. */
export const RUMBLE = {
  /** The longest pulse in the game, ms — the hull going over. Past about a
   * quarter of a second a phone buzz stops reading as an impact and starts
   * reading as a notification. */
  longest: 260,

  /** THE SEA UNDER THE HULL, which is the one continuous thing on this
   * surface — see this module's header. The slam is read in g of the
   * craft's own weight, which is the axis the physics caps
   * (`TUNING.hull.slamCapG`), so the band below runs from the softest slap
   * worth feeling to the hardest the hull can take.
   *
   * `slapFrom` is the same rung the chop bed raises its slap on
   * (`audio/ride-bed.ts`), because they are the same event: what is heard as
   * the bottom landing is what is felt through the bars. */
  slapFrom: 0.35,
  /** One slap per this many seconds. A hull hammering through a short chop
   * takes a hit every few tenths, and past a handful a second the hand
   * stops feeling slaps and starts feeling a buzz — which is also the
   * fastest way to flatten a phone. */
  slapGap: 0.12,
  /** How long one slap is, ms. Short: a slap is the bottom arriving, not a
   * landing, and a long one under a rider crossing a chop would never let
   * the motor settle. */
  slapMs: 26,
  /** …and the band it grows over, from `slapFrom` to the physics' cap. The
   * top of it is deliberately a real blow rather than a texture: a bottom
   * meeting a wave at seven g IS one of the hardest things that happens to
   * this hull, and a chop that could not out-buzz a gentle touchdown would
   * be the surface lying about the water. The one-motor ledger below is
   * what keeps it from eating a landing all the same. */
  slapStrength: [0.2, 0.62] as const,
  /** A landing is reported as an event and sized below; the slam it carries
   * must not ALSO be paid out as a slap. This long after a landing, s, the
   * slam is the landing's own — the same guard, for the same reason, as the
   * chop bed's `LANDING_OWNS_S`. */
  landingOwns: 0.3,
} as const;

/** How hard the hull arrives for a landing to be as big as it gets, m/s of
 * descent, and the descent past which it is a SLAM rather than a touchdown.
 * The same two rungs the bank bands `land_soft` from `land_hard` on
 * (`audio/route.ts`), because they are the same landing. */
const LAND_FULL = 9;
const LAND_SLAM_VY = 5;

/** Closing speed at which a solid met is as big as it ever gets, m/s. */
const HIT_FULL = 20;

/** Take a value from `lo`..`hi` to 0..1. */
function ramp(value: number, lo: number, hi: number): number {
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
}

/** What one event is worth in the hands. Null means it is not felt. */
export function rumbleForEvent(event: GameEvent): Rumble | null {
  switch (event.kind) {
    // THE HULL ARRIVING. Sized by its DESCENT rather than by its air time,
    // for the reason the bank gives: a short hop off a steep lip lands
    // harder than a long floaty flight that comes down on the back of a
    // swell. A touchdown is felt too — a runabout has no suspension, so
    // there is no such thing as a landing the rider does not take.
    case "land": {
      const descent = Math.abs(event.vy);
      const big = ramp(descent, 1, LAND_FULL);
      const slammed = descent >= LAND_SLAM_VY;
      return { ms: 70 + 120 * big, strength: (slammed ? 0.7 : 0.45) + 0.25 * big };
    }

    // THE BOW BURIED. The one event in the game that is a SHOVE rather than
    // a blow — the water takes hold of the front of the hull and holds it —
    // so it is the longest pulse here short of going over.
    case "dive": {
      const deep = ramp(event.depth, 0.3, 1.5);
      return { ms: 150 + 90 * deep, strength: 0.7 + 0.3 * deep };
    }

    // A solid. A nudge on a skerry is a knock and nothing more; a rock met
    // at twenty is the hardest single thing that happens to this hull.
    case "hit": {
      const hard = ramp(event.speed, 2, HIT_FULL);
      return { ms: 90 + 140 * hard, strength: 0.6 + 0.4 * hard };
    }

    // The keel on the bottom — a beach, a reef. A grounding is a scrape
    // rather than a blow, and it stays a scrape however fast it was taken:
    // long, and never as hard as the rock it did not hit.
    case "ground": {
      const fast = ramp(event.speed, 1, 12);
      return { ms: 110 + 80 * fast, strength: 0.4 + 0.25 * fast };
    }

    // Over, and the rider climbing back on. The one moment worth the whole
    // of what the motor has.
    case "capsize":
      return { ms: RUMBLE.longest, strength: 1 };

    // THE TORNADO TAKING HIM, out past the far edge of the open ocean. Read
    // off the event's `grip` — how much of the tornado stands where he is —
    // rather than off the wind in m/s, because the wind out there is quoted
    // against what the craft can do and means a different thing at every
    // speed class, where the grip is 0..1 at all of them. The
    // exception to this surface's rule about news, and to its rule about
    // `launch`: this is not the game telling the rider something, it is a
    // wall of air picking his craft up off the water, and it is the only
    // moment in the game where the hull leaves the sea because something
    // else decided it should. It is worth the whole motor for that reason —
    // and it can afford it, because `tornado.eventGap` already holds it to
    // one telling a throw and nothing else is happening in the hands while
    // a rider is twenty metres up in a column of air.
    case "tornado": {
      const hard = ramp(event.grip, TUNING.wind.tornado.eventShare, 1);
      return { ms: RUMBLE.longest, strength: 0.8 + 0.2 * hard };
    }

    default:
      return null;
  }
}

/** What a craft has to carry for its slam to be read. Every field is
 * written once per step by `craft.ts`. */
export type SlamRead = Pick<CraftState, "slam" | "landing" | "spec">;

/**
 * THE SEA UNDER THE HULL, right now — or null while the bottom is merely
 * riding rather than landing on it.
 *
 * Read off the craft every frame rather than off an event, because the chop
 * is a thing the hull is IN and not a thing that happens to it. The slam is
 * turned into g of the craft's own weight first, which is what makes the
 * reading the same on the dart as on the otter: a heavier hull takes a
 * bigger force for the same slap, and the rider feels the acceleration.
 */
export function rumbleForSlam(craft: SlamRead): Rumble | null {
  if (craft.landing < RUMBLE.landingOwns) return null;
  const slamG = craft.slam / (totalMass(craft.spec) * TUNING.g);
  if (slamG <= RUMBLE.slapFrom) return null;
  const hard = ramp(slamG, RUMBLE.slapFrom, TUNING.hull.slamCapG);
  const [soft, full] = RUMBLE.slapStrength;
  return { ms: RUMBLE.slapMs, strength: soft + (full - soft) * hard };
}

/** The run's rumble: events in, pulses out, plus the sea underneath. */
export type RunRumble = {
  /** Translate one step's events into pulses. */
  events: (list: readonly GameEvent[]) => void;
  /**
   * The hull, read once per STEP — from inside the step loop, beside
   * `events`, and NOT once per drawn frame.
   *
   * The slam is written every step and zeroed the moment the hull is riding
   * rather than landing, so it is a spike a couple of steps wide at 120 Hz.
   * A frame samples one step in two on a phone holding 60, and one in
   * twenty on a phone that is struggling — so a per-frame reading does not
   * simply feel the chop less on a slow machine, it feels a RANDOM fifth of
   * it, and the hardest slap of a crossing is as likely to be missed as any
   * other. Every step is offered here and the hardest since the last payout
   * is the one that is felt.
   */
  step: (craft: SlamRead) => void;
  /** Advance the sea's pulse train and pay out what `step` has collected;
   * call once per rendered frame, and only on the frames the player is
   * actually riding — a frame that is not fed is a frame that is not felt,
   * which is what a card over a held run should be. */
  frame: (dt: number) => void;
  /** A new run, or a run put down: forget the ledger, so the first slap of
   * the next one is not refused by the last one's landing. */
  reset: () => void;
};

/**
 * ONE MOTOR, SO ONE PULSE AT A TIME.
 *
 * A device has a single vibrator and no mixer: asking for a second pulse
 * while the first is still running does not layer them, it CUTS the first
 * one off and starts the new one. So the ledger below keeps what is
 * currently running and refuses anything weaker until it has finished —
 * without that, a hull hammering a chop would truncate every landing it
 * came down into, and the hardest moment in a run would be the shortest
 * buzz in it.
 *
 * The clock is the frame's own `dt` rather than a wall clock, which keeps
 * this module DOM-free and its behaviour exactly reproducible in a test.
 * Events arrive from inside the step loop, so several land on one frame's
 * reading of the clock: that is the same simultaneity the audio funnel
 * treats as one moment, and here the strongest of them wins outright.
 */
export function createRunRumble(shake: (pulse: Rumble) => void): RunRumble {
  let clock = 0;
  let busyUntil = 0;
  let busyStrength = 0;
  let nextSlap = 0;
  /** The hardest slap since the last payout, or null. Held across frames
   * rather than dropped, so a slam that lands inside the gap is felt the
   * moment the gap runs out instead of being thrown away. */
  let pendingSlap: Rumble | null = null;

  const fire = (pulse: Rumble): void => {
    if (clock < busyUntil && pulse.strength <= busyStrength) return;
    busyUntil = clock + pulse.ms / 1000;
    busyStrength = pulse.strength;
    shake(pulse);
  };

  return {
    events(list) {
      let biggest: Rumble | null = null;
      for (const event of list) {
        const pulse = rumbleForEvent(event);
        if (pulse && (!biggest || pulse.strength > biggest.strength)) biggest = pulse;
      }
      if (biggest) fire(biggest);
    },

    step(craft) {
      const pulse = rumbleForSlam(craft);
      if (pulse && (!pendingSlap || pulse.strength > pendingSlap.strength)) pendingSlap = pulse;
    },

    frame(dt) {
      clock += dt;
      if (clock < nextSlap || !pendingSlap) return;
      const pulse = pendingSlap;
      pendingSlap = null;
      nextSlap = clock + RUMBLE.slapGap;
      fire(pulse);
    },

    reset() {
      busyUntil = 0;
      busyStrength = 0;
      nextSlap = clock;
      pendingSlap = null;
    },
  };
}
