// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE EAR IS — what each rung of the camera ladder does to the mix.
//
// The picture moves from the foredeck to a helicopter and the sound has to
// move with it, or the heli shot is a rider's seat with a long lens. Every
// number here is a multiplier on one part of the mix, read by the beds
// every frame and by the event router for the one-shots, and the whole
// table is the opinion about what a jet ski sounds like from each seat:
//
//   * ON THE FOREDECK (`bow`) the engine is BEHIND you and the water is an
//     arm's length away: the bow slicing, the spray, the wind full in the
//     face, and the pump a distant whine.
//   * ON THE SADDLE (`nose`) the engine is under you, the intake is at your
//     knees, the wind is in your ears and the spray is off both chines.
//   * OVER THE TRANSOM (`close`) the pump and the exhaust are the loudest
//     things in the world — the froth, the whine, the wet blat at idle.
//   * BEHIND AND ABOVE (`chase`, the seat the game is tuned at) it is all
//     there in proportion: the row of ones.
//   * STOOD BACK (`far`) and FLOWN HIGH (`heli`) the craft is a small thing
//     on a big sea: the engine thin, the wind gone, the surf and the swell
//     most of what there is.
//
// DOM-free, three-free, so the tests can read it and the audition page can
// switch seats without a renderer.

import type { CameraMode } from "../camera.ts";

export type Listener = {
  /** The engine's own note: the hum, its octave, the bass and the intake. */
  engine: number;
  /** The exhaust's edge and its wet blat at idle — heard from BEHIND. */
  exhaust: number;
  /** The pump: the impeller's whine and the cavitation froth at the transom. */
  pump: number;
  /** How bright the engine is, 0..1: the hum's lowpass is scaled by it. A
   * seat with the block between it and the exhaust is a lowpass. */
  tone: number;
  /** The water on the hull — the wash, the chop, the spray off the chines. */
  hull: number;
  /** The rider's own wind. */
  wind: number;
  /** The sea that is not the craft's: the swell, the surf on the shore. */
  sea: number;
  /** Every one-shot the run makes. */
  events: number;
  /** A pitch multiplier on those one-shots. Below 1 moves every filter down
   * with it: a slap heard from a helicopter is a duller slap. */
  muffle: number;
};

export const LISTENERS: Record<CameraMode, Listener> = {
  bow: {
    engine: 0.7,
    exhaust: 0.45,
    pump: 0.5,
    tone: 0.8,
    hull: 1.4,
    wind: 1.4,
    sea: 1.1,
    events: 1.1,
    muffle: 1,
  },
  nose: {
    engine: 1.1,
    exhaust: 0.7,
    pump: 0.8,
    tone: 0.9,
    hull: 1.1,
    wind: 1.3,
    sea: 0.9,
    events: 1,
    muffle: 1,
  },
  close: {
    engine: 0.95,
    exhaust: 1.25,
    pump: 1.35,
    tone: 1,
    hull: 1.1,
    wind: 1,
    sea: 0.9,
    events: 1,
    muffle: 1,
  },
  chase: {
    engine: 0.9,
    exhaust: 1.1,
    pump: 1.1,
    tone: 1,
    hull: 1,
    wind: 0.85,
    sea: 1,
    events: 1,
    muffle: 1,
  },
  far: {
    engine: 0.75,
    exhaust: 1,
    pump: 0.9,
    tone: 0.9,
    hull: 0.85,
    wind: 0.55,
    sea: 1.15,
    events: 0.9,
    muffle: 0.95,
  },
  heli: {
    engine: 0.55,
    exhaust: 0.85,
    pump: 0.7,
    tone: 0.8,
    hull: 0.7,
    wind: 0.3,
    sea: 1.3,
    events: 0.8,
    muffle: 0.9,
  },
};

/** The mix for a camera, or the chase view's for anything that is not on
 * the ladder. */
export function listenerFor(view: string | null | undefined): Listener {
  return (view && (LISTENERS as Record<string, Listener>)[view]) || LISTENERS.chase;
}
