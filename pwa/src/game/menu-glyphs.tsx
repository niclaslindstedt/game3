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
// the mixing desk and the prompt mean the same thing in both. The buoy is
// ours alone — it is what its stage marker is, on water.
//
// A mark is judged SIDE BY SIDE and SMALL, never in the card it ends up on:
// `make glyphs` draws the whole set at the three sizes they are read at.

import type { JSX } from "preact";

/** Every mark the menus can ask for, in the order the contact sheet walks
 * them (`make glyphs`). One list, so a mark added here is a mark the sheet
 * shows without being told twice. */
export const GLYPH_NAMES = ["buoy", "camera", "sliders", "terminal"] as const;

export type GlyphName = (typeof GLYPH_NAMES)[number];

/** The 24x24 body of each mark. Stroke geometry only — the wrapper below
 * sets the paint, so a glyph inherits the colour of whatever it sits in. */
const GLYPHS: Record<GlyphName, JSX.Element> = {
  // A BUOY STANDING IN THE WATER, its lamp on top: the way ON — the course
  // the press leads to, which is a line of these.
  //
  // It is not the CRAFT, and two drafts of one died on the sheet proving
  // why: a personal watercraft in profile is a wedge with a stick on it, and
  // at the size a phone draws a tile the wedge, the wave under it and the
  // handlebars above it all run together into one horizontal smear. A buoy
  // stands UP out of the water, which is the one thing on this coast that
  // does — so the mark has a vertical against the wave's horizontal and
  // survives being fourteen pixels tall.
  buoy: (
    <>
      <path d="M9.2 18.4 10.4 9.4h3.2l1.2 9Z" />
      <circle cx="12" cy="6.6" r="2" />
      <path d="M2.6 19.2c1.9-1.8 3.8-1.8 5.7 0s3.8 1.8 5.7 0 3.8-1.8 5.7 0" />
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
