// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW FAST THE PICTURE IS ARRIVING, as one number a rider can read.
//
// The instantaneous rate — a thousand over the last frame's milliseconds — is
// useless on screen: a browser delivers frames a millisecond or two apart from
// each other's ideal and the figure flickers through a five-frame range while
// nothing is wrong. So the readout is an exponential average, and this module
// is the whole of it: DOM-free, so `tests/video_test.ts` reads the rule
// without a browser, and stated once so the HUD does no arithmetic of its own.

/** How much of a new frame's rate the reading takes.
 *
 * An eighth is the balance between the two ways a frame counter is useless. Too
 * eager and it is the raw jitter with extra steps; too lazy and it is still
 * reporting the last corner while the current one stutters. At an eighth the
 * reading settles within about half a second — a length of time a rider will
 * sit and watch — and holds still enough between frames to be read at all. */
export const FPS_SMOOTHING = 1 / 8;

/** A frame longer than this, ms, is not a frame rate — it is a STALL: the tab
 * coming back from the background, a level being built, the first draw
 * compiling every shader in the scene. Folding one into the average buries the
 * readout at single digits for seconds afterwards and says nothing true about
 * how the game runs, so it is skipped and the reading holds. Four hundred
 * milliseconds is well past the worst honest frame (a landing's plume on a
 * phone) and well under the shortest stall worth hiding. */
export const FPS_STALL_MS = 400;

/** The reading before any frame has been measured — and what a stall-only
 * session keeps reading. */
export const FPS_UNKNOWN = 0;

/**
 * The reading after one more frame of `frameMs`.
 *
 * Pure: the caller keeps the number. A first real frame is taken whole rather
 * than eased up from zero, so the corner of the screen says something true on
 * the frame it appears rather than climbing for half a second first.
 */
export function smoothFps(reading: number, frameMs: number): number {
  if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > FPS_STALL_MS) return reading;
  const now = 1000 / frameMs;
  return reading > 0 ? reading + (now - reading) * FPS_SMOOTHING : now;
}

/** THE GATE — the FRAME RATE row, applied. A display hands the loop a callback
 * at its own rate; the gate says whether THIS one is worth drawing, and the
 * ones it refuses cost nothing at all: no step, no water, no draw, and their
 * wall time simply arrives with the next frame that is drawn (the run clock
 * takes elapsed time, not frames). Pure and DOM-free, so `tests/video_test.ts`
 * can hold it to the two things a cap has to get right: a cap at or above the
 * display's own rate must never skip, and a cap under it must land on the
 * rate asked for rather than on the nearest multiple of the display's. */
export type FrameGate = {
  /** Whether the frame at `now` (ms) should be drawn. */
  due: (now: number) => boolean;
  /** Hold the loop to `fps` frames a second; anything non-finite is no cap. */
  setCap: (fps: number) => void;
};

export function createFrameGate(fps = Number.POSITIVE_INFINITY): FrameGate {
  let period = periodOf(fps);
  /** When the next frame is due, ms. */
  let next = Number.NEGATIVE_INFINITY;
  return {
    due: (now) => {
      if (period <= 0) return true;
      // A display at exactly the cap's rate delivers its callbacks a hair
      // early and a hair late by turns, and a strict comparison would skip
      // half of them: a frame within a fifth of a period of its time is taken.
      if (now < next - period * GATE_SLACK) return false;
      // The next frame is due one period after THIS one was, not after this
      // one arrived — or a display half again as fast as the cap, whose
      // callbacks land a third of a period late, would drift the rate up to
      // its own next divisor. Only a frame a whole period late resyncs the
      // grid to itself: a machine that cannot keep the cap draws every frame
      // it gets, and never bursts to make up the ones it missed.
      next = now - next > period ? now + period : next + period;
      return true;
    },
    setCap: (fps) => {
      period = periodOf(fps);
    },
  };
}

/** How early a frame may be taken, as a share of the cap's period. */
const GATE_SLACK = 0.2;

function periodOf(fps: number): number {
  return Number.isFinite(fps) && fps > 0 ? 1000 / fps : 0;
}
