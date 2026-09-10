// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DRAWING BUFFER a canvas box asks for.
//
// A WebGL canvas has two sizes that are only related because something keeps
// them related: the CSS box the browser lays out, and the pixel buffer the
// GPU draws into. The browser stretches the second onto the first, so a
// disagreement between them is never a missing row of pixels — it is the
// whole picture pulled along one axis, which is what a phone turned on its
// side looks like when nothing has re-measured it.
//
// The arithmetic of keeping them agreed lives here rather than in the
// renderer so it can be exercised with nothing standing up but Node: what a
// box measured between layouts turns into, what the pixel ratio is capped
// at, and which measurements are worth acting on.

/** The device pixel ratio ceiling: a 3× phone drawing nine pixels for every
 * one it can show is a phone at 20 fps. */
export const MAX_DPR = 2;

/** The floor under whatever the RESOLUTION row asks for. A canvas an eighth
 * of a CSS pixel across is not a cheap picture, it is a broken one — and a
 * ratio rounding to zero is a zero-width drawing buffer, which draws nothing
 * at all until the app is restarted. */
export const MIN_DPR = 0.25;

/** A canvas's two sizes: the CSS box in whole px, and how many device pixels
 * are drawn per CSS px inside it. */
export type Viewport = { w: number; h: number; dpr: number };

/**
 * The viewport a measured CSS box wants.
 *
 * Both sides are floored to one pixel because a box can be measured while
 * the browser is between layouts — mid-rotation, or before the canvas is in
 * the document — and reads 0 there. A zero-height buffer is an aspect ratio
 * of `Infinity` or `NaN`, which reaches the projection matrix and draws
 * nothing at all until the app is restarted.
 *
 * `scale` is the RESOLUTION row's share (`settings-video.ts`), applied AFTER
 * the cap rather than before it: the cap is the page's own policy about a
 * dense screen and the row is the rider's about their machine, so a rider who
 * asks for half gets half of what the page was going to draw anyway, on every
 * device. A share that is not a positive number is no opinion, which is 1.
 */
export function viewportOf(cssWidth: number, cssHeight: number, dpr: number, scale = 1): Viewport {
  const share = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return {
    w: Math.max(1, Math.round(cssWidth)),
    h: Math.max(1, Math.round(cssHeight)),
    dpr: Math.max(MIN_DPR, Math.min(MAX_DPR, dpr > 0 ? dpr : 1) * share),
  };
}

/** Whether a fresh measurement asks for anything the buffer is not already.
 * Resizing is driven by every notice the browser gives — a rotation, a zoom,
 * a window drag, a keyboard opening — and most of them change nothing. */
export function sameViewport(a: Viewport | null, b: Viewport): boolean {
  return a !== null && a.w === b.w && a.h === b.h && a.dpr === b.dpr;
}
