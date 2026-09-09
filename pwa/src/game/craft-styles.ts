// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW EACH CRAFT IS PAINTED AND PROPORTIONED. One builder (craft-body.ts)
// makes every hull from its spec's own dimensions; what separates the four
// on the water is the spec, and what separates them at a glance is this
// table: the paint, and the handful of proportions the catalog row does
// not carry — the bow's overhang, how high the hood swells, how long and
// how tall the saddle is, how tall the bars stand, how far the sponsons
// reach. Colours as hex, chosen to read against a teal sea and a grey
// shore: a hull is mostly pale so the wave's shadow shows on it, the deck
// carries the colour, and the rubber (the rail, the mats, the grips) is
// near-black so the coloured shapes have an edge.
//
// Pure data, no three.js: Node tooling loads this file.

import type { CraftId } from "@engine";

export type CraftShape = {
  /** How far the deck's bow overhangs the keel's tip, as a share of the
   * length — the raked stem that says "PWC" from the side. */
  bowRake: number;
  /** The hood's peak over the coaming, as a share of the hull depth.
   * With the column it sets where the bars stand: a runabout is about
   * 1.15 m tall keel to bar-top (a Sea-Doo GTI is 1.14, a Yamaha VX
   * 1.15), a touring hull up to 1.25. */
  hood: number;
  /** The saddle: its length as a share of the hull length, its height
   * over the pedestal as a share of the hull depth. A stand-up carries a
   * short pad instead of a saddle. */
  seatLength: number;
  seatHeight: number;
  /** The steering column from the hood's pod to the bars, m. A stand-up's
   * pole is twice a runabout's column. */
  column: number;
  /** How far the aft sponsons stand out from the chine, m. */
  sponson: number;
};

export type CraftStyle = {
  /** The bottom, keel to chine. */
  hull: number;
  /** The topsides, chine to the rail. */
  topside: number;
  /** The rubber rail at the gunwale, the sponsons, the pump housing. */
  rail: number;
  /** The deck: the coaming, the pedestal, the hood, the foredeck. */
  deck: number;
  /** The saddle's sides, and the lighter insert on top of it. */
  seat: number;
  seatTop: number;
  /** The footwell mats, the boarding platform and the intake grate. */
  tray: number;
  /** The bars, the column, the grab handle and the mirror stalks. */
  bar: number;
  grip: number;
  shape: CraftShape;
};

/** The runabout proportions the three sit-downs share. */
const RUNABOUT: CraftShape = {
  bowRake: 0.07,
  hood: 0.26,
  seatLength: 0.5,
  seatHeight: 0.36,
  column: 0.18,
  sponson: 0.05,
};

export const CRAFT_STYLES: Record<CraftId, CraftStyle> = {
  // A white runabout with a teal deck: the game's own colours.
  skiff: {
    hull: 0xf2f4f5,
    topside: 0xdfe4e6,
    rail: 0x2a2f34,
    deck: 0x1f8a9c,
    seat: 0x1d2a33,
    seatTop: 0x5a8291,
    tray: 0x3e4a52,
    bar: 0xb8bec4,
    grip: 0x15191c,
    shape: RUNABOUT,
  },
  // Black over red, long and low: the fast one looks it.
  marlin: {
    hull: 0xe6e6e6,
    topside: 0x1c1f24,
    rail: 0x101214,
    deck: 0xc8352b,
    seat: 0x141618,
    seatTop: 0xb8302a,
    tray: 0x363c42,
    bar: 0xc4c8cc,
    grip: 0x121415,
    shape: { ...RUNABOUT, hood: 0.22, seatLength: 0.54, seatHeight: 0.3, column: 0.16 },
  },
  // Cream and navy, a touring hull's colours, and a touring hull's tall
  // saddle and high hood.
  otter: {
    hull: 0xf0ead8,
    topside: 0xd9d1b8,
    rail: 0x2b2f33,
    deck: 0x233f6e,
    seat: 0x3a2f28,
    seatTop: 0x9a8471,
    tray: 0x444a50,
    bar: 0xb5babf,
    grip: 0x1a1c1e,
    shape: { ...RUNABOUT, hood: 0.3, seatLength: 0.56, seatHeight: 0.42, column: 0.22 },
  },
  // Yellow on white, meant to be seen from the beach: the stand-up, with a
  // tray where the saddle would be and the bars on a pole.
  dart: {
    hull: 0xf5f6f6,
    topside: 0xe2e5e6,
    rail: 0x24282c,
    deck: 0xf0c22e,
    seat: 0x22262a,
    seatTop: 0x2e3338,
    tray: 0x40474e,
    bar: 0xbfc4c8,
    grip: 0x141618,
    shape: {
      bowRake: 0.05,
      hood: 0.3,
      seatLength: 0.1,
      seatHeight: 0.1,
      column: 0.55,
      sponson: 0.03,
    },
  },
};
