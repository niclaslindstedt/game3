// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHICH SOUND AN EVENT MAKES, and how big it is.
//
// Split out from the front door so it can be reasoned about — and tested —
// as what it is: a pure function from a `GameEvent` to a bank id and a
// scale. Nothing here touches the synth, so the whole opinion about what a
// run sounds like is one table a reader can check against the bank.
//
// WHAT AN EVENT DECIDES, AND WHAT IT ONLY SCALES. Some events pick a
// different SOUND — a level landing and a slammed one are two different
// things happening to a hull. Most only scale the one they have
// (`PlayShape`: louder, lower, longer). Reaching for a new def when a shape
// would do is how a bank ends up with nine landings that are the same four
// voices at different volumes.

import type { GameEvent } from "@engine";

import type { PlayShape } from "./types.ts";

/** How hard the hull arrives for a landing to be as loud as it gets, m/s of
 * descent, and the share of that the gentlest touchdown is still worth. A
 * landing is sized by its DESCENT rather than by its air time, because air
 * time is a guess at the same thing and a bad one: a short hop off a steep
 * lip lands harder than a long floaty flight that comes down on the back of
 * a swell. The floor is the mass of the craft — a small jump has to sound
 * like something. */
const LAND_FULL = 9;
const LAND_FLOOR = 0.3;

/** Past this descent, or this much pitch either way, a landing is SLAMMED
 * rather than clean: the flat bottom or the nose takes it. */
const SLAM_VY = 5;
const SLAM_PITCH = 0.25;

/** Closing speeds that separate a nudge on a skerry from a wreck, m/s. */
const HIT_FULL = 20;

/** THE SCORE'S OWN BANDS (`engine/game/tricks.ts`, `docs/riding.md`).
 *
 * A combo banks at the end of every counted flight, so most of them are a
 * one-second hop worth a few dozen points and a few are a double backflip
 * worth thousands. One def covers both and the PLAY is what differs: the
 * points decide how loud and how long, the MULTIPLIER decides how high.
 * They are two different facts about the same moment — a big dumb pile of
 * air time and a small combo taken at ×4 are not the same news — so they
 * get two different axes rather than being summed into one.
 *
 * `COMBO_FULL` is the purse a bank is as big as it ever gets at, points: a
 * four-second flight with a double backflip in it (5,876) is past it. The
 * floor is what the trivial bank is still worth, and it is low on purpose —
 * a tick under the engine, not a chime over it. */
const COMBO_FULL = 4000;
const COMBO_FLOOR = 0.25;

/** ...and how far the multiplier lifts the pitch: a sixteenth per rung, so
 * ×2 is a touch brighter and ×4 is plainly a different sound, capped so the
 * ladder cannot run off the top of the mix on a combo nobody has flown
 * yet. */
const MULT_LIFT = 0.06;
const MULT_RUNGS = 6;

/** A revolution's chime climbs a minor third per turn of the same flight
 * (`2^(1/4)`), capped: the second of a double has to be heard as the second
 * and not as a repeat, and a fourth turn does not exist yet. */
const SPIN_STEPS = 4;

/** Take a value from `lo`..`hi` to 0..1. */
function ramp(value: number, lo: number, hi: number): number {
  return Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
}

/** What one event sounds like. Null means the event is silent. */
export function soundForEvent(event: GameEvent): { id: string; shape?: PlayShape } | null {
  switch (event.kind) {
    case "gate":
      return { id: "gate" };

    // A ring taken higher is a bigger moment: the same chime, louder and
    // with a little more air in the whoosh.
    case "airGate": {
      const high = ramp(event.height, 1, 6);
      return { id: "air_gate", shape: { gain: 0.8 + 0.4 * high, stretch: 0.9 + 0.3 * high } };
    }

    case "missedGate":
      return { id: "missed" };

    case "launch": {
      // How hard the hull left the water. A crest barely registers; a lip
      // throws the sheet.
      const hard = ramp(event.vy, 1, 7);
      return { id: "launch", shape: { gain: 0.5 + 0.9 * hard, pitch: 1.1 - 0.25 * hard } };
    }

    case "land": {
      const descent = Math.abs(event.vy);
      const big = LAND_FLOOR + (1 - LAND_FLOOR) * ramp(descent, 0, LAND_FULL);
      const slammed = descent > SLAM_VY || Math.abs(event.pitch) > SLAM_PITCH;
      return {
        id: slammed ? "land_hard" : "land_soft",
        shape: { gain: 0.55 + 0.75 * big, pitch: 1.12 - 0.28 * big, stretch: 0.85 + 0.5 * big },
      };
    }

    case "dive": {
      const deep = ramp(event.depth, 0.3, 1.5);
      return {
        id: "dive",
        shape: { gain: 0.7 + 0.6 * deep, pitch: 1.05 - 0.2 * deep, stretch: 0.9 + 0.5 * deep },
      };
    }

    case "hit": {
      const hard = ramp(event.speed, 2, HIT_FULL);
      return {
        id: "hit_rock",
        shape: { gain: 0.6 + 0.7 * hard, pitch: 1.1 - 0.3 * hard, stretch: 0.9 + 0.5 * hard },
      };
    }

    case "ground": {
      const fast = ramp(event.speed, 1, 12);
      return { id: "ground", shape: { gain: 0.6 + 0.6 * fast, stretch: 0.8 + 0.6 * fast } };
    }

    // A REVOLUTION CLOSED, in the air. The rung it bought is the pitch: one
    // chime, climbing, rather than a def per turn.
    case "trick": {
      const turn = Math.min(event.spins, SPIN_STEPS) - 1;
      return {
        id: "trick",
        shape: { gain: 0.85 + 0.18 * turn, pitch: Math.pow(2, turn / 4) },
      };
    }

    // THE COMBO PAID. Loud and long by what it was worth, high by what it
    // was multiplied at.
    case "combo": {
      const worth = COMBO_FLOOR + (1 - COMBO_FLOOR) * ramp(event.points, 0, COMBO_FULL);
      return {
        id: "combo_bank",
        shape: {
          gain: 0.4 + worth,
          stretch: 0.85 + 0.3 * worth,
          pitch: 1 + MULT_LIFT * Math.min(event.mult - 1, MULT_RUNGS),
        },
      };
    }

    // ...and the combo lost, sized the same way by what it would have been
    // worth. No pitch lift: the multiplier died with it.
    case "bail": {
      const worth = COMBO_FLOOR + (1 - COMBO_FLOOR) * ramp(event.lost, 0, COMBO_FULL);
      return { id: "bail", shape: { gain: 0.45 + 0.85 * worth, stretch: 0.9 + 0.25 * worth } };
    }

    case "capsize":
      return { id: "capsize" };

    case "reset":
      return { id: "reset" };

    case "finish":
      return { id: "finish" };

    default:
      return null;
  }
}

/** THE RECORD'S OWN SOUND, over the top of the landing that took it.
 *
 * A second decision about the same event rather than a rung in the table
 * above, for the reason `bubblesForEvent` is one: the landing still sounds
 * like a landing — sized by how hard the hull arrived — and the news is a
 * separate voice laid over it. Folding the two together would mean a bank
 * carrying a second copy of every landing, one of them wearing a chime.
 *
 * `record` is the ENGINE's word (`step.ts`), decided where the run is
 * orchestrated, so nothing here compares clocks. */
export function recordForEvent(event: GameEvent): { id: string; shape?: PlayShape } | null {
  return event.kind === "land" && event.record ? { id: "air_record" } : null;
}

/** The bubbles an event leaves in the water after its own sound: how many,
 * how big (0..1 toward the deep end), how loud. Null for an event that
 * puts no air under the surface. */
export function bubblesForEvent(
  event: GameEvent,
): { count: number; big: number; gain: number } | null {
  switch (event.kind) {
    case "land": {
      const big = ramp(Math.abs(event.vy), 2, LAND_FULL);
      return { count: 3 + 9 * big, big: 0.15 + 0.3 * big, gain: 0.6 + 0.6 * big };
    }
    case "dive":
      return { count: 14, big: 0.6, gain: 1 };
    case "capsize":
      return { count: 22, big: 0.8, gain: 1.1 };
    case "reset":
      return { count: 5, big: 0.3, gain: 0.6 };
    default:
      return null;
  }
}

/** A play, as heard from a seat: the listener's gain on every one-shot and
 * its muffle on the pitch, which moves every filter with it. */
export function heardFrom(
  shape: PlayShape | undefined,
  ear: { events: number; muffle: number },
): PlayShape {
  return {
    ...shape,
    gain: (shape?.gain ?? 1) * ear.events,
    pitch: (shape?.pitch ?? 1) * ear.muffle,
  };
}
