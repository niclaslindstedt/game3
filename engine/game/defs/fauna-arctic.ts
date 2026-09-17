// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE POLAR COAST'S ANIMALS — the arctic third of the catalog (R20).
//
// They live beside `fauna.ts` for the reason `fauna-warm.ts` does: one
// subject, one owner, one lab, and a parent file that had grown past the
// §20.5 cap. `FAUNA` is still how the whole repo spells the catalog;
// `fauna.ts` concatenates these onto the cold and the warm coasts' rows,
// and nothing anywhere reads this module directly. The TYPE, the rarity
// ladder and every rule about what a row means are stated there and not
// repeated here.
//
// THE ICE EDGE, READ FROM THE FRONT OUT. Everything on this coast lives
// off the ice one way or another. Under it and along it are the fish the
// whole food web stands on — the polar cod that hides in the cracks of the
// sheet, the capelin that spawns on the gravel, the char running out of
// the crack in the ice for its few weeks at sea — and the two seals of the
// fast ice, the ringed seal at its breathing hole and the bearded seal
// hauled out on a floe; and the bear, which is the one animal in the whole
// game that is neither fish nor whale and swims like neither. Out past the
// front: the walrus, the beluga herd that is the commonest whale here by a
// long way, the harp seals in their hundreds, and the killer whales that
// have come north for all of them. And past THAT, the three sightings that
// are this coast's alone: the narwhal, the bowhead, and the sleeper shark
// — the one animal in the catalog that is never seen at the surface at
// all, a shadow the length of a hull passing under the craft.
//
// EVERY ROW HERE IS WRITTEN TO THE FREEZING POINT. Sea water freezes at
// −1.8 °C and this coast deals water down to it in three seasons of four,
// so a floor of zero on any of these rows would be an animal the coast
// never carries. The one exception is the char, which is a summer fish in
// the sea and a river fish the rest of the year.

import type { FaunaSpec } from "./fauna.ts";

export const ARCTIC_FAUNA: readonly FaunaSpec[] = [
  {
    id: "polarcod",
    name: "Polar cod",
    kind: "fish",
    // The herring of the ice: a hand-long fish in schools of thousands,
    // and the thing everything else on the coast has come to eat. Banded
    // the whole way out, for the herring's reason.
    length: 0.22,
    beam: 0.16,
    school: { min: 16, max: 34 },
    spread: 1.2,
    speed: 0.6,
    depth: { min: 0.8, max: 3 },
    water: 2.2,
    offshore: { min: 8, max: 480 },
    perKm: 3.4,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: -2, max: 6 },
  },
  {
    id: "capelin",
    name: "Capelin",
    kind: "fish",
    // Smaller and silver, and inshore: a capelin shoal comes onto the
    // gravel to spawn in its millions, which is the one time a rider sees
    // the water off a beach go dark with fish.
    length: 0.17,
    beam: 0.15,
    school: { min: 18, max: 40 },
    spread: 1.1,
    speed: 0.7,
    depth: { min: 0.5, max: 2.2 },
    water: 1.6,
    offshore: { min: 5, max: 110 },
    perKm: 2.4,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: -1.5, max: 8 },
  },
  {
    id: "char",
    name: "Arctic char",
    kind: "fish",
    // The taiga's sea trout, on a coast whose river is a crack in the
    // ice: a char goes to sea for a few weeks of the summer and works the
    // water off the mouth it came out of, and it is the one row here that
    // needs the water warmer than freezing.
    length: 0.6,
    beam: 0.18,
    school: { min: 2, max: 6 },
    spread: 2.4,
    speed: 1.4,
    depth: { min: 0.8, max: 3 },
    water: 2.5,
    offshore: { min: 10, max: 140 },
    perKm: 1.1,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: 0.5, max: 10 },
  },
  {
    id: "ringed",
    name: "Ringed seal",
    kind: "cetacean",
    // The smallest seal there is and the commonest animal on the ice: one
    // at a time, a head up at the edge of the lead for a look and gone
    // again. The bear's whole living.
    length: 1.4,
    beam: 0.3,
    school: { min: 1, max: 2 },
    spread: 2.0,
    speed: 1.4,
    depth: { min: 0.8, max: 3 },
    water: 3,
    offshore: { min: 8, max: 300 },
    perKm: 1.0,
    // Up every couple of minutes when it is moving; the short end of that,
    // because a head that shows once a run is a head nobody sees.
    breath: 25,
    bask: 0,
    // A head and a length of back, no fin: the seal's own field mark.
    awash: 1,
    breach: 0,
    temperature: { min: -2, max: 6 },
  },
  {
    id: "bearded",
    name: "Bearded seal",
    kind: "cetacean",
    // Twice the ringed seal's length and heavy with it: a broad grey back
    // rolling through the surface off the front, where it feeds on the
    // bottom in shallow water. Alone, always.
    length: 2.4,
    beam: 0.34,
    school: { min: 1, max: 1 },
    spread: 0,
    speed: 1.3,
    depth: { min: 1, max: 3.5 },
    water: 4,
    offshore: { min: 15, max: 260 },
    perKm: 0.5,
    breath: 30,
    bask: 0,
    awash: 1,
    breach: 0,
    temperature: { min: -2, max: 6 },
  },
  {
    id: "polarbear",
    name: "Polar bear",
    // Filed with the cetaceans for the seal's reason: it breathes, and it
    // does not beat a fish's tail. What it beats is its front paws, and
    // the swim model's slow shallow wave over a body this stiff is as
    // near to a dog-paddle as a spindle gets.
    kind: "cetacean",
    length: 2.4,
    beam: 0.38,
    school: { min: 1, max: 2 },
    spread: 1.8,
    // A bear swims at a walking pace and swims for hours; it is the one
    // animal here a hull can idle alongside.
    speed: 1.5,
    depth: { min: 0.3, max: 1 },
    water: 2,
    // The lead and the ice edge: a swimming bear is between one floe and
    // the next, never out over the deep.
    offshore: { min: 6, max: 220 },
    perKm: 0.3,
    // THE HEAD IS ALWAYS UP. A bear swims with its head and the top of its
    // back out of the water the whole way, so its "breath" is nearly
    // continuous and its rise is shallow: about half a radius down puts
    // the head and the shoulders clear and the rest of the animal awash,
    // which is exactly what a swimming bear looks like from a boat.
    breath: 9,
    bask: 0,
    awash: 0.55,
    breach: 0,
    temperature: { min: -2, max: 8 },
  },
  {
    id: "harp",
    name: "Harp seal",
    kind: "cetacean",
    // The seal of the pack rather than of the fast ice, and it comes in
    // HERDS: a dozen heads up together off the front, and gone together.
    length: 1.8,
    beam: 0.3,
    school: { min: 5, max: 14 },
    spread: 2.0,
    speed: 1.8,
    depth: { min: 1, max: 3.5 },
    water: 5,
    offshore: { min: 60, max: 520 },
    perKm: 0.6,
    breath: 28,
    bask: 0,
    awash: 1,
    breach: 0,
    temperature: { min: -2, max: 5 },
  },
  {
    id: "walrus",
    name: "Walrus",
    kind: "cetacean",
    // A tonne and a half of it, and the broadest back in the water: a
    // walrus is nearly half as wide as it is long, and from above it is a
    // brown barrel with the tusks ahead of it. Hauled out in dozens on a
    // floe; a few in the water together, over the shellfish grounds
    // inside the hundred-metre line.
    length: 3.2,
    beam: 0.42,
    school: { min: 2, max: 5 },
    spread: 1.6,
    speed: 1.6,
    depth: { min: 1, max: 3 },
    water: 4,
    offshore: { min: 20, max: 320 },
    perKm: 0.3,
    breath: 40,
    bask: 0,
    awash: 1,
    breach: 0,
    temperature: { min: -2, max: 6 },
  },
  {
    id: "beluga",
    name: "Beluga",
    kind: "cetacean",
    // THE WHITE WHALE, and the commonest whale on the coast: a herd of
    // them working along the front, white backs rolling through grey
    // water, which is the one sighting here that reads at any range in
    // any light. No dorsal at all — a ridge instead — so from above it is
    // a white seal five metres long.
    length: 4.4,
    beam: 0.26,
    school: { min: 3, max: 9 },
    spread: 2.0,
    speed: 2.2,
    depth: { min: 1.5, max: 4 },
    water: 6,
    offshore: { min: 30, max: 460 },
    perKm: 0.45,
    // Four or five quick breaths after a dive: the short end.
    breath: 18,
    bask: 0,
    awash: 0.9,
    breach: 0,
    temperature: { min: -2, max: 8 },
  },
  {
    id: "narwhal",
    name: "Narwhal",
    kind: "cetacean",
    // The tusked one, and the reason to ride out past the front: a pod of
    // three or four holding over the deep water off the ice, mottled grey
    // over a pale belly, the bulls' tusks out ahead of them. Rare, and it
    // never comes inshore.
    length: 4.6,
    beam: 0.24,
    school: { min: 2, max: 6 },
    spread: 2.0,
    speed: 2.0,
    depth: { min: 2, max: 5 },
    water: 14,
    offshore: { min: 220, max: 800 },
    perKm: 0.16,
    breath: 24,
    bask: 0,
    awash: 0.9,
    breach: 0,
    temperature: { min: -2, max: 5 },
  },
  {
    id: "sleeper",
    name: "Sleeper shark",
    kind: "shark",
    // THE ONE ANIMAL THAT NEVER COMES UP. A sleeper shark is the length of
    // a hull, brown-grey, and moves at a third of a metre a second with a
    // tail beat you can count; it holds deep the year round and comes up
    // toward the surface only in the cold of the winter. No basking, no
    // breach, no fin cutting the water: a shadow passing under the craft
    // in clear water, and nothing else. Rare, and banded far out.
    length: 4.0,
    beam: 0.2,
    school: { min: 1, max: 1 },
    spread: 0,
    speed: 0.35,
    depth: { min: 3, max: 6 },
    water: 12,
    offshore: { min: 200, max: 760 },
    perKm: 0.12,
    breath: 0,
    bask: 0,
    awash: 0,
    breach: 0,
    temperature: { min: -2, max: 4 },
  },
  {
    id: "bowhead",
    name: "Bowhead whale",
    kind: "cetacean",
    // THE POLAR COAST'S GREAT WHALE, and the rarest thing on it: fifty
    // tonnes of black whale with no fin on its back at all, a third of it
    // head, that lives its whole life at the ice edge and nowhere else.
    // It surfaces flat and blows twice a minute at rest, and it is banded
    // as far out as a level goes.
    length: 15.0,
    beam: 0.28,
    school: { min: 1, max: 2 },
    spread: 1.2,
    speed: 1.4,
    depth: { min: 3, max: 7 },
    water: 22,
    offshore: { min: 340, max: 800 },
    perKm: 0.08,
    breath: 30,
    bask: 0,
    awash: 0.85,
    // Rarely — a bowhead breaches, and a rider who is there for it has
    // seen the biggest thing this coast can throw out of the water.
    breach: 110,
    temperature: { min: -2, max: 5 },
  },
];
