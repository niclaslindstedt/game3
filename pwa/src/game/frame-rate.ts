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
