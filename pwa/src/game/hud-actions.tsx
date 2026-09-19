// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TWO PRESSES MADE WHILE THE CRAFT IS MOVING: the way back to the last
// gate and the next camera. They share a row in the top-right cluster,
// directly over the minimap, because that is the corner a rider already
// glances at — and they are MARKS rather than words, because the top strip is
// the one part of this screen that has to stay out of the way of the water.
//
// Both are drawn on every device rather than on touch alone. The keys (R and
// C) are the fast way for anybody who has learned them; the buttons are what
// makes those doors visible to everybody who has not — and the reset in
// particular is reached for with the hull upside down on a reef, which is the
// worst possible moment to be remembering a binding.
//
// THE SHUTTER IS NOT ONE OF THEM. A picture is worth a key (ENTER) and a menu
// row, and it is not worth a third mark over the water: a phone already has a
// shutter of its own, in the hardware, and the one thing this row must never
// become is the place a rider's thumb finds a camera instead of the reset.
//
// They live here rather than in hud.tsx because a glyph is geometry and
// hud.tsx is a layout: the two buttons are the same shape at the same weight,
// and a rider who has learned one has learned the other. Each mark is drawn
// on a viewBox cut to its own INK rather than to a round number, so the two
// sit at the same size in the middle of their discs — a box with slack down
// one side hangs its mark off-centre, and on a circle that is the one thing
// the eye catches.
//
// THE RESET LIGHTS UP WHEN A CHECKPOINT HAS BEEN MISSED. It is the press that
// answers that moment, and the moment a rider is least likely to be
// remembering the key for it, so it stops being one of two identical marks
// and becomes the only lit thing in the corner (`.hud-mini-missed`, on the
// same heartbeat the chart puts round the gate itself).

import { useMemo } from "preact/hooks";

import { createHudPress, pressHandlers } from "./hud-press.ts";
import { STRINGS } from "./strings.ts";

/** The reset mark: an arrow curling back on itself, which is what this does
 * to a run.
 *
 * THE BOX IS CUT ROUND THE STROKE, not round the line it is stroked on —
 * which is the one thing this mark and the camera below it do differently,
 * because this is the only one of the two that is stroked at all. The arc is
 * drawn at width 11, so its ink stands 5.5 outside the path on every side:
 * the sweep reaches x 84.03 and y 86.46, where its centreline stops at 78.53
 * and 80.96. Cut the box to the centreline and the ring is sliced flat down
 * its right-hand side and across its foot — and an SVG's default
 * `overflow: hidden` TRIMS rather than shrinks, so the mark does not look
 * too big, it looks like a different drawing. The arrowhead is filled with
 * no stroke on it and reaches x = 8, which is why the left edge alone is
 * flush with the box. */
function ResetGlyph() {
  return (
    <svg class="hud-glyph" viewBox="8 19.4 76.1 67.1" aria-hidden="true">
      <path
        d="M 24 44 A 28 28 0 1 1 30 72"
        fill="none"
        stroke="currentColor"
        stroke-width="11"
        stroke-linecap="round"
      />
      <polygon points="8,50 40,50 24,22" fill="currentColor" />
    </svg>
  );
}

/** The camera mark: a movie camera — body, lens cone and the two film reels
 * on top. Drawn rather than lettered for the same reason as the arrow. */
function CameraGlyph() {
  return (
    <svg class="hud-glyph" viewBox="2 1.9 20 17.6" aria-hidden="true">
      <circle cx="8" cy="5" r="3.1" />
      <circle cx="15" cy="5" r="3.1" />
      <rect x="2" y="9" width="14" height="10.5" rx="2" />
      <path d="M 16.6 12.6 L 22 9.6 L 22 18.9 L 16.6 15.9 Z" />
    </svg>
  );
}

/** The row itself. A button that keeps the focus keeps the next Enter, and
 * the next Enter is the shutter — so both let go of it on mouse-up, which is
 * what stops a press on RESET being repeated by every picture the rider takes
 * afterwards.
 *
 * BOTH ARE PRESSED THROUGH THE POINTER EVENTS (`hud-press.ts`), because these
 * are the two presses made WHILE THE CRAFT IS MOVING and a moving craft is a
 * craft with a thumb already on the glass. A second finger is a non-primary
 * pointer and the browser synthesises no `click` for one: on `onClick` alone
 * neither of these buttons answers a rider who is holding the bar or the
 * lever, which is every rider who needs them. */
export function HudActions({
  onReset,
  onCamera,
  missed,
}: {
  onReset: () => void;
  onCamera: () => void;
  /** A checkpoint is behind the rider and owed (`HudSnapshot.missedDistance`).
   * The button never learns WHICH one or how far back — that is the flash over
   * the nose and the halo on the chart. Here it is one bit, and all it buys is
   * the light. */
  missed: boolean;
}) {
  const resetPress = useMemo(createHudPress, []);
  const cameraPress = useMemo(createHudPress, []);
  return (
    <div class="hud-action-stack">
      <button
        type="button"
        class={`hud-mini hud-mini-icon ${missed ? "hud-mini-missed" : ""}`}
        title={STRINGS.resetTitle}
        aria-label={STRINGS.resetTitle}
        {...pressHandlers(resetPress, onReset)}
        onMouseUp={(e) => (e.currentTarget as HTMLButtonElement).blur()}
      >
        <ResetGlyph />
      </button>
      <button
        type="button"
        class="hud-mini hud-mini-icon"
        title={STRINGS.cameraTitle}
        aria-label={STRINGS.cameraTitle}
        {...pressHandlers(cameraPress, onCamera)}
        onMouseUp={(e) => (e.currentTarget as HTMLButtonElement).blur()}
      >
        <CameraGlyph />
      </button>
    </div>
  );
}
