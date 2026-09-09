// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE APP MARK'S WAVE, BUILDING.
//
// The crest off the icon (`app-mark.ts`) — without the hull, which belongs to
// the icon: there the hull is the subject and the wave is what it is riding,
// but on its own the crest IS the mark, and a hull parked on it reads as a
// hull that has stopped. It fills from the tail on the left, up the face and
// into the curl, which is the direction a wave actually builds.
//
// Two ways of filling it:
//
//   "once" — filled on arrival and left there. A flourish beside a title that
//            has just come up (the attract card's, the menu's wordmark). It
//            says the game has arrived.
//   "loop" — filled, held, faded, again. A load in progress
//            (`loading-screen.tsx`). It says the game is working.
//
// IT IS A WIPE, NOT A STROKE, AND THAT IS THE WHOLE DESIGN. The obvious way
// to draw a line on is `stroke-dashoffset`, and it is the wrong one here:
// that property animates on the MAIN THREAD, and the main thread is exactly
// what the loading card is covering for. Standing a shore up blocks it for
// seconds at a stretch (compiling the level and building the water mesh are
// single indivisible calls), and a mark that freezes for those seconds is
// worse than no mark at all — it reads as a hung game.
//
// So the fill is a BAND that slides across the finished shape, and a band is
// a `transform` — which browsers run on the COMPOSITOR, off the main thread,
// so it keeps moving through a block that would freeze a stroke animation
// solid.
//
// The band travels LEFT TO RIGHT because that is the axis the wave is built
// along: the tail is at the left of the box and the crest tips over at the
// right. The curl is the one part the band cannot honour exactly — it runs
// out past the lip and comes back, so its two halves are uncovered together
// rather than in the order the water travels. At the size this is ever drawn
// that reads as the curl arriving whole, which is what it should look like.
//
// It also has to be drawn in a box that CONTAINS the curl, which the icon's
// own framing does not — see CURL_OVERHANG.
//
// The double translate is how a wipe is done with transforms alone. The
// clipping box slides right over the drawing while the drawing slides left by
// the same amount inside it, so the drawing stays PUT on screen and only the
// window into it moves. Two transforms, no layout, nothing for the main
// thread to do once it has started them.

import { MARK_WAVE, MARK_WAVE_VIEWBOX, MARK_WIDTH } from "./app-mark.ts";

/**
 * How far the CURL runs past the right edge of the shared framing, in the
 * mark's own units.
 *
 * `MARK_WAVE_VIEWBOX` is the ICON's framing, and the icon lets the wave
 * overflow it — the hull sits in that corner and the curl breaking past the
 * edge is the drawing. Here it cannot: the wipe is a box with `overflow:
 * hidden`, so ink outside it is ink the fill can never uncover, and what
 * that looks like is a pale rectangle standing beside a finished mark.
 *
 * The curl's outer arc turns on a radius of 70 about a chord 121 long, which
 * puts its far side 35 units past the lip at x = 341, and the stroke adds
 * half its own width again. Thirty-two units clears both with a little air.
 */
const CURL_OVERHANG = 32;

const [BOX_X, BOX_Y, BOX_W, BOX_H] = MARK_WAVE_VIEWBOX.split(" ").map(Number);

/** The shared framing, widened to CONTAIN the curl. Derived rather than
 * written out, so a change to the icon's framing brings this with it. */
export const MARK_WAVE_BOX = `${BOX_X} ${BOX_Y} ${BOX_W + CURL_OVERHANG} ${BOX_H}`;

/** The box's ratio, which `.mark-wave` restates in styles.css because a
 * stylesheet cannot import a TypeScript module. Change one, change both. */
export const MARK_WAVE_RATIO = [BOX_W + CURL_OVERHANG, BOX_H] as const;

/** How the crest is filled: once and left, or over and over. */
export type MarkLay = "once" | "loop";

export function MarkWave({
  lay,
  className,
  title,
}: {
  lay: MarkLay;
  className?: string;
  /** Set only where the wave is the whole of what an element says. Beside a
   * wordmark it is decoration and stays out of the accessibility tree. */
  title?: string;
}) {
  return (
    <div
      class={`mark-wave mark-wave-${lay}${className ? ` ${className}` : ""}`}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : "true"}
    >
      {/* The finished shape, faint, under everything. It holds the space the
          fill is about to take, so nothing beside the mark shifts as it runs
          and the card never shows a half-drawn wave adrift of its own box. */}
      {crest("mark-wave-ghost")}
      {/* ...and the bright crest over it, behind a window that slides. */}
      <div class="mark-wave-wipe">
        <div class="mark-wave-slide">{crest("mark-wave-fill")}</div>
      </div>
    </div>
  );
}

/** One copy of the crest, as its own svg. Drawn twice — once faint and once
 * bright — because the wipe has to clip the bright copy without touching the
 * faint one under it. */
function crest(className: string) {
  return (
    <svg class={className} viewBox={MARK_WAVE_BOX} aria-hidden="true">
      {MARK_WAVE.map((d) => (
        <path key={d} d={d} stroke-width={MARK_WIDTH} />
      ))}
    </svg>
  );
}
