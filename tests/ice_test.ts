// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R37 — THE SEA FREEZES. A freezing coast carries an ice field laid off its
// finished course; in its winter the sea is a sheet with the icebreaker's
// channel through it, the sheet is ground to the hull, and the water in the
// channel is a fraction of the summer's sea. None of it moves the shore:
// the ice lies on the level and is read against the run's season, so a
// level asked for another season is the same level without it.
import { describe, expect, it } from "vitest";
import {
  ICE,
  bedAt,
  biomeOf,
  createGame,
  createSea,
  frozen,
  iceAt,
  iceTopAt,
  levelDigest,
  sampleField,
  seaSummary,
  step,
  type Level,
} from "@engine";

import { ARCTIC_SEEDS, LEVEL_SEEDS, arcticFor, levelFor, mangroveFor } from "./support/levels.ts";

/** The arctic corpus in its winter — the level under the run's season, the
 * way `createGame`'s `season` puts it there. */
const winter = (level: Level): Level => ({ ...level, season: "winter" });
const summer = (level: Level): Level => ({ ...level, season: "summer" });

describe("R37 — which coasts freeze, and when", () => {
  it("carries an ice field on the coast that freezes and on no other", () => {
    expect(biomeOf("arctic").freezes).toBe(true);
    expect(biomeOf("taiga").freezes).toBe(false);
    expect(biomeOf("mangrove").freezes).toBe(false);
    for (const seed of ARCTIC_SEEDS) expect(arcticFor(seed).ice).not.toBeNull();
    for (const seed of LEVEL_SEEDS.slice(0, 3)) expect(levelFor(seed).ice).toBeNull();
    expect(mangroveFor(5).ice).toBeNull();
  });

  it("is frozen in the coast's winter and in no other season", () => {
    const level = arcticFor(ARCTIC_SEEDS[0]);
    expect(ICE.season).toBe("winter");
    expect(frozen(winter(level))).toBe(true);
    for (const season of ["spring", "summer", "autumn"] as const) {
      expect(frozen({ ...level, season })).toBe(false);
    }
    // A coast with no field is never frozen, whatever its season says.
    expect(frozen(winter(levelFor(LEVEL_SEEDS[0])))).toBe(false);
  });

  it("keeps the field on the ground's own grid, and clamps it under the sheet", () => {
    for (const seed of ARCTIC_SEEDS) {
      const level = arcticFor(seed);
      const ice = level.ice!;
      expect(ice.cell).toBe(level.ground.cell);
      expect(ice.cols).toBe(level.ground.cols);
      expect(ice.rows).toBe(level.ground.rows);
      let most = -Infinity;
      let least = Infinity;
      for (const d of ice.data) {
        most = Math.max(most, d);
        least = Math.min(least, d);
      }
      expect(most).toBeCloseTo(ICE.measured, 6);
      expect(least).toBeLessThan(-ICE.channel + 1);
      // The rim of the grid is under the sheet: the pack runs on past it.
      expect(ice.data[0]).toBeCloseTo(ICE.measured, 6);
      expect(ice.data[ice.data.length - 1]).toBeCloseTo(ICE.measured, 6);
    }
  });
});

describe("R37 — the channel", () => {
  it("is cut down the whole racing line, wide enough for every gate and every deck", () => {
    for (const seed of ARCTIC_SEEDS) {
      const level = winter(arcticFor(seed));
      for (const p of level.course.path) {
        expect(iceAt(level, p.x, p.z)).toBeLessThan(-ICE.channel + level.ground.cell);
      }
      for (const g of level.course.gates) {
        // The buoys stand `width / 2` either side of the line, the ring's
        // deck `ramp.width / 2`, and both are inside the channel with the
        // brash to spare.
        const half = Math.max(g.width / 2, g.ramp ? g.ramp.width / 2 : 0);
        expect(iceAt(level, g.x, g.z) + half, g.id).toBeLessThan(-ICE.brash);
        if (g.ramp) expect(iceAt(level, g.ramp.x, g.ramp.z), g.id).toBeLessThan(-ICE.brash);
      }
      // A slalom's mark stands at its standoff, and it is in the water too.
      for (const g of level.course.gates) {
        if (g.kind !== "slalom" || g.standoff === undefined) continue;
        const mark = level.solids.find((s) => s.id === g.mark);
        if (mark) expect(iceAt(level, mark.x, mark.z) + mark.r, g.id).toBeLessThan(0);
      }
      // …and the start, in its turning basin, which is wider than the
      // channel it opens.
      expect(iceAt(level, level.start.x, level.start.z)).toBeLessThanOrEqual(-ICE.channel);
      expect(ICE.basin / 2).toBeGreaterThan(ICE.channel);
    }
  });

  it("has ice on either side of it, and the ice is most of the sea", () => {
    for (const seed of ARCTIC_SEEDS) {
      const level = winter(arcticFor(seed));
      let water = 0;
      let sheet = 0;
      const { ground, ice } = level;
      for (let i = 0; i < ground.data.length; i++) {
        if (ground.data[i] >= 0) continue;
        if (ice!.data[i] >= 0) sheet++;
        else water++;
      }
      expect(sheet).toBeGreaterThan(water * 2);
      // Twice the channel's half-width off the line, across it, is sheet.
      const [a, b] = [level.course.path[10], level.course.path[11]];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const nx = -(b.z - a.z) / len;
      const nz = (b.x - a.x) / len;
      const off = 2 * ICE.channel + ICE.brash;
      expect(iceAt(level, a.x + nx * off, a.z + nz * off)).toBeGreaterThan(0);
      expect(iceAt(level, a.x - nx * off, a.z - nz * off)).toBeGreaterThan(0);
    }
  });
});

describe("R37 — the sheet as the hull meets it", () => {
  const level = winter(arcticFor(ARCTIC_SEEDS[0]));
  /** The point of the line furthest out — where the sheet either side of
   * the channel is over the sea rather than on the beach — and the same
   * point carried out under it. */
  const path = level.course.path;
  const far = path.reduce(
    (best, p, i) =>
      sampleField(level.offshore, p.x, p.z) >
      sampleField(level.offshore, path[best].x, path[best].z)
        ? i
        : best,
    0,
  );
  const [a, b] = far + 1 < path.length ? [path[far], path[far + 1]] : [path[far - 1], path[far]];
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const nx = -(b.z - a.z) / len;
  const nz = (b.x - a.x) / len;
  // …on whichever side of the line is the SEA's: the course runs along a
  // shore, and the sheet on the land side may be standing on the beach.
  const side = sampleField(level.ground, a.x + nx * 60, a.z + nz * 60) < 0 ? 1 : -1;
  const off = side * (ICE.channel + ICE.brash + 12);
  const under = { x: a.x + nx * off, z: a.z + nz * off };

  it("stands at its freeboard over the water, and is nothing in the channel", () => {
    expect(iceTopAt(level, under.x, under.z)).toBeCloseTo(ICE.freeboard, 6);
    expect(iceTopAt(level, a.x, a.z)).toBe(-Infinity);
    expect(iceTopAt(summer(level), under.x, under.z)).toBe(-Infinity);
    // The brash: a slope from the water at the channel's edge up to the
    // freeboard, monotone, so a hull rides up it rather than hitting a step.
    let last = -Infinity;
    for (let d = -ICE.brash; d <= 0; d += 0.5) {
      const x = a.x + nx * side * (ICE.channel + ICE.brash + d);
      const z = a.z + nz * side * (ICE.channel + ICE.brash + d);
      const top = iceTopAt(level, x, z);
      expect(top).toBeGreaterThanOrEqual(last - 1e-6);
      last = top;
    }
    expect(last).toBeCloseTo(ICE.freeboard, 1);
  });

  it("is the ground under the sheet, and past the rim, and not in the summer", () => {
    expect(bedAt(level, under.x, under.z)).toBeCloseTo(ICE.freeboard, 6);
    expect(bedAt(summer(level), under.x, under.z)).toBe(
      sampleField(level.ground, under.x, under.z),
    );
    expect(bedAt(summer(level), under.x, under.z)).toBeLessThan(-1);
    // Out past the level's box the pack runs on: the storm's floor is under
    // the ice out there too. Straight out to sea from the line, so the
    // point is over the ocean and not over a corner the coast reached.
    const out = { x: a.x + nx * side * 1500, z: a.z + nz * side * 1500 };
    expect(bedAt(level, out.x, out.z)).toBeCloseTo(ICE.freeboard, 6);
    expect(bedAt(summer(level), out.x, out.z)).toBeLessThan(-10);
    // …and the channel's bed is the summer's.
    expect(bedAt(level, a.x, a.z)).toBe(bedAt(summer(level), a.x, a.z));
  });

  it("grounds a hull driven out of the channel onto it", () => {
    const state = createGame({ seed: 1, level, assist: 0 });
    // Stand the craft in the channel pointing straight at the sheet, and
    // drive.
    const heading = Math.atan2(nx * side, nz * side);
    state.craft.x = a.x;
    state.craft.z = a.z;
    state.craft.heading = heading;
    let grounded = false;
    let highest = -Infinity;
    const input = { steer: 0, throttle: 1, reverse: 0, lean: 0, crouch: 0, reset: false };
    for (let i = 0; i < 120 * 12; i++) {
      step(state, input);
      highest = Math.max(highest, state.craft.y);
      if (iceAt(level, state.craft.x, state.craft.z) > 0 && state.craft.y > ICE.freeboard * 0.5) {
        grounded = true;
        break;
      }
    }
    expect(grounded).toBe(true);
    expect(highest).toBeGreaterThan(ICE.freeboard * 0.5);
  });
});

describe("R37 — the water in the channel", () => {
  it("is a fraction of the summer's sea, and carries no swell", () => {
    const dealt = arcticFor(ARCTIC_SEEDS[1]);
    // The point of the line furthest out, where the summer's sea has fetch.
    const at = dealt.course.path.reduce((best, p) =>
      sampleField(dealt.offshore, p.x, p.z) > sampleField(dealt.offshore, best.x, best.z)
        ? p
        : best,
    );
    const open = createSea(summer(dealt), 1, { from: dealt.wind.from, speed: 12 });
    const lead = createSea(winter(dealt), 1, { from: dealt.wind.from, speed: 12 });
    const before = seaSummary(open, at.x, at.z).Hs;
    const after = seaSummary(lead, at.x, at.z).Hs;
    expect(before).toBeGreaterThan(0.15);
    expect(after).toBeLessThan(before * 0.4);
    // Under the sheet's freeboard: the ice never has a wave through it.
    expect(after).toBeLessThan(ICE.freeboard);
    expect(lead.bands.find((b) => b.kind === "swell")?.hs ?? 0).toBe(0);
    expect(open.bands.find((b) => b.kind === "swell")?.hs ?? 0).toBeGreaterThan(0);
  });
});

describe("R37 — what the ice does not move", () => {
  it("leaves the shore alone: a level re-seasoned is the same ground under the same course", () => {
    const level = arcticFor(ARCTIC_SEEDS[2]);
    expect(winter(level).ground).toBe(level.ground);
    expect(winter(level).course).toBe(level.course);
    expect(winter(level).ice).toBe(level.ice);
    // The digest names the season the level was dealt, as it always has,
    // and nothing about the sheet is in it: the field is laid off the
    // finished course and could only ever restate it.
    expect(levelDigest(level)).toBe(levelDigest({ ...level, ice: null }));
  });
});
