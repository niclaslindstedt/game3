// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW EACH CRAFT IS PAINTED. One builder (craft-body.ts) makes every hull
// from its spec's own dimensions; what separates the four on the water is
// the spec, and what separates them at a glance is this table. Colours as
// hex, chosen to read against a teal sea and a grey shore: a hull is mostly
// pale so the wave's shadow shows on it, and the deck carries the colour.

import type { CraftId } from "@engine";

export type CraftStyle = {
  /** The bottom, keel to chine. */
  hull: number;
  /** The topsides, chine to gunwale. */
  topside: number;
  /** The deck and the hood. */
  deck: number;
  seat: number;
  /** The rear tray's rubber and the intake grate. */
  tray: number;
  /** The bars and the column. */
  bar: number;
  grip: number;
};

export const CRAFT_STYLES: Record<CraftId, CraftStyle> = {
  // A white runabout with a teal deck: the game's own colours.
  skiff: {
    hull: 0xf2f4f5,
    topside: 0xe8ebec,
    deck: 0x1f8a9c,
    seat: 0x1d2a33,
    tray: 0x2b3238,
    bar: 0xb8bec4,
    grip: 0x15191c,
  },
  // Black over red: the fast one looks it.
  marlin: {
    hull: 0xe6e6e6,
    topside: 0x1c1f24,
    deck: 0xc8352b,
    seat: 0x141618,
    tray: 0x25292d,
    bar: 0xc4c8cc,
    grip: 0x121415,
  },
  // Cream and navy, a touring hull's colours.
  otter: {
    hull: 0xf0ead8,
    topside: 0xe9e2cc,
    deck: 0x233f6e,
    seat: 0x3a2f28,
    tray: 0x30343a,
    bar: 0xb5babf,
    grip: 0x1a1c1e,
  },
  // Yellow on white: the stand-up, meant to be seen from the beach.
  dart: {
    hull: 0xf5f6f6,
    topside: 0xf0f1f1,
    deck: 0xf0c22e,
    seat: 0x22262a,
    tray: 0x2a2e33,
    bar: 0xbfc4c8,
    grip: 0x141618,
  },
};
