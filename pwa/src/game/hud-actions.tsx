// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE THREE PRESSES MADE WHILE THE CRAFT IS MOVING: the way back to the last
// gate, the next camera, and the shutter. They share a row in the top-right
// cluster, directly over the minimap, because that is the corner a rider
// already glances at — and they are MARKS rather than words, because the top
// strip is the one part of this screen that has to stay out of the way of the
// water.
//
// All three are drawn on every device rather than on touch alone. The keys
// (R, C and Enter) are the fast way for anybody who has learned them; the
// buttons are what makes those doors visible to everybody who has not — and
// the reset in particular is reached for with the hull upside down on a reef,
// which is the worst possible moment to be remembering a binding.
//
// THE SHUTTER IS THE ONE THAT HAS NO OTHER DOOR ON A PHONE. A touchscreen
// has no ENTER to press, so without this button the whole feature — the
// picture, the roll, the gallery on the front door — would be a thing only a
// keyboard could reach.
//
// They live here rather than in hud.tsx because a glyph is geometry and
// hud.tsx is a layout: the three buttons are the same shape at the same
// weight, and a rider who has learned one has learned the others.

import { STRINGS } from "./strings.ts";

/** The reset mark: an arrow curling back on itself, which is what this does
 * to a run. */
function ResetGlyph() {
  return (
    <svg class="hud-glyph" viewBox="0 0 100 100" aria-hidden="true">
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
    <svg class="hud-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="5" r="3.1" />
      <circle cx="15" cy="5" r="3.1" />
      <rect x="2" y="9" width="14" height="10.5" rx="2" />
      <path d="M 16.6 12.6 L 22 9.6 L 22 18.9 L 16.6 15.9 Z" />
    </svg>
  );
}

/** The shutter's mark: a stills camera, body and lens, with the finder's
 * hump on top. Deliberately NOT the movie camera above — one takes a picture
 * and the other changes where you are looking FROM, and a rider glancing at
 * this row has to tell them apart at speed, which is why one is a box with a
 * round hole in it and the other is two reels and a cone.
 *
 * ONE PATH, `evenodd`: the lens is a hole CUT OUT of the body rather than a
 * disc drawn over it. The whole glyph is filled with `currentcolor`
 * (styles.css), so a second colour would have to name a background this file
 * has no business knowing — and at eighteen pixels a hole is what reads as a
 * lens anyway, where a filled disc reads as a button. */
function ShotGlyph() {
  return (
    <svg class="hud-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill-rule="evenodd"
        d="M 9 3 L 15 3 L 16.4 5.4 L 20 5.4 A 2 2 0 0 1 22 7.4 L 22 18 A 2 2 0 0 1 20 20 L 4 20 A 2 2 0 0 1 2 18 L 2 7.4 A 2 2 0 0 1 4 5.4 L 7.6 5.4 Z M 12 8.6 A 4.2 4.2 0 1 0 12.01 8.6 Z"
      />
      {/* The pupil, standing in the hole — what stops the lens reading as a
          porthole. */}
      <circle cx="12" cy="12.8" r="1.9" />
    </svg>
  );
}

/** The row itself. A button that keeps the focus keeps the next Enter, and
 * the next Enter is the shutter — so all three let go of it on mouse-up,
 * which is what stops a press on RESET being repeated by every picture the
 * rider takes afterwards. */
export function HudActions({
  onReset,
  onCamera,
  onShot,
}: {
  onReset: () => void;
  onCamera: () => void;
  onShot: () => void;
}) {
  return (
    <div class="hud-action-stack">
      <button
        type="button"
        class="hud-mini hud-mini-icon"
        title={STRINGS.resetTitle}
        aria-label={STRINGS.resetTitle}
        onClick={onReset}
        onMouseUp={(e) => (e.currentTarget as HTMLButtonElement).blur()}
      >
        <ResetGlyph />
      </button>
      <button
        type="button"
        class="hud-mini hud-mini-icon"
        title={STRINGS.cameraTitle}
        aria-label={STRINGS.cameraTitle}
        onClick={onCamera}
        onMouseUp={(e) => (e.currentTarget as HTMLButtonElement).blur()}
      >
        <CameraGlyph />
      </button>
      <button
        type="button"
        class="hud-mini hud-mini-icon"
        title={STRINGS.shotTitle}
        aria-label={STRINGS.shotTitle}
        onClick={onShot}
        onMouseUp={(e) => (e.currentTarget as HTMLButtonElement).blur()}
      >
        <ShotGlyph />
      </button>
    </div>
  );
}
