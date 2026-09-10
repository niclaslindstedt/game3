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
