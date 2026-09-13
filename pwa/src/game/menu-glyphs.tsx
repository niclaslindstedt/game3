// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MENU'S GLYPHS — one small drawing per idea the cards keep repeating.
//
// A row that has to carry a sentence saying what it opens is a card
// explaining itself, and a card of explanations fills a phone with nothing
// that survives the second visit. A mark says the same thing in a corner of
// the space, in every language, so the words left on screen can be the ones
// that are actually specific.
//
// They are DRAWN rather than lettered, for the reason the app's own wave is:
// an emoji is a different picture in every shell and an icon font is a
// download that can fail, while this game ships no asset files at all.
// Everything here is one 24x24 box stroked in `currentColor`, so a mark is
// whatever colour the control it sits in is, at a weight that survives being
// read at a dozen pixels.
//
// The vocabulary is the sibling rally game's, retyped in ours: the shutter,
// the mixing desk, the prompt, the flag and the stopwatch mean the same
// thing in both. The RAMP AND ITS ARC is ours alone — a rally game has no
// mark for a shore with its course taken off it.
//
// A mark is judged SIDE BY SIDE and SMALL, never in the card it ends up on:
// `make glyphs` draws the whole set at the three sizes they are read at.

import type { JSX } from "preact";

/** Every mark the menus can ask for, in the order the contact sheet walks
 * them (`make glyphs`). One list, so a mark added here is a mark the sheet
 * shows without being told twice. */
export const GLYPH_NAMES = ["flag", "air", "stopwatch", "camera", "sliders", "terminal"] as const;

export type GlyphName = (typeof GLYPH_NAMES)[number];

/** The 24x24 body of each mark. Stroke geometry only — the wrapper below
 * sets the paint, so a glyph inherits the colour of whatever it sits in. */
const GLYPHS: Record<GlyphName, JSX.Element> = {
  // THE CHEQUERED FLAG: the race, and the only one of the three ways onto
  // the water where somebody else is on it. Two hulls seen from above were
  // the first draft and read as a pair of pills at the size a tile is
  // actually looked at; a flag is the one mark every player already knows.
  flag: (
    <>
      <path d="M5 3.5v17.5" />
      <path d="M5 4.5h14v9H5z" />
      <path
        d="M5 4.5h3.5v4.5H5zM12 4.5h3.5v4.5H12zM8.5 9H12v4.5H8.5zM15.5 9H19v4.5h-3.5z"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
  // A RAMP AND THE ARC OFF IT: the tricks run, which is this shore with the
  // course taken off it and the ramps left standing. A looped arrow was the
  // first draft, and every browser in the world has already taught that mark
  // to mean RELOAD.
  //
  // The wedge and the arc MEET — the arc leaves the lip, which is the one
  // thing that makes the pair read as a jump rather than as a triangle and a
  // squiggle — and the head is at the far end, coming DOWN, because a mark
  // whose arrow points back up its own arc reads as the hull being winched.
  air: (
    <>
      <path d="M2.4 19.8 9.4 13.4v6.4Z" fill="currentColor" stroke="none" />
      <path d="M9.4 13.4c3-9.4 9-8.6 11.2-1.4" />
      <path d="M21.3 14.4 18.4 12.2l4.2-1.1Z" fill="currentColor" stroke="none" />
    </>
  ),
  // A STOPWATCH: the time trial, where the clock is the whole opponent.
  stopwatch: (
    <>
      <circle cx="12" cy="14" r="7.2" />
      <path d="M12 10.5V14l2.6 2" />
      <path d="M9.6 3h4.8M12 3v2.4" />
    </>
  ),
  // The shutter: the pictures a rider took, and the press that takes one.
  camera: (
    <>
      <rect x="2.6" y="7.4" width="18.8" height="12.4" rx="2.4" />
      <path d="M8.4 7.4 9.9 5h4.2l1.5 2.4" />
      <circle cx="12" cy="13.6" r="3.6" />
    </>
  ),
  // Three faders: the settings, as a mixing desk rather than as a list.
  sliders: (
    <>
      <path d="M3 6.5h4M13 6.5h8" />
      <circle cx="10" cy="6.5" r="2.4" />
      <path d="M3 12h9M18 12h3" />
      <circle cx="15" cy="12" r="2.4" />
      <path d="M3 17.5h2M11 17.5h10" />
      <circle cx="8" cy="17.5" r="2.4" />
    </>
  ),
  // A prompt: the developer page, and the one mark on the front door that
  // is deliberately not about riding.
  terminal: (
    <>
      <rect x="2.8" y="4.5" width="18.4" height="15" rx="2.4" />
      <path d="M7 9.5l3 2.5-3 2.5M12.5 14.5H17" />
    </>
  ),
};

/** One mark, sized by whatever it sits in (`1em` of the current font size
 * unless the caller's CSS says otherwise). Always decorative: every glyph in
 * this menu stands beside a word that names the same thing. */
export function Glyph({ name, className }: { name: GlyphName; className?: string }) {
  return (
    <svg
      class={`menu-glyph ${className ?? ""}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      {GLYPHS[name]}
    </svg>
  );
}
