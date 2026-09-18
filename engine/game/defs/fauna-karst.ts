// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE KARST COAST'S ANIMALS — the fourth quarter of the catalog (R20).
//
// They live beside `fauna.ts` for the reason `fauna-warm.ts` and
// `fauna-arctic.ts` do: one subject, one owner, one lab, and a parent file
// past the §20.5 cap. `FAUNA` is still how the whole repo spells the
// catalog; `fauna.ts` concatenates these onto the other three coasts'
// rows, and nothing anywhere reads this module directly. The TYPE, the
// rarity ladder and every rule about what a row means are stated there.
//
// A CLEAR, SALT, WARM-TEMPERATE SEA, READ FROM THE ROCK OUT. Nothing on
// this coast is brackish and nothing is cold: the water is the clearest in
// the game, the bottom is limestone and seagrass, and the fish of the shore
// are the ones that live over that — the sardine shoals everything else
// has come in for, the bream and the bass along the pebbles, the garfish
// skittering along the surface and the dentex lying off the reef. Out past
// the islets, over the deep: the amberjack, the striped dolphin schools
// that never stop leaping, the bluefin busting a bait ball, the sunfish
// lying flat on the surface like a dropped tray, the swordfish with its
// fin and its tail out on a calm afternoon, and the blue shark. And the two
// sightings this coast alone can give — the monk seal, the rarest thing in
// any of the four seas, a few hundred left in the whole world and one of
// them in a cave under the cliff; and the fin whale, the second-biggest
// animal there is, which comes into this enclosed sea to feed every summer
// and is met by riding as far out as a level goes.
//
// EVERY ROW HERE IS WRITTEN TO A WARM SEA: the coast deals water from
// 14 °C in its winter to 27 °C in high summer, and nothing here needs it
// colder. The rows a warm coast shares with this one — the loggerhead and
// the bottlenose — are `fauna-warm.ts`'s own.

import type { FaunaSpec } from "./fauna.ts";

export const KARST_FAUNA: readonly FaunaSpec[] = [
  {
    id: "sardine",
    name: "Sardine",
    kind: "fish",
    // The herring of this sea: a hand-long silver fish in shoals of
    // thousands, and the thing every predator below has come in to eat.
    // Banded the whole way out, for the herring's reason.
    length: 0.18,
    beam: 0.15,
    school: { min: 18, max: 40 },
    spread: 1.1,
    speed: 0.8,
    depth: { min: 0.8, max: 3 },
    water: 2.2,
    offshore: { min: 10, max: 480 },
    perKm: 3.6,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: 12, max: 27 },
  },
  {
    id: "seabream",
    name: "Gilthead bream",
    kind: "fish",
    // The bream of the pebble coves: deep-bodied, silver with a gold bar
    // across the brow, a few together over the sand between the rocks.
    length: 0.4,
    beam: 0.3,
    school: { min: 3, max: 8 },
    spread: 1.4,
    speed: 0.7,
    depth: { min: 0.6, max: 2.5 },
    water: 1.8,
    offshore: { min: 6, max: 110 },
    perKm: 2.0,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: 13, max: 28 },
  },
  {
    id: "seabass",
    name: "Sea bass",
    kind: "fish",
    // Hunts the surf line along the pebbles and the mouths of the rivers:
    // a long silver fish in twos and threes, right at the edge.
    length: 0.6,
    beam: 0.18,
    school: { min: 2, max: 5 },
    spread: 1.8,
    speed: 0.9,
    depth: { min: 0.6, max: 2.5 },
    water: 1.8,
    offshore: { min: 6, max: 120 },
    perKm: 1.4,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: 12, max: 26 },
  },
  {
    id: "garfish",
    name: "Garfish",
    kind: "fish",
    // A NEEDLE: the narrowest thing in the catalog from above, a green
    // sliver as long as an arm, in a loose shoal right under the surface
    // — and it LEAPS, skittering along the top of the water for metres
    // when anything comes at it, which is what a hull does. The mullet's
    // part on this coast.
    length: 0.7,
    beam: 0.06,
    school: { min: 4, max: 12 },
    spread: 2.0,
    speed: 1.6,
    depth: { min: 0.2, max: 0.8 },
    water: 1.5,
    offshore: { min: 8, max: 200 },
    perKm: 1.5,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 30,
    temperature: { min: 13, max: 26 },
  },
  {
    id: "dentex",
    name: "Dentex",
    kind: "fish",
    // The reef's predator: a big silver-pink bream lying alone off the
    // point over the drop, where the seagrass gives way to the rock.
    length: 0.8,
    beam: 0.26,
    school: { min: 1, max: 3 },
    spread: 1.6,
    speed: 1.0,
    depth: { min: 1.5, max: 4 },
    water: 5,
    offshore: { min: 30, max: 260 },
    perKm: 0.6,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: 14, max: 26 },
  },
  {
    id: "amberjack",
    name: "Greater amberjack",
    kind: "fish",
    // The first thing met by going OUT: a school of long bronze-backed
    // fish working the water past the islets, fast, over depth.
    length: 1.2,
    beam: 0.2,
    school: { min: 3, max: 8 },
    spread: 2.2,
    speed: 2.0,
    depth: { min: 1.5, max: 5 },
    water: 8,
    offshore: { min: 120, max: 600 },
    perKm: 0.6,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: 16, max: 27 },
  },
  {
    id: "striped",
    name: "Striped dolphin",
    kind: "cetacean",
    // THE DOLPHIN OF THE OPEN WATER HERE, and the most acrobatic animal in
    // the catalog: a school of a dozen over the deep, bow-riding, and one
    // of them clear of the water every half minute — the dark stripe down
    // the flank is what names it, and a leap is the one time it shows.
    length: 2.2,
    beam: 0.22,
    school: { min: 6, max: 16 },
    spread: 2.2,
    speed: 3.8,
    depth: { min: 1.5, max: 5 },
    water: 14,
    offshore: { min: 220, max: 800 },
    perKm: 0.38,
    breath: 14,
    bask: 0,
    awash: 0.85,
    breach: 30,
    temperature: { min: 14, max: 27 },
  },
  {
    id: "bluefin",
    name: "Bluefin tuna",
    kind: "fish",
    // A SCHOOL OF TUNA BUSTING BAIT is the loudest thing this sea does: a
    // dozen fish the size of a rider, steel-blue over silver, running at
    // a cruise no other fish here can match, and one of them clear of the
    // water with a sardine in it. Warm-blooded, which is why it is here in
    // every season the coast deals.
    length: 2.2,
    beam: 0.26,
    school: { min: 4, max: 12 },
    spread: 2.4,
    speed: 4.0,
    depth: { min: 2, max: 6 },
    water: 14,
    offshore: { min: 200, max: 800 },
    perKm: 0.32,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 45,
    temperature: { min: 14, max: 27 },
  },
  {
    id: "sunfish",
    name: "Ocean sunfish",
    // Filed with the sharks for the basking shark's reason: it comes up
    // without breathing — lies FLAT on its side at the surface on a calm
    // afternoon, a grey disc two metres across warming itself — and what
    // it beats is a fin either side rather than a fish's tail. A body this
    // round barely waves at all.
    kind: "shark",
    length: 2.0,
    beam: 0.55,
    school: { min: 1, max: 1 },
    spread: 0,
    speed: 0.5,
    depth: { min: 1, max: 4 },
    water: 10,
    offshore: { min: 180, max: 800 },
    perKm: 0.2,
    breath: 0,
    // Up more than down on a still day, and lying shallower than any fin:
    // half a radius puts the whole flank awash, which is the sighting.
    bask: 40,
    awash: 0.6,
    breach: 0,
    temperature: { min: 14, max: 26 },
  },
  {
    id: "swordfish",
    name: "Swordfish",
    // The sword is in profile and this game has none; what it has is the
    // BASKING RUN — a swordfish finning at the surface on a calm afternoon
    // with the sickle dorsal and the tip of the tail out, a body length
    // apart — so it is filed with the sharks, whose rows are the ones that
    // come up without a breath.
    kind: "shark",
    length: 3.0,
    beam: 0.14,
    school: { min: 1, max: 1 },
    spread: 0,
    speed: 1.6,
    depth: { min: 2, max: 6 },
    water: 15,
    offshore: { min: 260, max: 800 },
    perKm: 0.14,
    breath: 0,
    bask: 60,
    awash: 0.9,
    breach: 0,
    temperature: { min: 15, max: 27 },
  },
  {
    id: "blueshark",
    name: "Blue shark",
    kind: "shark",
    // Slender, indigo over white, the longest pectorals of any shark for
    // its size, and it cruises at the surface with the dorsal and the tail
    // tip out — alone, far out, and rare.
    length: 2.6,
    beam: 0.14,
    school: { min: 1, max: 2 },
    spread: 1.6,
    speed: 1.2,
    depth: { min: 2, max: 5 },
    water: 14,
    offshore: { min: 240, max: 800 },
    perKm: 0.12,
    breath: 0,
    bask: 45,
    awash: 0.9,
    breach: 0,
    temperature: { min: 14, max: 25 },
  },
  {
    id: "monkseal",
    name: "Monk seal",
    kind: "cetacean",
    // THE RAREST ANIMAL IN THE GAME: a big brown seal that lives in the
    // sea caves at the foot of the cliffs and is seen a handful of times a
    // year along a whole coast. Inshore, alone, a head up off the rock for
    // a look and gone — the grey seal's field mark on the one coast a
    // rider would never expect a seal at all. Legendary on purpose: a
    // sighting is a story.
    length: 2.4,
    beam: 0.3,
    school: { min: 1, max: 1 },
    spread: 0,
    speed: 1.5,
    depth: { min: 0.8, max: 3 },
    water: 3.5,
    offshore: { min: 8, max: 160 },
    perKm: 0.08,
    breath: 20,
    bask: 0,
    awash: 1,
    breach: 0,
    temperature: { min: 13, max: 27 },
  },
  {
    id: "finwhale",
    name: "Fin whale",
    kind: "cetacean",
    // THE SECOND-BIGGEST ANIMAL THERE IS, and this coast's great whale: a
    // slender grey rorqual twenty metres long that comes into this
    // enclosed sea every summer to feed over the deep, and blows a tall
    // column you see before you see the back. It surfaces flat, needs more
    // water under it than anything else in the catalog, never breaches,
    // and is banded as far out as a level goes.
    length: 20.0,
    beam: 0.14,
    school: { min: 1, max: 2 },
    spread: 1.2,
    speed: 3.0,
    depth: { min: 3, max: 8 },
    water: 24,
    offshore: { min: 380, max: 800 },
    perKm: 0.07,
    breath: 32,
    bask: 0,
    awash: 0.85,
    breach: 0,
    temperature: { min: 13, max: 26 },
  },
];
