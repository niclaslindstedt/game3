// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CLOCK THE APP STEPS THE ENGINE ON (OSS_GAME_SPEC §37). The display
// hands the app frames at whatever rate it likes; the engine takes steps of
// exactly `1 / TUNING.physicsHz`. This is the accumulator between the two,
// DOM-free so the root suite can hold it to the three decisions below
// without a browser. `App.tsx` feeds it `requestAnimationFrame`'s clock and
// the page's visibility; it hands back how many steps to take.
//
// THE THREE DECISIONS, each stated once:
//
// - THE FRAME DELTA IS CLAMPED to `MAX_FRAME_SECONDS` and THE TIME BEYOND IT
//   IS DROPPED, never paid down later (§37.2). A hitch, a garbage
//   collection, a laptop lid: the run resumes where it was, a tenth of a
//   second at most behind, rather than simulating the stall at a hundred
//   steps a frame until the debt spirals. A run is not a clock nobody may
//   stop; it is the player's, and they were not riding it while the machine
//   was away.
// - LOSING FOCUS PAUSES THE RUN (§37.3). This is a single-player game: a
//   hidden tab, a minimised window or a phone call stops the world, the
//   run clock included, and coming back lands on the very frame it left.
//   The accumulator is emptied on resume so the first frame back is one
//   frame long and not the whole absence — returning is never a stall.
//   `docs/configuration.md` states the decision for the player.
// - THE SIMULATION NEVER LEARNS THE FRAME RATE. Steps are whole; the
//   fraction of a step left in the accumulator carries to the next frame,
//   and `alpha` is offered to the renderer for interpolation only — nothing
//   in the engine ever reads it.

/** The most frame time one frame may hand the accumulator, s. Twelve steps
 * at 120 Hz — a frame a good deal longer than that is a stall, not a slow
 * frame, and its time is dropped. */
export const MAX_FRAME_SECONDS = 0.1;

export type RunClock = {
  /** Hand the clock `elapsed` seconds of wall time since the last frame;
   * get back how many fixed steps to take now. Zero while paused. */
  frame: (elapsed: number) => number;
  /** Fraction of a step left over after the last `frame`, 0..1 — the
   * renderer's interpolation weight, never the engine's. */
  alpha: () => number;
  /** The tab went away: nothing steps until `resume`. */
  pause: () => void;
  /** The tab is back: the absence is forgotten, the next frame is one
   * frame long. */
  resume: () => void;
  paused: () => boolean;
  /** Seconds of frame time dropped so far by the clamp — a diagnostic the
   * developer overlay will print, so a stuttering machine can be named. */
  dropped: () => number;
};

/** A clock stepping at `hz` fixed steps a second. */
export function createRunClock(hz: number): RunClock {
  const dt = 1 / hz;
  let acc = 0;
  let paused = false;
  let dropped = 0;
  return {
    frame: (elapsed) => {
      if (paused) return 0;
      const taken = Math.min(Math.max(0, elapsed), MAX_FRAME_SECONDS);
      dropped += Math.max(0, elapsed) - taken;
      acc += taken;
      const steps = Math.floor(acc * hz + 1e-9);
      acc -= steps * dt;
      if (acc < 0) acc = 0;
      return steps;
    },
    alpha: () => acc * hz,
    pause: () => {
      paused = true;
    },
    resume: () => {
      paused = false;
      acc = 0;
    },
    paused: () => paused,
    dropped: () => dropped,
  };
}
