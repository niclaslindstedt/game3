// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RUN'S AUDIO FRONT DOOR: engine events in, sound out, plus the beds
// that run underneath all of it.
//
// The engine emits `GameEvent`s from `step()` and has no idea any of them make
// a noise; this is the one place that opinion lives. A moment the simulation
// never reports — the slap of the bottom on a wave, the spray, the wind, the
// surf, a gull off the skerry — is not an event and never becomes one: it is
// read off the state by a bed (`ride-bed.ts` for the craft and the water,
// `bird-bed.ts` for the sky).
//
// WHICH sound an event makes is `route.ts`; this module owns WHEN, WHERE
// FROM (the camera's ear, `listener.ts`), and the two rules that only a
// funnel every sound passes through can enforce.
//
// EVERYTHING IS SYNTHESIZED FROM AUTHORED PARAMETERS. The game ships no
// audio file, no sample, no MIDI: a sound is a list of numbers in `bank.ts`
// or a layer steered by a pure function of the state, and the only module
// that touches WebAudio is `lib/synth.ts`. `docs/audio.md` says why.

import type { GameEvent, GameState } from "@engine";

import { RUN_BANK } from "./bank.ts";
import { createBirdBed, type BirdBed } from "./bird-bed.ts";
import { bubbleBurst } from "./bubbles.ts";
import { sfx } from "./bus.ts";
import { listenerFor, type Listener } from "./listener.ts";
import { playSound } from "./play.ts";
import { createRideBed, type RideBed } from "./ride-bed.ts";
import { bubblesForEvent, heardFrom, soundForEvent } from "./route.ts";

export { setAudioVolumes, unlockAudio } from "./bus.ts";
export { RUN_BANK } from "./bank.ts";
export { bubblesForEvent, soundForEvent } from "./route.ts";

export type RunAudio = {
  /** Translate one step's events into sound. */
  events: (list: readonly GameEvent[]) => void;
  /** Advance the continuous beds; call once per rendered frame. `duck`
   * scales the whole bed — 1 with the player's hands on the craft, less
   * under a card the sea is scenery behind. */
  frame: (state: GameState, dt: number, duck?: number) => void;
  /** Which camera the run is watched from. The whole mix moves with it. */
  setView: (view: string) => void;
  /**
   * NOTHING IS BEING HEARD THIS FRAME — the run is behind the pause card, or
   * the tab is away. The beds go quiet and nothing else is forgotten, so
   * resuming picks the note back up.
   *
   * Cheap enough to call on every frame that does not feed the beds, and
   * that is how it is meant to be called: `frame` is the only thing keeping
   * a layer alive, so every path that skips it has to come through here.
   */
  silence: () => void;
  /** A run ended or the player left it. */
  reset: () => void;
};

export function createRunAudio(): RunAudio {
  const bed: RideBed = createRideBed(sfx);
  const birds: BirdBed = createBirdBed(sfx);
  let ear: Listener = listenerFor("chase");

  return {
    events(list) {
      // TWO EVENTS THAT MAKE THE SAME SOUND IN ONE STEP PLAY ONCE. Everything
      // in a step is simultaneous, so a hull that touched two skerries
      // between two steps would start two sample-aligned copies of one
      // waveform: that is not two hits, it is one hit at twice the level,
      // driving the mix into the limiter for no gain in information.
      const played = new Set<string>();
      for (const event of list) {
        const hit = soundForEvent(event);
        if (!hit || played.has(hit.id)) continue;
        played.add(hit.id);
        playSound(sfx, RUN_BANK, hit.id, heardFrom(hit.shape, ear));
        const tail = bubblesForEvent(event);
        if (tail) bubbleBurst(sfx, tail.count, tail.big, tail.gain * ear.events);
      }
    },

    frame(state, dt, duck = 1) {
      bed.update(state, dt, duck);
      birds.update(state, dt, duck);
    },

    setView(view) {
      ear = listenerFor(view);
      bed.setView(view);
      birds.setView(view);
    },

    silence() {
      bed.silence();
      birds.silence();
    },

    reset() {
      bed.reset();
      birds.reset();
    },
  };
}
