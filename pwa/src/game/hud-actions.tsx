// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TWO PRESSES MADE WHILE THE CRAFT IS MOVING: the way back to the last
// gate, and the next camera. They share a row in the top-right cluster,
// directly over the minimap, because that is the corner a rider already
// glances at — and they are MARKS rather than words, because the top strip
// is the one part of this screen that has to stay out of the way of the
// water.
//
// Both are drawn on every device rather than on touch alone. The keys (R and
// C) are the fast way for anybody who has learned them; the buttons are what
// makes those two doors visible to everybody who has not — and the reset in
// particular is reached for with the hull upside down on a reef, which is
// the worst possible moment to be remembering a binding.
//
// They live here rather than in hud.tsx because a glyph is geometry and
// hud.tsx is a layout: the two buttons are the same shape at the same weight,
// and a rider who has learned one has learned the other.

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

/** The row itself. A button that keeps the focus keeps the next Enter, and
 * the next Enter is the restart — so both let go of it on mouse-up. */
export function HudActions({ onReset, onCamera }: { onReset: () => void; onCamera: () => void }) {
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
    </div>
  );
}
