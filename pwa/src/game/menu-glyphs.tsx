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
// mark for a shore with its course taken off it — and the COMPASS is the
// mark for the one way on with no task behind it at all.
//
// A mark is judged SIDE BY SIDE and SMALL, never in the card it ends up on:
// `make glyphs` draws the whole set at the three sizes they are read at.

import type { JSX } from "preact";

/** Every mark the menus can ask for, in the order the contact sheet walks
 * them (`make glyphs`). One list, so a mark added here is a mark the sheet
 * shows without being told twice. */
export const GLYPH_NAMES = [
  "trophy",
  "flag",
  "air",
  "stopwatch",
  "compass",
  "camera",
  "sliders",
  "terminal",
  "lock",
] as const;

export type GlyphName = (typeof GLYPH_NAMES)[number];

/** The 24x24 body of each mark. Stroke geometry only — the wrapper below
 * sets the paint, so a glyph inherits the colour of whatever it sits in. */
const GLYPHS: Record<GlyphName, JSX.Element> = {
  // A CUP: the campaign, which is the one way onto the water that is
  // played FOR something — a shore's table, and the shore behind it. The
  // bowl is wide and the stem short so the silhouette survives a phone's
  // tile; two handles are what tell a cup from a bell at that size.
  trophy: (
    <>
      <path d="M7 4h10v5.5a5 5 0 0 1-10 0Z" />
      <path d="M7 6H4.2a2.8 2.8 0 0 0 2.8 3.6M17 6h2.8A2.8 2.8 0 0 1 17 9.6" />
      <path d="M12 14.5V18M8.5 20.5h7" />
    </>
  ),
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
  // A COMPASS NEEDLE: the free ride, which is the one way onto the water
  // with nothing to reach and nowhere it has to be reached by. The other
  // three marks are the TASK — a flag to cross, a lip to leave, a clock to
  // beat — so this one is deliberately not a task at all: it is the
  // instrument you carry when nobody has told you where to go.
  //
  // The needle is the rose's own two kites rather than one arrow, with the
  // pointing half filled and the tail stroked. An arrow in a circle is a
  // PLAY button at tile size, and the tile beside it already opens a game.
  compass: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M16.4 7.6 13.1 13.1 10.9 10.9Z" fill="currentColor" stroke="none" />
      <path d="M7.6 16.4 10.9 10.9 13.1 13.1Z" />
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
  // A PADLOCK: a level or a shore the campaign has not opened yet. The
  // shackle is drawn open at the top of its travel on nothing — a closed
  // box with a keyhole reads as a chest at tile size.
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8.2 10.5V7.6a3.8 3.8 0 0 1 7.6 0v2.9" />
      <path d="M12 14.6v2.6" />
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
