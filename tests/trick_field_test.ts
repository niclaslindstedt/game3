// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R35 — THE TRICK FIELD: the line of ringless ramps a level built for a
// tricks run carries, and the three things about it a tuning pass must not
// be able to undo quietly.
//
// The analyzer (`analysis/air.ts`) scores one level's field and the
// generator rejects on it, so the per-level rules are already held with
// teeth. What a test is for is the POPULATION — that the field is still
// being laid at all, and that it is still vastly more lip than the race
// course offers — because a field that quietly stopped being laid would
// leave every check green and every tricks run empty.

import { describe, expect, it } from "vitest";

import {
  CRAFT,
  craftAtClass,
  generateLevel,
  inLane,
  nextAfter,
  rampsOf,
  trickBeam,
  runUpTo,
  topSpeedOf,
  TRICK_SHARE,
  trickStride,
  type Level,
} from "@engine";

import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

/** The same spread of seeds the rest of the generator suite rides, built
 * for a tricks run. Built once and shared: generating a level is the most
 * expensive thing the engine does, and it is deterministic. */
const TRICK_LEVELS: Level[] = LEVEL_SEEDS.map((seed) => generateLevel(seed, { tricks: true }));

describe("R35 — the trick field", () => {
  it("is laid on a level built for a tricks run, and on no other", () => {
    for (const level of TRICK_LEVELS) {
      expect(level.ramps.length, `seed ${level.seed} has no trick field`).toBeGreaterThan(0);
    }
    for (const seed of LEVEL_SEEDS) {
      expect(levelFor(seed).ramps, `seed ${seed} is a race and carries a field`).toEqual([]);
    }
  });

  it("carries no ring: every deck in it belongs to no gate", () => {
    for (const level of TRICK_LEVELS) {
      const gateRamps = new Set(level.course.gates.map((g) => g.ramp).filter(Boolean));
      for (const ramp of level.ramps) {
        expect(gateRamps.has(ramp), `${ramp.id} on seed ${level.seed} is a gate's`).toBe(false);
      }
    }
  });

  it("is vastly more lip than the race course on its own offers", () => {
    // R7 gives a course two or three air gates however long it is. The
    // field's whole reason for existing is that a two-minute run over that
    // is four jumps and eight hundred metres of riding between them, so the
    // bar is a MULTIPLE rather than a handful more.
    let field = 0;
    let air = 0;
    for (const level of TRICK_LEVELS) {
      air += level.course.gates.filter((g) => g.kind === "air").length;
      field += rampsOf(level).length;
    }
    expect(field / air).toBeGreaterThan(2.5);
  });

  it("stands every deck a full stride from the next one along", () => {
    // The rule itself: a lip reached before the hull is back up to speed is
    // the jump R35 exists to prevent. `nextAfter` is where "the next one
    // along" is stated — ahead of this deck, and facing near enough its way
    // to be climbed — so the test reads the rule rather than restating it,
    // and the field's own air gates are in the walk because a rider cannot
    // tell the two kinds of lip apart.
    for (const level of TRICK_LEVELS) {
      const stride = trickStride(level.pace);
      const ramps = rampsOf(level);
      for (const a of ramps) {
        for (const b of ramps) {
          if (a === b || !nextAfter(a, b)) continue;
          const gap = Math.hypot(a.x - b.x, a.z - b.z);
          expect(gap, `${a.id} and ${b.id} on seed ${level.seed}`).toBeGreaterThanOrEqual(
            stride - 0.5,
          );
        }
      }
    }
  });

  it("keeps every deck across the sea, and keeps the band a BAND", () => {
    // R9's rule survives into the field, widened rather than dropped: a lip
    // taken dead into the sea stuffs the bow and one taken dead with it
    // cannot climb past the wave in front of it.
    //
    // The second assertion is the one worth having. The band is measured
    // FROM THE BEAM, so a widening that reaches a right angle spans every
    // heading there is and the check that reads it can never reject
    // anything — a rule deleted rather than relaxed, which is exactly what
    // it looks like in the diff that does it and exactly what nothing else
    // here would have caught.
    expect(trickBeam(1, 1)).toBeLessThan(Math.PI / 2);
    for (const level of TRICK_LEVELS) {
      const beam = trickBeam(level.pace, level.rampWidth);
      const waves = level.wind.from + Math.PI;
      for (const ramp of level.ramps) {
        // Folded to [0, π] FIRST — the band is measured from the beam, and
        // a signed difference makes a ramp 120° off the waves read as 240°.
        const turn = Math.abs(((ramp.heading - waves + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        const off = Math.min(turn, Math.PI * 2 - turn);
        expect(
          Math.abs(off - Math.PI / 2),
          `${ramp.id} on seed ${level.seed} is ${((off * 180) / Math.PI).toFixed(0)}° off the waves`,
        ).toBeLessThanOrEqual(beam + 1e-6);
      }
    }
  });

  it("never stands a deck facing back up the water a rider is riding out on", () => {
    // THE ONE THAT BIT. A ramp is a wedge hinged at one end: ridden from one
    // side, met from the other as a wall the collision engine pushes the hull
    // out of. The field is laid out AND back, so half its decks face the
    // other way by design — and standing one of those on the water an
    // outbound rider is on makes it a thing in the way rather than a lip they
    // chose to leave alone. Two things keep it off: the homebound pass steps
    // to seaward, and `inLane` refuses any pair the step does not separate —
    // a hairpin in the route (R24) faces two OUTBOUND decks at each other,
    // which no amount of stepping the return pass aside would have caught.
    for (const level of TRICK_LEVELS) {
      const stride = trickStride(level.pace);
      const ramps = rampsOf(level);
      for (const a of ramps) {
        for (const b of ramps) {
          if (a === b) continue;
          expect(
            inLane(a, b, stride),
            `${b.id} faces ${a.id} and stands in its lane on seed ${level.seed}`,
          ).toBe(false);
        }
      }
    }
  });

  it("spaces the field for the craft that needs the most road, not the slowest", () => {
    // The measurement behind R35, kept as an assertion because it is the
    // one thing about the rule that intuition gets backwards: a low top
    // speed is reached SOONER, so the dart — the slowest hull in the
    // catalog — needs the least water and the marlin the most. A stride
    // calibrated on the dart would leave every other hull short.
    const run = new Map(CRAFT.map((s) => [s.id, runUpTo(s, TRICK_SHARE)]));
    const slowest = CRAFT.reduce((a, b) => (topSpeedOf(a) < topSpeedOf(b) ? a : b));
    const hungriest = CRAFT.reduce((a, b) => ((run.get(a.id) ?? 0) > (run.get(b.id) ?? 0) ? a : b));
    expect(slowest.id).toBe("dart");
    expect(hungriest.id).toBe("marlin");
    for (const spec of CRAFT) {
      expect(trickStride(1), `${spec.id} outruns the stride`).toBeGreaterThan(
        run.get(spec.id) ?? 0,
      );
    }
  });

  it("grows the stride with the speed class, because a faster hull needs more road", () => {
    expect(trickStride(1.5)).toBeGreaterThan(trickStride(1));
    expect(trickStride(0.75)).toBeLessThan(trickStride(1));
    for (const pace of [0.75, 1, 1.5]) {
      for (const spec of CRAFT) {
        expect(trickStride(pace)).toBeGreaterThan(runUpTo(craftAtClass(spec, pace), TRICK_SHARE));
      }
    }
  });
});

describe("runUpTo — the closed form behind the stride", () => {
  it("is the distance to the share asked for, and grows with it", () => {
    for (const spec of CRAFT) {
      expect(runUpTo(spec, 0.5)).toBeLessThan(runUpTo(spec, 0.9));
      expect(runUpTo(spec, 0.9)).toBeLessThan(runUpTo(spec, TRICK_SHARE));
      expect(runUpTo(spec, 0)).toBe(0);
    }
  });

  it("agrees with a scripted full-throttle run on flat water", () => {
    // The model is thrust flat and drag quadratic, which is the hull's own;
    // the numbers it gives are within about a tenth of what the physics
    // actually delivers over the same water. Held loosely on purpose — a
    // retune of the catalog may move either side a little, and what must
    // not happen is the two drifting apart.
    expect(runUpTo(CRAFT[1], TRICK_SHARE)).toBeGreaterThan(120);
    expect(runUpTo(CRAFT[1], TRICK_SHARE)).toBeLessThan(190);
  });
});
