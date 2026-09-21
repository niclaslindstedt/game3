// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DRAWING BUFFER a canvas box asks for, and WHERE THE PAGE IS VISIBLE.
//
// A WebGL canvas has two sizes that are only related because something keeps
// them related: the CSS box the browser lays out, and the pixel buffer the
// GPU draws into. The browser stretches the second onto the first, so a
// disagreement between them is never a missing row of pixels — it is the
// whole picture pulled along one axis, which is what a phone turned on its
// side looks like when nothing has re-measured it.
//
// A PAGE has two sizes for the same reason: the layout viewport it is laid
// out in, and the visible window the browser is currently showing of it. A
// disagreement between THOSE is a shell that is mostly off the screen with
// the app's background colour where the game should be.
//
// The arithmetic of keeping both pairs agreed lives here rather than in the
// renderer or in the page so it can be exercised with nothing standing up
// but Node: what a box measured between layouts turns into, what the pixel
// ratio is capped at, where the visible window sits, and which measurements
// are worth acting on. `lib/visible-viewport.ts` is the half that listens.

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

/** WHERE THE BROWSER IS ACTUALLY SHOWING THE PAGE — the visible window's
 * place inside the layout viewport, in CSS px. `top` and `bottom` are the
 * strips of layout viewport above and below it, which is what a surface
 * anchored to the viewport's own top or bottom edge has to be pushed by. */
export type VisibleBox = { top: number; height: number; bottom: number };

/** The visual viewport as this module needs it — the fields of
 * `window.visualViewport` that say where the visible window is. */
export type VisualWindow = { height: number; offsetTop: number; scale: number };

/**
 * The visible window inside a layout viewport `layoutHeight` CSS px tall.
 *
 * The two viewports are normally the same box and this returns the whole
 * thing. They come apart when the browser shows only part of the page while
 * leaving the page laid out at full height — a software keyboard is the one
 * that happens here, and it takes about 245 of an iPhone's 393 landscape px.
 * The page is not re-laid for it: the visible window is made short and slid
 * DOWN the layout viewport so the field being typed into stays in view, and
 * a `position: fixed` shell stays behind with the layout viewport, mostly
 * off the screen. Anything anchored to a viewport edge therefore has to be
 * anchored to THIS box instead, and the caller publishes it as the
 * `--shell-*` custom properties the stylesheet reads.
 *
 * A PINCH-ZOOMED visual viewport is a lens rather than a smaller screen —
 * its height is the layout viewport's divided by the scale — so anything but
 * 1 is no opinion and the whole layout viewport comes back. The page locks
 * zoom out in its viewport meta, so this is the case that should not arise
 * rather than the case that is handled.
 *
 * Everything is rounded to whole px and clamped into the layout viewport:
 * the numbers are read back as lengths on the shell, and a fractional or
 * out-of-range one is a blurred edge or a shell with no height at all.
 */
export function visibleBox(visual: VisualWindow | null, layoutHeight: number): VisibleBox {
  const layout = Math.max(1, Math.round(layoutHeight));
  const whole = { top: 0, height: layout, bottom: 0 };
  if (!visual || !Number.isFinite(visual.height) || !Number.isFinite(visual.offsetTop)) {
    return whole;
  }
  if (Math.abs(visual.scale - 1) > 0.01) return whole;
  const top = Math.min(Math.max(0, Math.round(visual.offsetTop)), layout - 1);
  const height = Math.min(Math.max(1, Math.round(visual.height)), layout - top);
  return { top, height, bottom: layout - top - height };
}

/** Whether a fresh reading asks for anything the shell is not already
 * wearing. The visual viewport reports on every scroll of it, and almost
 * every one of those leaves the box where it was. */
export function sameBox(a: VisibleBox | null, b: VisibleBox): boolean {
  return a !== null && a.top === b.top && a.height === b.height && a.bottom === b.bottom;
}
