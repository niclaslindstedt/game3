// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE APP MARK'S WAVE, BUILDING.
//
// The crest off the icon (`app-mark.ts`) — without the water under it and
// without the sun behind it, both of which belong to the icon: a tile has
// room for the sea the wave stands in and a loading card does not. On its own
// the crest IS the mark. It fills from the tail on the left, up the face and
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
// It also has to be drawn in a box that CONTAINS the curl — see
// MARK_WAVE_BOX.
//
// The double translate is how a wipe is done with transforms alone. The
// clipping box slides right over the drawing while the drawing slides left by
// the same amount inside it, so the drawing stays PUT on screen and only the
// window into it moves. Two transforms, no layout, nothing for the main
// thread to do once it has started them.

import { MARK_WAVE, MARK_WAVE_VIEWBOX, MARK_WIDTH } from "./app-mark.ts";

/** The crest's own framing — the box the curves actually ink, derived in
 * `app-mark.ts` from the curves themselves. It used to be the ICON's
 * framing plus a hand-measured overhang for the curl, because the icon lets
 * the wave run off its edges and a wipe cannot: the fill is a box with
 * `overflow: hidden`, so ink outside it is ink the fill can never uncover,
 * and what that looks like is a pale rectangle standing beside a finished
 * mark. A measured overhang is a number that is wrong the next time the lip
 * is reshaped, so the box is computed instead. */
export const MARK_WAVE_BOX = MARK_WAVE_VIEWBOX;

/** The box's ratio, which `.mark-wave` restates in styles.css because a
 * stylesheet cannot import a TypeScript module. Change one, change both. */
export const MARK_WAVE_RATIO = (() => {
  const [, , w, h] = MARK_WAVE_BOX.split(" ").map(Number);
  return [w, h] as const;
})();

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
