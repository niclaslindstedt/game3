// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEA LIFE'S PAINT — how every animal in the catalog is coloured and
// proportioned, one row per `FaunaId`. The look half of the split
// `engine/game/defs/fauna.ts` is the fact half of (the way `craft-styles.ts`
// is to `defs/craft.ts`), kept beside `fauna.ts` rather than in it because
// forty-two rows of paint put the drawing past the §20.5 cap. `fauna.ts`
// builds a body from a row here and the catalog's dimensions; nothing else
// reads this module. The design rules the rows obey — seen from ABOVE, a
// silhouette read by its dorsal, its pectorals and its tail span, and only
// the markings that show on a back — are that file's header.

import type { FaunaId } from "@engine";

/** How a species is PAINTED and PROPORTIONED — everything about an animal
 * that is a look rather than a fact. */
export type FaunaStyle = {
  /** Countershading: every animal in the sea is dark above and pale below,
   * and from a chase camera the back is the whole of what shows. */
  readonly back: number;
  readonly belly: number;
  /** The fins, when they are not the back's own colour. */
  readonly fin?: number;
  /** Body HEIGHT as a share of the length. The catalog owns the width
   * (`beam`); this is the other axis, and the two together are most of what
   * a shape is: a perch is deeper than it is wide, a porpoise rounder than
   * it is deep. */
  readonly height: number;
  /** Dorsal fin height, pectoral fin length and tail span, in body lengths
   * — the three numbers a silhouette is read by. */
  readonly dorsal: number;
  readonly pectoral: number;
  readonly tail: number;
  /** A white saddle behind the dorsal (the orca's), and white bands across
   * the flippers (the minke's): the two markings that name an animal at a
   * glance from directly above. */
  readonly saddle?: boolean;
  readonly flipperBand?: boolean;
  /** Dark bars down the back, a perch's — how many. */
  readonly bars?: number;
  /** How far the tail swings, in body lengths, and how much travelling wave
   * the body carries at once, rad. A fish is nearly all tail; a whale
   * carries a long slow wave and hardly bends at the shoulder. */
  readonly bend: number;
  readonly waves: number;
};

export const STYLES: Readonly<Record<FaunaId, FaunaStyle>> = {
  // The cold-water fish: silver, olive and green, all of them deeper than wide.
  herring: {
    back: 0x2f4a55,
    belly: 0xd9e0e4,
    height: 0.26,
    dorsal: 0.05,
    pectoral: 0.07,
    tail: 0.24,
    bend: 0.1,
    waves: 3.4,
  },
  roach: {
    back: 0x4a4634,
    belly: 0xcac3ad,
    fin: 0x9c4a3a,
    height: 0.32,
    dorsal: 0.07,
    pectoral: 0.08,
    tail: 0.26,
    bend: 0.09,
    waves: 3.2,
  },
  perch: {
    back: 0x36471f,
    belly: 0xc7b06a,
    fin: 0xa8492f,
    height: 0.36,
    dorsal: 0.11,
    pectoral: 0.09,
    tail: 0.24,
    bars: 6,
    bend: 0.08,
    waves: 3,
  },
  pike: {
    back: 0x3c4a2b,
    belly: 0xbcc0a2,
    height: 0.16,
    dorsal: 0.08,
    pectoral: 0.07,
    tail: 0.22,
    // An ambush fish holds still and moves in one flick: a long body that
    // barely waves at all until it does.
    bend: 0.05,
    waves: 2.2,
  },
  seatrout: {
    // Olive-backed and spotted rather than the salmon's clean blue-grey:
    // the pair are told apart by tone, which is all a back ever shows.
    back: 0x50553f,
    belly: 0xd2cec0,
    height: 0.22,
    dorsal: 0.07,
    pectoral: 0.09,
    tail: 0.22,
    bend: 0.09,
    waves: 3,
  },
  salmon: {
    back: 0x4a5560,
    belly: 0xd7d4cd,
    height: 0.21,
    dorsal: 0.06,
    pectoral: 0.09,
    tail: 0.22,
    bend: 0.09,
    waves: 3,
  },
  cod: {
    // Mottled olive-brown over a pale belly, and the three dorsals a cod
    // carries make one long ridge from above rather than a fin.
    back: 0x6a6244,
    belly: 0xdcd5bc,
    fin: 0x7a7050,
    height: 0.26,
    dorsal: 0.08,
    pectoral: 0.1,
    tail: 0.2,
    bend: 0.08,
    waves: 2.8,
  },
  // The cetaceans: rounder than they are deep, and every one of them shows
  // its back rather than its flank.
  seal: {
    // Dark wet grey blotched paler, a broad round back and NO DORSAL AT
    // ALL — which is the whole field mark: a fin means porpoise, a bare
    // back at the same range means seal.
    back: 0x555b58,
    belly: 0xc2c0b4,
    height: 0.34,
    dorsal: 0,
    pectoral: 0.13,
    tail: 0.16,
    bend: 0.05,
    waves: 1.8,
  },
  porpoise: {
    back: 0x2e3338,
    belly: 0xcdd1d4,
    height: 0.22,
    // The blunt little triangular fin is the whole of a porpoise sighting.
    dorsal: 0.09,
    pectoral: 0.1,
    tail: 0.24,
    bend: 0.07,
    waves: 2.4,
  },
  orca: {
    back: 0x0f1319,
    belly: 0xf3f5f3,
    height: 0.24,
    // The fin is the sighting: a bull's stands nearly two metres.
    dorsal: 0.24,
    pectoral: 0.16,
    tail: 0.24,
    saddle: true,
    bend: 0.06,
    waves: 2,
  },
  minke: {
    back: 0x323840,
    belly: 0xb7bec3,
    height: 0.18,
    dorsal: 0.05,
    pectoral: 0.12,
    tail: 0.24,
    // The white band across the flipper — the field mark that tells a minke
    // from every other rorqual, and it is on the one surface a camera
    // overhead can see.
    flipperBand: true,
    bend: 0.05,
    waves: 1.8,
  },
  whitebeak: {
    // Dark over a pale grey saddle behind the fin — the marking that names
    // it, and it is on the one surface a rider ever sees.
    back: 0x2e3640,
    belly: 0xe2e6e6,
    height: 0.21,
    dorsal: 0.15,
    pectoral: 0.13,
    tail: 0.26,
    saddle: true,
    bend: 0.08,
    waves: 2.6,
  },
  basking: {
    // Slate grey-brown, and the two things that carry the sighting are the
    // long soft dorsal and a tail span wider than anything else afloat.
    back: 0x4a4e4a,
    belly: 0xa8aca4,
    height: 0.2,
    dorsal: 0.15,
    pectoral: 0.2,
    tail: 0.3,
    bend: 0.05,
    waves: 1.8,
  },
  humpback: {
    // Near-black with a white underside, the LONGEST PECTORALS IN THE SEA
    // — a third of the animal, and pale enough to show through the water
    // before the back does — over a fin so small it is a knuckle.
    back: 0x21262b,
    belly: 0xeef0ec,
    fin: 0xdfe4e0,
    height: 0.24,
    dorsal: 0.05,
    pectoral: 0.32,
    tail: 0.3,
    bend: 0.05,
    waves: 1.6,
  },
  // ── The mangrove coast ────────────────────────────────────────────────
  // Warm-water fish: silver over olive, and the ray a flat grey disc.
  mullet: {
    back: 0x4a5a58,
    belly: 0xd8dcd6,
    height: 0.24,
    dorsal: 0.07,
    pectoral: 0.08,
    tail: 0.24,
    bend: 0.1,
    waves: 3.2,
  },
  snook: {
    back: 0x5c6650,
    belly: 0xd9d6c4,
    fin: 0x7a7a5a,
    height: 0.26,
    dorsal: 0.1,
    pectoral: 0.09,
    tail: 0.26,
    bend: 0.09,
    waves: 3,
  },
  redfish: {
    // Copper: the one fish in the catalog that is not silver or green.
    back: 0x8a5a3a,
    belly: 0xe0d2bc,
    fin: 0x9a6a48,
    height: 0.3,
    dorsal: 0.09,
    pectoral: 0.09,
    tail: 0.26,
    bend: 0.08,
    waves: 3,
  },
  tarpon: {
    // The silver king: the brightest flank in the catalog, and a tall
    // dorsal that shows on the roll.
    back: 0x3e4a58,
    belly: 0xe8ecef,
    height: 0.28,
    dorsal: 0.09,
    pectoral: 0.1,
    tail: 0.3,
    bend: 0.08,
    waves: 2.8,
  },
  barracuda: {
    // A bar of polished steel with a black-blotched flank and a forked
    // tail; the narrowest thing in the catalog from above.
    back: 0x646e70,
    belly: 0xe6eaea,
    height: 0.16,
    dorsal: 0.09,
    pectoral: 0.06,
    tail: 0.26,
    bend: 0.07,
    waves: 2.6,
  },
  stingray: {
    // A disc lying on the sand: nearly flat, no fin to speak of, a whip of
    // a tail. Its whole shape is the beam the catalog gives it.
    back: 0x5a5548,
    belly: 0xe4e0d0,
    height: 0.07,
    dorsal: 0,
    pectoral: 0.02,
    tail: 0.04,
    bend: 0.06,
    waves: 2,
  },
  // The two air-breathers that are not whales.
  turtle: {
    // A domed reddish-brown shell over a pale plastron, the front flippers
    // long enough to read as an animal's, and no tail beat at all: a turtle
    // rows, and a rigid body reads truer than a wagging one.
    back: 0x6a5a3a,
    belly: 0xd8cc9a,
    fin: 0x5a4a30,
    height: 0.38,
    dorsal: 0,
    pectoral: 0.5,
    tail: 0.05,
    bend: 0,
    waves: 0,
  },
  greenturtle: {
    // Olive over cream, and a smoother, rounder shell than the
    // loggerhead's: the two are told apart by tone and by size.
    back: 0x556044,
    belly: 0xdfd9b2,
    fin: 0x47502f,
    height: 0.36,
    dorsal: 0,
    pectoral: 0.52,
    tail: 0.05,
    bend: 0,
    waves: 0,
  },
  manatee: {
    // Grey all over, round as a log, no fin, and the paddle of a tail.
    back: 0x6a6a64,
    belly: 0x8a8a82,
    height: 0.36,
    dorsal: 0,
    pectoral: 0.14,
    tail: 0.28,
    bend: 0.04,
    waves: 1.6,
  },
  dolphin: {
    // Plain grey, darker above — a bottlenose has no saddle to show.
    back: 0x5a6470,
    belly: 0xd8dde0,
    height: 0.2,
    dorsal: 0.14,
    pectoral: 0.14,
    tail: 0.26,
    bend: 0.08,
    waves: 2.6,
  },
  spotted: {
    // Dark cape over a pale speckled flank, and a saddle behind the fin: a
    // school of them reads as a field of small dark crescents.
    back: 0x3d4650,
    belly: 0xdfe3e4,
    height: 0.2,
    dorsal: 0.15,
    pectoral: 0.13,
    tail: 0.26,
    saddle: true,
    bend: 0.08,
    waves: 2.8,
  },
  shark: {
    // Stout and pale: a bull shark is grey-brown and thicker through the
    // shoulder than any other shark its length.
    back: 0x6a7078,
    belly: 0xe0e2e0,
    height: 0.24,
    dorsal: 0.13,
    pectoral: 0.18,
    // A shark's tail is the one in the catalog that is taller than the
    // animal is wide, and it is what makes the shape read as a shark.
    tail: 0.28,
    bend: 0.07,
    waves: 2.4,
  },
  tiger: {
    // Grey-green with the dark BARS down the back that name it — the one
    // shark here with a marking, and it is on the surface that shows.
    back: 0x5e6650,
    belly: 0xdedfd4,
    height: 0.22,
    dorsal: 0.14,
    pectoral: 0.17,
    tail: 0.3,
    bars: 7,
    bend: 0.07,
    waves: 2.4,
  },
  hammerhead: {
    // The head is in profile and this game has no profile; what it has is
    // the FIN, and a great hammerhead's is the tallest sickle in the sea.
    back: 0x5a6470,
    belly: 0xe4e6e2,
    height: 0.18,
    dorsal: 0.2,
    pectoral: 0.16,
    tail: 0.3,
    bend: 0.07,
    waves: 2.4,
  },
  manta: {
    // A WING. Black above, white below, and effectively no dorsal, no
    // pectoral and no tail worth drawing: the catalog's beam does all of
    // the work here, and the shape is unmistakable because of it.
    back: 0x23262b,
    belly: 0xf0f2ef,
    height: 0.05,
    dorsal: 0,
    pectoral: 0.02,
    tail: 0.03,
    bend: 0.05,
    waves: 1.4,
  },
  whaleshark: {
    // The one animal in the sea that is SPOTTED white on blue-grey, in
    // rows — the bars are the closest the builder gets to them, and at
    // this size they read from further off than the fin does.
    back: 0x3f4a58,
    belly: 0xd6dad8,
    height: 0.22,
    dorsal: 0.12,
    pectoral: 0.2,
    tail: 0.28,
    bars: 9,
    bend: 0.05,
    waves: 1.6,
  },
  brydes: {
    // Dark grey, a small hooked fin two thirds of the way back, and the
    // flat low roll of a rorqual.
    back: 0x2b3138,
    belly: 0xc6ccc9,
    height: 0.2,
    dorsal: 0.06,
    pectoral: 0.13,
    tail: 0.26,
    bend: 0.05,
    waves: 1.7,
  },
  // ── The arctic coast ──────────────────────────────────────────────────
  // The ice edge's fish: dark-backed and silver, all of them small.
  polarcod: {
    back: 0x4a5a52,
    belly: 0xd8ddd8,
    height: 0.24,
    dorsal: 0.06,
    pectoral: 0.08,
    tail: 0.24,
    bend: 0.1,
    waves: 3.4,
  },
  capelin: {
    // Green-backed over a bright silver flank: the brightest small fish
    // in the catalog, and a shoal of them reads as a flash.
    back: 0x3f5a4e,
    belly: 0xe6ebe8,
    height: 0.2,
    dorsal: 0.05,
    pectoral: 0.07,
    tail: 0.24,
    bend: 0.1,
    waves: 3.4,
  },
  char: {
    // Olive-backed with a red belly in the spawning colours, and the pale
    // leading edges on the fins that name a char at a glance.
    back: 0x4a5a44,
    belly: 0xd8a070,
    fin: 0xc45a3a,
    height: 0.22,
    dorsal: 0.07,
    pectoral: 0.09,
    tail: 0.22,
    bend: 0.09,
    waves: 3,
  },
  // The seals: a broad round back and no fin on any of them.
  ringed: {
    // Dark grey with the pale rings across the back that name it, and a
    // small, round, short animal even for a seal.
    back: 0x4f5556,
    belly: 0xc8c6bc,
    height: 0.36,
    dorsal: 0,
    pectoral: 0.12,
    tail: 0.15,
    bend: 0.05,
    waves: 1.8,
  },
  bearded: {
    // Plain grey-brown, heavier and longer than the ringed seal, with the
    // square head far out ahead of a broad body.
    back: 0x615c52,
    belly: 0xb8b2a4,
    height: 0.36,
    dorsal: 0,
    pectoral: 0.14,
    tail: 0.15,
    bend: 0.05,
    waves: 1.8,
  },
  polarbear: {
    // CREAM, not white — a bear's coat is yellow-white against the ice
    // and reads as the palest thing in the water. The tallest body in
    // the catalog for its length, no fin, the paws for pectorals, and a
    // stiff back: a bear does not wave.
    back: 0xece3cc,
    belly: 0xf2ecdc,
    height: 0.4,
    dorsal: 0,
    pectoral: 0.16,
    tail: 0.06,
    bend: 0.03,
    waves: 1.2,
  },
  harp: {
    // Silver-grey with the dark saddle across the back — the harp that
    // names it — and the black face.
    back: 0x9a9c98,
    belly: 0xd8d8d0,
    height: 0.34,
    dorsal: 0,
    pectoral: 0.12,
    tail: 0.15,
    saddle: true,
    bend: 0.05,
    waves: 1.8,
  },
  walrus: {
    // Cinnamon brown, nearly half as wide as it is long, and the
    // broadest back on the coast: from above a walrus is a barrel.
    back: 0x8a6a52,
    belly: 0xb8a088,
    height: 0.4,
    dorsal: 0,
    pectoral: 0.16,
    tail: 0.14,
    bend: 0.04,
    waves: 1.5,
  },
  // The whales.
  beluga: {
    // WHITE ALL OVER, and the one animal in the game whose back is paler
    // than its belly would need to be: a white back through grey water is
    // the whole sighting, and no fin — a beluga carries a ridge instead.
    back: 0xf0f1ec,
    belly: 0xf4f5f0,
    height: 0.26,
    dorsal: 0,
    pectoral: 0.12,
    tail: 0.26,
    bend: 0.06,
    waves: 2,
  },
  narwhal: {
    // Mottled grey over cream, no dorsal, and a tusk this builder has no
    // way to draw — what names it from above is the mottling, so the back
    // is the pale end of grey and the belly the paler.
    back: 0x8c9298,
    belly: 0xdcdedb,
    height: 0.24,
    dorsal: 0,
    pectoral: 0.12,
    tail: 0.26,
    bend: 0.06,
    waves: 2,
  },
  sleeper: {
    // Brown-grey and blunt, a small dorsal set far back and a small tail
    // for a shark this size: the dullest animal in the catalog, on
    // purpose, because a shadow is what it is.
    back: 0x4f4a44,
    belly: 0x8a8680,
    height: 0.22,
    dorsal: 0.05,
    pectoral: 0.12,
    tail: 0.2,
    bend: 0.04,
    waves: 1.4,
  },
  bowhead: {
    // BLACK, a third of it head, NO FIN AT ALL and the broadest flukes in
    // the sea: the white chin is the one marking, and it is under the
    // animal where the camera cannot see it.
    back: 0x15171a,
    belly: 0x3a3d40,
    height: 0.3,
    dorsal: 0,
    pectoral: 0.14,
    tail: 0.34,
    bend: 0.04,
    waves: 1.4,
  },
};
