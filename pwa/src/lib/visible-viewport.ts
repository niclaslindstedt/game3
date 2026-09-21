// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SHELL HELD OVER THE PART OF THE SCREEN THE BROWSER IS SHOWING.
//
// The game is one fixed, non-scrolling shell the size of the viewport, and
// that is a bet: that the viewport the page is laid out in is the screen the
// player is looking at. A software keyboard is where the bet comes off. iOS
// does not re-lay the page for one — it keeps the layout viewport at its full
// height, makes the VISIBLE window short, and slides that window down the
// layout viewport so the field being typed into stays above the keys. Every
// `position: fixed` surface stays behind with the layout viewport, so the
// game ends up somewhere off the bottom of the screen with the app's own
// background colour (`PALETTE.sea`, the manifest's `background_color`) where
// it used to be. On an iPhone held on its side that is about 245 of 393 px —
// nearly two thirds of the picture — and the keyboard does not have to still
// be up for it to be on screen: a field unmounted while it still had focus
// takes the keyboard away and leaves the offset behind.
//
// So how far that window has been pushed off each edge is measured and
// published as two lengths, and the stylesheet lays the shell out inside what
// is left rather than against the viewport's own edges. The arithmetic is
// `lib/viewport.ts`'s `visibleBox` (DOM-free, and tested); what is here is the
// listening, the writing, and the one repair.
//
// THE REPAIR: an offset window with nothing focused is a window the browser
// forgot to put back, and scrolling to the origin is what puts it back.
// Guarded by the focus, because while a field really is being typed into the
// offset is the browser doing its job and fighting it would scroll the keys
// back over the field on every keystroke.

import { sameBox, visibleBox, type VisibleBox } from "./viewport.ts";

/** Whether the focus is somewhere a keyboard is legitimately up for. A
 * `select` is included: it opens a picker on a phone and moves the window
 * exactly as the keys do. */
function typing(active: Element | null): boolean {
  if (!active) return false;
  const tag = active.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return active instanceof HTMLElement && active.isContentEditable;
}

/**
 * Keep `--shell-top` and `--shell-bottom` on the document element saying how
 * far the visible window has been pushed off the viewport's two edges, and
 * put a forgotten window back.
 *
 * Returns the way to stop. Called once, before the app renders, so the first
 * layout is already measured rather than corrected a frame later.
 *
 * ONLY THE DISPLACEMENT IS WRITTEN, never a height. How tall the viewport is
 * is the stylesheet's `--shell-height`, and on iOS it has to stay a unit:
 * `100vh` reaches the physical bottom of the screen where the layout viewport
 * this measures against stops short of it. So both properties are 0 whenever
 * the browser is showing the whole page, and the shell is then laid out to
 * the same lengths it would have been with none of this here.
 */
export function watchVisibleViewport(): () => void {
  const visual = window.visualViewport;
  const root = document.documentElement;
  let worn: VisibleBox | null = null;

  const measure = (): void => {
    // Measured against the LAYOUT viewport (`window.innerHeight`), which is
    // the box the visible window is offset WITHIN and the box every
    // `position: fixed` surface is laid out against. Both readings come from
    // the same place, so a browser that means something slightly different by
    // it still reports no displacement when there is none.
    const next = visibleBox(visual, window.innerHeight);
    if (!sameBox(worn, next)) {
      worn = next;
      root.style.setProperty("--shell-top", `${next.top}px`);
      root.style.setProperty("--shell-bottom", `${next.bottom}px`);
    }
    // Nothing is being typed into, so an offset window is a window left
    // behind by a keyboard that has already gone. Both offsets are put back:
    // whether the displacement lands on the document's scroll or on the
    // visual viewport's own is the browser's business, and one `scrollTo`
    // answers for both. It settles rather than loops — the scroll it asks
    // for reports back with the offsets at zero, which asks for nothing.
    if (typing(document.activeElement)) return;
    if (next.top !== 0 || window.scrollY !== 0 || window.scrollX !== 0) {
      window.scrollTo(0, 0);
    }
  };

  measure();
  // Every notice the browser gives that the window may have moved or
  // changed size. `focusout` is the one that matters for the repair — it is
  // the moment a keyboard starts to go — and `pageshow` and the visibility
  // change cover an app coming back from the background, which is the other
  // way a stale offset is found waiting.
  visual?.addEventListener("resize", measure);
  visual?.addEventListener("scroll", measure);
  window.addEventListener("resize", measure);
  window.addEventListener("orientationchange", measure);
  window.addEventListener("pageshow", measure);
  window.addEventListener("focusout", measure);
  document.addEventListener("visibilitychange", measure);

  return () => {
    visual?.removeEventListener("resize", measure);
    visual?.removeEventListener("scroll", measure);
    window.removeEventListener("resize", measure);
    window.removeEventListener("orientationchange", measure);
    window.removeEventListener("pageshow", measure);
    window.removeEventListener("focusout", measure);
    document.removeEventListener("visibilitychange", measure);
  };
}
