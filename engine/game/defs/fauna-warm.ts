// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WARM COAST'S ANIMALS — the mangrove half of the catalog (R20).
//
// They live beside `fauna.ts` for the reason `defs/sea.ts` lives beside
// `tuning.ts`: one subject, one owner, one lab, and a parent file that had
// grown past the §20.5 cap. `FAUNA` is still how the whole repo spells the
// catalog; `fauna.ts` concatenates these onto the cold coast's rows, and
// nothing anywhere reads this module directly. The TYPE, the rarity ladder
// and every rule about what a row means are stated there and not repeated
// here.
//
// A WARM SHALLOW SHELF, READ FROM THE SHORE OUT. Along the mangrove edge
// and over the flats are the inshore fish — the mullet, the snook, the red
// drum, the ray on the sand — and the two air-breathers that are not
// whales at all, the turtle over the grass and the manatee in the
// shallows. The channels and the passes past them carry the bottlenose and
// the bull shark. And past THAT, over the outer shelf where the water
// finally has depth under it, is the reason to ride out: the spotted
// dolphins working a bait ball in schools of a dozen, the tiger shark, the
// manta throwing itself clear, the whale shark lying at the surface with
// its back out, and the rorqual that is this coast's great whale.

import type { FaunaSpec } from "./fauna.ts";

export const WARM_FAUNA: readonly FaunaSpec[] = [
  {
    id: "mullet",
    name: "Striped mullet",
    kind: "fish",
    length: 0.4,
    beam: 0.18,
    school: { min: 12, max: 30 },
    spread: 1.2,
    speed: 0.7,
    depth: { min: 0.5, max: 2 },
    water: 1.5,
    offshore: { min: 6, max: 140 },
    perKm: 3.2,
    breath: 0,
    bask: 0,
    awash: 0,
    // THE MULLET JUMPS. Nobody knows why, and every warm coast is full of
    // them doing it: a silver fish clearing the water and landing flat on
    // its side. With a school of twenty the surface off a beach is never
    // still.
    breach: 28,
    temperature: { min: 15, max: 33 },
  },
  {
    id: "snook",
    name: "Snook",
    kind: "fish",
    length: 0.75,
    beam: 0.18,
    school: { min: 2, max: 5 },
    spread: 1.8,
    speed: 0.9,
    depth: { min: 0.6, max: 2 },
    water: 1.6,
    // The mangrove edge itself: a snook lies in the shade of the roots.
    offshore: { min: 5, max: 70 },
    perKm: 1.8,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: 18, max: 33 },
  },
  {
    id: "redfish",
    name: "Red drum",
    kind: "fish",
    length: 0.8,
    beam: 0.22,
    school: { min: 3, max: 8 },
    spread: 1.6,
    speed: 0.8,
    depth: { min: 0.5, max: 1.8 },
    water: 1.4,
    offshore: { min: 5, max: 90 },
    perKm: 1.6,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: 16, max: 32 },
  },
  {
    id: "stingray",
    name: "Southern stingray",
    kind: "fish",
    // A disc: the beam is most of the length, which is what the body
    // builder needs to make a ray out of the same loft as a fish.
    length: 1.1,
    beam: 0.85,
    school: { min: 1, max: 3 },
    spread: 1.5,
    speed: 0.4,
    depth: { min: 0.4, max: 1.5 },
    water: 1.2,
    offshore: { min: 4, max: 60 },
    perKm: 1.1,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: 18, max: 33 },
  },
  {
    id: "barracuda",
    name: "Great barracuda",
    kind: "fish",
    // A pike's trick on a warm coast: a long silver bar hanging still in
    // the water over the edge of a channel, and gone when you look again.
    length: 1.4,
    beam: 0.12,
    school: { min: 1, max: 4 },
    spread: 2.4,
    speed: 1.1,
    depth: { min: 1, max: 3 },
    water: 3,
    offshore: { min: 30, max: 260 },
    perKm: 0.85,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: 20, max: 32 },
  },
  {
    id: "tarpon",
    name: "Tarpon",
    kind: "fish",
    length: 1.8,
    beam: 0.16,
    school: { min: 3, max: 8 },
    spread: 2.2,
    speed: 1.4,
    depth: { min: 1, max: 3.5 },
    water: 3.5,
    offshore: { min: 20, max: 360 },
    perKm: 0.8,
    // A FISH THAT BREATHES AIR — a tarpon gulps it, and the roll it makes
    // doing so, the silver back and the tall dorsal turning over at the
    // surface, is how a rider ever sees a fish two metres long.
    breath: 30,
    bask: 0,
    awash: 0.9,
    breach: 0,
    temperature: { min: 22, max: 32 },
  },
  {
    id: "manatee",
    name: "Manatee",
    kind: "cetacean",
    length: 3.0,
    beam: 0.33,
    school: { min: 1, max: 3 },
    spread: 1.6,
    speed: 0.9,
    depth: { min: 0.8, max: 2.2 },
    water: 3,
    // Inshore, over the seagrass, and it STAYS inshore however far out the
    // rest of this roster goes: the one big animal that is met in the
    // shallows rather than past them, which is exactly why the boats on
    // its coast have a speed limit.
    offshore: { min: 8, max: 90 },
    perKm: 0.4,
    breath: 40,
    bask: 0,
    // A broad grey back breaking the surface, and the nostrils; no fin.
    awash: 1,
    breach: 0,
    temperature: { min: 20, max: 32 },
  },
  {
    id: "turtle",
    name: "Loggerhead turtle",
    // Filed with the cetaceans: it breathes, and it has no tail to beat.
    kind: "cetacean",
    length: 1.0,
    beam: 0.75,
    school: { min: 1, max: 1 },
    spread: 0,
    speed: 0.5,
    depth: { min: 0.8, max: 2.5 },
    water: 2.5,
    offshore: { min: 20, max: 450 },
    perKm: 0.5,
    // Up every few minutes when it is on the move; the short end of that.
    breath: 45,
    bask: 0,
    // The head and the top of the shell out — the whole sighting.
    awash: 1,
    breach: 0,
    temperature: { min: 20, max: 32 },
  },
  {
    id: "greenturtle",
    name: "Green turtle",
    kind: "cetacean",
    // Bigger than the loggerhead and further out: the loggerhead works the
    // flats, the green turtle crosses open water between them.
    length: 1.25,
    beam: 0.78,
    school: { min: 1, max: 2 },
    spread: 1.4,
    speed: 0.6,
    depth: { min: 1, max: 3 },
    water: 4,
    offshore: { min: 90, max: 620 },
    perKm: 0.5,
    breath: 50,
    bask: 0,
    awash: 1,
    breach: 0,
    temperature: { min: 21, max: 32 },
  },
  {
    id: "dolphin",
    name: "Bottlenose dolphin",
    kind: "cetacean",
    length: 2.8,
    beam: 0.22,
    school: { min: 3, max: 8 },
    spread: 2.0,
    speed: 3.2,
    depth: { min: 1.5, max: 4.5 },
    water: 6,
    // The channels and the passes: inshore of the spotted dolphin, which
    // is the same animal's job done out on the shelf.
    offshore: { min: 25, max: 420 },
    // The one animal in the catalog whose rarity is set by what it DOES
    // rather than by how often it is there: the bull's breach is the
    // coast's signature moment, and a moment a rider meets on one seed in
    // fourteen is a moment nobody has seen.
    perKm: 0.9,
    breath: 16,
    bask: 0,
    // The fin on a rise; the whole animal only on the bull's breach.
    awash: 0.85,
    breach: 55,
    temperature: { min: 15, max: 32 },
  },
  {
    id: "spotted",
    name: "Spotted dolphin",
    kind: "cetacean",
    // THE OUTER SHELF'S OWN, and the best argument for riding out there:
    // a school of fifteen working a bait ball, which is a dozen fins up at
    // once and a bull clear of the water every half minute.
    length: 2.2,
    beam: 0.21,
    school: { min: 6, max: 18 },
    spread: 2.2,
    speed: 3.6,
    depth: { min: 1.5, max: 5 },
    water: 14,
    offshore: { min: 240, max: 800 },
    perKm: 0.6,
    breath: 14,
    bask: 0,
    awash: 0.85,
    breach: 36,
    temperature: { min: 20, max: 32 },
  },
  {
    id: "shark",
    name: "Bull shark",
    kind: "shark",
    length: 2.5,
    beam: 0.24,
    school: { min: 1, max: 2 },
    spread: 1.5,
    speed: 1.6,
    depth: { min: 1.5, max: 4 },
    water: 5,
    offshore: { min: 25, max: 380 },
    perKm: 0.34,
    breath: 0,
    // A shark breathes water, but it cruises the passes with its fin out,
    // and the fin cutting along the surface is the entire sighting.
    bask: 40,
    // Back awash, fin and the tip of the tail out — the whole sighting.
    awash: 0.95,
    breach: 0,
    temperature: { min: 18, max: 32 },
  },
  {
    id: "tiger",
    name: "Tiger shark",
    kind: "shark",
    // Heavier than the bull shark and further out, with the blunt square
    // head and the barred back that are the only two things on it a rider
    // looking down at it from a saddle can read.
    length: 3.8,
    beam: 0.23,
    school: { min: 1, max: 1 },
    spread: 0,
    speed: 1.5,
    depth: { min: 2, max: 5 },
    water: 11,
    offshore: { min: 190, max: 720 },
    perKm: 0.24,
    breath: 0,
    bask: 45,
    awash: 0.95,
    breach: 0,
    temperature: { min: 20, max: 32 },
  },
  {
    id: "hammerhead",
    name: "Great hammerhead",
    kind: "shark",
    // The head is in profile and this game has no profile; what it has is
    // the FIN, and a great hammerhead's is the tallest sickle in the sea.
    length: 4.2,
    beam: 0.17,
    school: { min: 1, max: 1 },
    spread: 0,
    speed: 1.8,
    depth: { min: 2.5, max: 6 },
    water: 13,
    offshore: { min: 240, max: 800 },
    perKm: 0.13,
    breath: 0,
    bask: 45,
    awash: 0.95,
    breach: 0,
    temperature: { min: 20, max: 32 },
  },
  {
    id: "manta",
    name: "Giant manta",
    kind: "fish",
    // A WING RATHER THAN A BODY: the beam is nearly twice the length, which
    // is the ray's trick taken to its limit, and from above it is the one
    // unmistakable silhouette on this coast.
    length: 2.4,
    beam: 1.9,
    school: { min: 1, max: 4 },
    spread: 1.8,
    speed: 1.4,
    depth: { min: 1.5, max: 5 },
    water: 12,
    offshore: { min: 180, max: 700 },
    perKm: 0.34,
    breath: 0,
    bask: 0,
    awash: 0,
    // AND IT LEAVES THE WATER. A manta throws itself clear and lands flat
    // with a crack you hear a kilometre off; like the mullet it needs no
    // breath to do it and nobody knows why it does.
    breach: 70,
    temperature: { min: 21, max: 31 },
  },
  {
    id: "whaleshark",
    name: "Whale shark",
    kind: "shark",
    // The biggest fish there is, and it lies at the surface to feed — so
    // the rarest thing on the shelf is also the easiest to see once it is
    // there: a spotted back the length of a bus, barely moving.
    length: 9.0,
    beam: 0.2,
    school: { min: 1, max: 2 },
    spread: 1.1,
    speed: 1.1,
    depth: { min: 1.5, max: 4 },
    water: 17,
    offshore: { min: 280, max: 800 },
    perKm: 0.13,
    breath: 0,
    bask: 20,
    awash: 0.9,
    breach: 0,
    temperature: { min: 23, max: 31 },
  },
  {
    id: "brydes",
    name: "Bryde's whale",
    kind: "cetacean",
    // THE WARM COAST'S GREAT WHALE — the one rorqual that never leaves the
    // tropics, so it is the honest answer to "is there a whale out here"
    // on a coast the humpbacks only pass.
    length: 12.5,
    beam: 0.2,
    school: { min: 1, max: 2 },
    spread: 0.9,
    speed: 2.6,
    depth: { min: 3, max: 7 },
    water: 21,
    offshore: { min: 340, max: 800 },
    perKm: 0.07,
    breath: 32,
    bask: 0,
    // A long back rolling through, low, and the small fin a long way down
    // it — a rorqual surfaces flat.
    awash: 0.85,
    breach: 0,
    temperature: { min: 22, max: 31 },
  },
];
