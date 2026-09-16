// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A LEVEL'S FINGERPRINT — one number that moves when the shore a seed
// builds moves, and does not when it does not.
//
// The campaign pins its levels to a generator version (`versions.ts`), and
// the version registry is a promise the generator cannot check on its own:
// nothing in `generateLevel` knows that seed 38 used to put its third gate
// somewhere else. So every pinned level carries the digest it was curated
// with, and the suite recompiles it and compares. The digest reads what a
// RIDER meets — every gate, every ramp, every rock, the start, the wind,
// the sea, the sky — and the ground under the line at every gate, so a
// depth table moving under an unmoved course is caught too. It reads none
// of the heightfields whole: a million samples of ground would make the
// comparison cost what building the level cost, and the gates and the
// solids stand on that ground already.
//
// FNV-1a over the values rounded to centimetres, the way the sim's
// determinism digest is built (`sim/simulate.ts`), printed as eight hex
// digits so it reads as one word in a level's row.

import type { Level } from "./types.ts";
import { sampleField } from "../lib/heightfield.ts";

/** The digest of what a level puts in a rider's way — see the header. */
export function levelDigest(level: Level): string {
  let hash = 0x811c9dc5;
  const mix = (v: number): void => {
    // Four bytes of the centimetre-rounded value, so a metre of drift in
    // any one number changes the word and not only its low byte.
    const n = Math.round(v * 100) | 0;
    for (let shift = 0; shift < 32; shift += 8) {
      hash ^= (n >>> shift) & 0xff;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  };
  const word = (s: string): void => {
    for (let i = 0; i < s.length; i++) {
      hash ^= s.charCodeAt(i) & 0xff;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  };
  word(level.biome);
  word(level.track);
  mix(level.pace);
  mix(level.rampWidth);
  mix(level.start.x);
  mix(level.start.z);
  mix(level.start.heading);
  mix(level.wind.from);
  mix(level.wind.speed);
  mix(level.seaHeading);
  mix(level.swell);
  mix(level.hour);
  word(level.season);
  word(level.weather);
  mix(level.course.length);
  mix(level.course.laps);
  mix(level.course.lapGates);
  for (const g of level.course.gates) {
    word(g.kind);
    mix(g.x);
    mix(g.y);
    mix(g.z);
    mix(g.heading);
    mix(g.width);
    mix(sampleField(level.ground, g.x, g.z));
    if (g.ramp) {
      mix(g.ramp.x);
      mix(g.ramp.z);
      mix(g.ramp.heading);
      mix(g.ramp.length);
      mix(g.ramp.angle);
    }
  }
  for (const r of level.ramps) {
    mix(r.x);
    mix(r.z);
    mix(r.heading);
    mix(r.length);
    mix(r.width);
    mix(r.angle);
  }
  for (const s of level.solids) {
    word(s.kind);
    mix(s.x);
    mix(s.z);
    mix(s.r);
    mix(s.top);
  }
  return hash.toString(16).padStart(8, "0");
}
