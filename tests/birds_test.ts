// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEA BIRDS, DOM-FREE — the roster (`pwa/src/game/bird-defs.ts`), the
// placer that lays it over a level and the pose model that flies it
// (`bird-plan.ts`), from three sides: that the rows agree with themselves,
// that every flock a level carries is somewhere its bird belongs and near
// enough to the course to be met, and that where a bird is at a moment is
// the pure function of the plan and the clock the whole design rests on.
//
// None of it is visible in a screenshot: a bird in a run is a dozen pixels
// a hundred metres up, and a raft that quietly stopped lifting off, an
// eagle perched in the sea, or a skein pointed the wrong way for the season
// all come back looking exactly like a sky. The placer and the model are
// deliberately three-free so this file can run them; what it cannot judge
// is whether any of it LOOKS right, which is `make birds` and `make
// screenshots SCENE=birds`.
import { describe, expect, it } from "vitest";
import { SOUTH, TAU, sampleField, type Level } from "@engine";

import { BIRDS, BIRD_IDS, birdById, isBirdId } from "../pwa/src/game/bird-defs.ts";
import {
  CROSSING_LEAD,
  CROSSING_PAST,
  FLUSH_SECONDS,
  activityAt,
  birdPose,
  crossingAt,
  crossingBearing,
  crossingPose,
  crossingSeconds,
  forEachCrossing,
  formationOffset,
  freshBirdPose,
  planBirds,
  type BirdPlan,
  type Flock,
} from "../pwa/src/game/bird-plan.ts";
import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

/** The seeds this file flies. Fewer than the corpus, because a plan plants
 * the shore's tall trees to find the eagle a perch. */
const SEEDS = LEVEL_SEEDS.slice(0, 5);

const plans = new Map<number, BirdPlan>();
function planFor(seed: number): BirdPlan {
  let hit = plans.get(seed);
  if (hit === undefined) {
    hit = planBirds(levelFor(seed));
    plans.set(seed, hit);
  }
  return hit;
}

/** A level whose season is one of `seasons`, or a copy of the first one
 * re-dated to the first of them: the plan reads the season and nothing
 * about a coast is a season's. */
function levelIn(seasons: readonly Level["season"][]): Level {
  for (const seed of LEVEL_SEEDS) {
    const level = levelFor(seed);
    if (seasons.includes(level.season)) return level;
  }
  return { ...levelFor(LEVEL_SEEDS[0]), season: seasons[0] };
}

function unit(bearing: number): { x: number; z: number } {
  return { x: Math.sin(bearing), z: Math.cos(bearing) };
}

describe("the roster", () => {
  it("has one row per id and no id without a row", () => {
    expect(BIRDS.map((b) => b.id)).toEqual([...BIRD_IDS]);
    expect(new Set(BIRD_IDS).size).toBe(BIRDS.length);
    for (const id of BIRD_IDS) expect(birdById(id).id).toBe(id);
    expect(isBirdId("gull")).toBe(true);
    expect(isBirdId("albatross")).toBe(false);
  });

  it("states every band the right way round, and every number positive", () => {
    for (const spec of BIRDS) {
      for (const [name, band] of [
        ["flock", spec.flock],
        ["altitude", spec.altitude],
        ["beat", spec.beat],
        ["cycle", spec.cycle],
      ] as const) {
        expect(band.min, `${spec.id}.${name}`).toBeLessThanOrEqual(band.max);
        expect(band.min, `${spec.id}.${name}`).toBeGreaterThan(0);
      }
      expect(spec.span, spec.id).toBeGreaterThan(0);
      expect(spec.length, spec.id).toBeGreaterThan(0);
      expect(spec.speed, spec.id).toBeGreaterThan(0);
      expect(spec.beatHz, spec.id).toBeGreaterThan(0);
      expect(spec.neck, spec.id).toBeGreaterThan(0);
      expect(spec.neck, spec.id).toBeLessThan(1);
      expect(spec.wing.wrist, spec.id).toBeGreaterThan(0);
      expect(spec.wing.wrist, spec.id).toBeLessThan(1);
      expect(spec.glide, spec.id).toBeGreaterThanOrEqual(0);
      expect(spec.glide, spec.id).toBeLessThanOrEqual(1);
      expect(spec.airShare, spec.id).toBeLessThanOrEqual(1);
      expect(spec.flock.min, spec.id).toBeGreaterThanOrEqual(1);
    }
  });

  it("gives every resident a home and a density, and every crosser a passage", () => {
    for (const spec of BIRDS) {
      const resident = spec.seasons.length > 0;
      expect(spec.home !== undefined, spec.id).toBe(resident);
      expect(spec.perKm > 0, spec.id).toBe(resident);
      expect(spec.passage !== undefined, spec.id).toBe(spec.passes.length > 0);
      if (spec.passage) {
        expect(spec.passage.birds.min).toBeGreaterThanOrEqual(2);
        expect(spec.passage.share).toBeGreaterThan(0);
        expect(spec.passage.height.min).toBeGreaterThan(spec.altitude.max * 0.5);
      }
    }
    // The crane is the one bird that only ever goes over.
    expect(birdById("crane").home).toBeUndefined();
    expect(birdById("crane").passes.length).toBeGreaterThan(0);
  });

  it("puts the raft on the water, the eagle in a tree and the gull on the rocks", () => {
    expect(birdById("eider").home).toBe("water");
    expect(birdById("eagle").home).toBe("tree");
    expect(birdById("eagle").flock.max).toBe(1);
    expect(birdById("gull").home).toBe("skerry");
    // The tern is the one bird that fishes from the air, and the cormorant
    // the one that dries its wings.
    expect(BIRDS.filter((b) => b.dive > 0).map((b) => b.id)).toEqual(["tern"]);
    expect(BIRDS.filter((b) => b.dries).map((b) => b.id)).toEqual(["cormorant"]);
  });

  it("flies the big birds slow and the small ones fast", () => {
    expect(birdById("tern").beatHz).toBeGreaterThan(birdById("swan").beatHz);
    expect(birdById("eider").beatHz).toBeGreaterThan(birdById("eagle").beatHz);
    // A soaring bird glides most of the way; a duck never does.
    expect(birdById("eagle").glide).toBeGreaterThan(0.7);
    expect(birdById("eider").glide).toBe(0);
  });
});

describe("the flocks a level carries", () => {
  it("puts every flock where its bird belongs, and near the course", () => {
    for (const seed of SEEDS) {
      const level = levelFor(seed);
      for (const flock of planFor(seed).flocks) {
        const spec = birdById(flock.species);
        const tag = `seed ${seed} ${flock.id} (${flock.species})`;
        expect(spec.seasons, tag).toContain(level.season);
        expect(spec.home, tag).toBe(flock.home.kind);
        expect(flock.count, tag).toBeGreaterThanOrEqual(1);
        expect(flock.count, tag).toBeLessThanOrEqual(spec.flock.max);
        const b = level.bounds;
        expect(flock.home.x).toBeGreaterThan(b.minX);
        expect(flock.home.x).toBeLessThan(b.maxX);
        expect(flock.home.z).toBeGreaterThan(b.minZ);
        expect(flock.home.z).toBeLessThan(b.maxZ);
        switch (flock.home.kind) {
          case "water":
            // A raft floats on the sea, over water deep enough to float on.
            expect(flock.home.y, tag).toBe(0);
            expect(sampleField(level.ground, flock.home.x, flock.home.z), tag).toBeLessThan(-1);
            break;
          case "skerry": {
            // On a rock the level actually has, at that rock's own top.
            const rock = level.solids.find(
              (s) => Math.hypot(s.x - flock.home.x, s.z - flock.home.z) < 0.01,
            );
            expect(rock, tag).toBeDefined();
            expect(flock.home.y, tag).toBe(rock?.top);
            expect(flock.home.y, tag).toBeGreaterThan(0);
            break;
          }
          case "tree":
            // In a crown, over dry ground.
            expect(flock.home.y, tag).toBeGreaterThan(
              sampleField(level.ground, flock.home.x, flock.home.z) + 8,
            );
            expect(sampleField(level.ground, flock.home.x, flock.home.z), tag).toBeGreaterThan(0);
            break;
          case "shore":
            expect(sampleField(level.ground, flock.home.x, flock.home.z), tag).toBeGreaterThan(0);
            expect(level.materialAt(flock.home.x, flock.home.z), tag).not.toBe("water");
            break;
        }
        let near = Infinity;
        for (const p of level.course.path) {
          near = Math.min(near, Math.hypot(p.x - flock.home.x, p.z - flock.home.z));
        }
        expect(near, tag).toBeLessThan(320);
        expect(flock.loop.altitude, tag).toBeGreaterThanOrEqual(spec.altitude.min);
        expect(flock.loop.altitude, tag).toBeLessThanOrEqual(spec.altitude.max);
        expect(flock.loop.period, tag).toBeGreaterThan(0);
      }
    }
  });

  it("has gulls on every coast, and birds in the air on most", () => {
    let flocks = 0;
    for (const seed of SEEDS) {
      const plan = planFor(seed);
      expect(
        plan.flocks.some((f) => f.species === "gull"),
        `seed ${seed}`,
      ).toBe(true);
      flocks += plan.flocks.length;
    }
    expect(flocks / SEEDS.length).toBeGreaterThan(3);
  });

  it("plans the same birds twice for the same seed", () => {
    const seed = SEEDS[0];
    const a = planBirds(levelFor(seed));
    const b = planBirds(levelFor(seed));
    expect(b).toEqual(a);
  });

  it("names every flock once", () => {
    for (const seed of SEEDS) {
      const ids = planFor(seed).flocks.map((f) => f.id);
      expect(new Set(ids).size, `seed ${seed}`).toBe(ids.length);
    }
  });
});

describe("the shape a flock holds", () => {
  it("puts the leader out front and everybody else behind it", () => {
    for (const shape of ["vee", "line", "loose"] as const) {
      expect(formationOffset(shape, 0)).toEqual({ across: 0, along: 0 });
      for (let i = 1; i < 15; i++) {
        expect(formationOffset(shape, i).along, `${shape} ${i}`).toBeLessThan(0);
      }
    }
  });

  it("never stands two birds in the same place", () => {
    for (const shape of ["vee", "line", "loose"] as const) {
      const seen: { across: number; along: number }[] = [];
      for (let i = 0; i < 15; i++) {
        const slot = formationOffset(shape, i);
        for (const other of seen) {
          expect(
            Math.hypot(slot.across - other.across, slot.along - other.along),
            `${shape} ${i}`,
          ).toBeGreaterThan(0.5);
        }
        seen.push(slot);
      }
    }
  });

  it("makes a vee symmetric and a line one-sided", () => {
    for (let rank = 1; rank * 2 < 15; rank++) {
      const right = formationOffset("vee", rank * 2 - 1);
      const left = formationOffset("vee", rank * 2);
      expect(right.across).toBeCloseTo(-left.across, 6);
      expect(right.along).toBeCloseTo(left.along, 6);
      expect(right.across).toBeGreaterThan(0);
    }
    for (let i = 1; i < 15; i++) {
      expect(formationOffset("line", i).across).toBeGreaterThan(
        formationOffset("line", i - 1).across,
      );
    }
  });
});

describe("where a bird is", () => {
  /** A flock of the species from the corpus, or the corpus's first flock
   * re-cast as it. */
  const flockOf = (id: Flock["species"]): Flock => {
    for (const seed of SEEDS) {
      const hit = planFor(seed).flocks.find((f) => f.species === id);
      if (hit) return hit;
    }
    const spec = birdById(id);
    const template = planFor(SEEDS[0]).flocks[0];
    return { ...template, species: id, count: spec.flock.min, airShare: spec.airShare };
  };

  /** How far through its flight a flock is at `t`, read off its leader. */
  const airborne = (flock: Flock, t: number, activity = 1, flushedAt = -Infinity): number =>
    birdPose(flock, 0, t, freshBirdPose(), activity, 0, flushedAt).airborne;

  it("is a pure function of the flock and the clock", () => {
    const flock = flockOf("gull");
    const a = birdPose(flock, 1, 37.5, freshBirdPose());
    const b = birdPose(flock, 1, 37.5, freshBirdPose());
    expect(b).toEqual(a);
  });

  it("rests at home with its wings folded, facing the wind, and flies its loop with them open", () => {
    const flock = flockOf("gull");
    const spec = birdById("gull");
    const pose = freshBirdPose();
    let rested = false;
    let flown = false;
    for (let t = 0; t < flock.cycle; t += flock.cycle / 400) {
      birdPose(flock, 0, t, pose);
      if (pose.airborne === 0) {
        rested = true;
        // On its rock: within the roost of the home, stood a little over it.
        expect(Math.hypot(pose.x - flock.home.x, pose.z - flock.home.z)).toBeLessThanOrEqual(
          flock.roost + 1e-9,
        );
        expect(pose.y).toBeGreaterThan(flock.home.y);
        expect(pose.y).toBeLessThan(flock.home.y + spec.length);
        expect(pose.fold).toBe(1);
        // Into the wind, give or take.
        const d = Math.abs(((pose.heading - flock.facing + Math.PI * 3) % TAU) - Math.PI);
        expect(d).toBeLessThan(0.5);
      } else if (pose.airborne === 1) {
        flown = true;
        // On its beat: near the loop's altitude, off the roost, wings open.
        expect(Math.abs(pose.y - flock.loop.altitude)).toBeLessThan(spec.span * 3 + 7);
        expect(pose.fold).toBe(0);
      }
    }
    expect(rested).toBe(true);
    expect(flown).toBe(true);
  });

  it("takes off and lands over seconds rather than at a bell", () => {
    const flock = flockOf("gull");
    const dt = 0.05;
    let previous = birdPose(flock, 0, 0, freshBirdPose()).y;
    let previousAir = airborne(flock, 0);
    let jump = 0;
    let airJump = 0;
    for (let t = dt; t < flock.cycle * 1.5; t += dt) {
      const pose = birdPose(flock, 0, t, freshBirdPose());
      jump = Math.max(jump, Math.abs(pose.y - previous));
      airJump = Math.max(airJump, Math.abs(pose.airborne - previousAir));
      previous = pose.y;
      previousAir = pose.airborne;
    }
    // Nothing moves more in a twentieth of a second than a bird can fly.
    expect(jump).toBeLessThan(birdById("gull").speed * dt * 2.5);
    expect(airJump).toBeLessThan(0.1);
  });

  it("flies where it is pointing", () => {
    const flock = flockOf("gull");
    // A moment it is properly on its loop.
    let at = 0;
    for (let t = 0; t < flock.cycle; t += 0.5) {
      if (airborne(flock, t) === 1) {
        at = t;
        break;
      }
    }
    const a = birdPose(flock, 0, at, freshBirdPose());
    const b = birdPose(flock, 0, at + 0.1, freshBirdPose());
    const moved = Math.atan2(b.x - a.x, b.z - a.z);
    const diff = Math.abs(((moved - a.heading + Math.PI * 3) % TAU) - Math.PI);
    expect(diff).toBeLessThan(0.3);
  });

  it("goes to roost at night and gets up with the sun", () => {
    const flock = flockOf("gull");
    // With no day at all nothing flies, whatever the cycle says.
    for (let t = 0; t < flock.cycle; t += flock.cycle / 60) {
      expect(airborne(flock, t, 0)).toBe(0);
    }
    // And the activity is the sun's: a level at an hour the sun is up
    // reads 1, and the same level with its clock run into the night 0.
    const level = levelIn(["autumn", "winter"]);
    const noon = { ...level, hour: 12 };
    const midnight = { ...level, hour: 0 };
    expect(activityAt(noon, 0)).toBe(1);
    expect(activityAt(midnight, 0)).toBe(0);
  });

  it("puts a raft up when the craft comes, and settles it again", () => {
    const flock = flockOf("eider");
    // A moment the raft is sitting on the water.
    let at = 0;
    for (let t = 0; t < flock.cycle; t += 0.5) {
      if (airborne(flock, t) === 0 && airborne(flock, t + FLUSH_SECONDS + 5) === 0) {
        at = t;
        break;
      }
    }
    expect(airborne(flock, at + 4)).toBe(0);
    // Flushed at `at`: up within a few seconds, and back down by the end.
    expect(airborne(flock, at + 4, 1, at)).toBeGreaterThan(0.9);
    const up = birdPose(flock, 0, at + 6, freshBirdPose(), 1, 0, at);
    expect(up.y).toBeGreaterThan(3);
    expect(up.fold).toBeLessThan(0.1);
    expect(airborne(flock, at + FLUSH_SECONDS + 1, 1, at)).toBe(0);
    // A bird already flying is not put up twice.
    let flying = 0;
    for (let t = 0; t < flock.cycle; t += 0.5) {
      if (airborne(flock, t) === 1) {
        flying = t;
        break;
      }
    }
    const a = birdPose(flock, 0, flying, freshBirdPose());
    const b = birdPose(flock, 0, flying, freshBirdPose(), 1, 0, flying - 3);
    expect(b).toEqual(a);
  });

  it("rides a raft on the sea it was handed", () => {
    const flock = flockOf("eider");
    let at = 0;
    for (let t = 0; t < flock.cycle; t += 0.5) {
      if (airborne(flock, t) === 0) {
        at = t;
        break;
      }
    }
    const flat = birdPose(flock, 2, at, freshBirdPose(), 1, 0);
    const crest = birdPose(flock, 2, at, freshBirdPose(), 1, 1.4);
    expect(crest.y - flat.y).toBeCloseTo(1.4, 9);
    expect(crest.x).toBe(flat.x);
    // …and a bird on a ROCK does not.
    const gull = flockOf("gull");
    let sat = 0;
    for (let t = 0; t < gull.cycle; t += 0.5) {
      if (airborne(gull, t) === 0) {
        sat = t;
        break;
      }
    }
    expect(birdPose(gull, 0, sat, freshBirdPose(), 1, 1.4).y).toBe(
      birdPose(gull, 0, sat, freshBirdPose(), 1, 0).y,
    );
  });

  it("plunges a tern to the water with its wings closed, and nobody else", () => {
    const tern = flockOf("tern");
    const spec = birdById("tern");
    const pose = freshBirdPose();
    let lowest = Infinity;
    let closed = 0;
    let onLoop = 0;
    for (let t = 0; t < tern.cycle * 2; t += 0.05) {
      birdPose(tern, 0, t, pose);
      if (pose.airborne < 1) continue;
      onLoop++;
      lowest = Math.min(lowest, pose.y);
      closed = Math.max(closed, pose.fold);
    }
    expect(onLoop).toBeGreaterThan(0);
    expect(lowest).toBeLessThan(2);
    expect(closed).toBeGreaterThan(0.9);
    // A gull on its beat never folds.
    const gull = flockOf("gull");
    for (let t = 0; t < gull.cycle; t += 0.1) {
      birdPose(gull, 0, t, pose);
      if (pose.airborne === 1) {
        expect(pose.fold).toBe(0);
        expect(pose.y).toBeGreaterThan(spec.altitude.min);
      }
    }
  });

  it("dries a cormorant's wings on its rock and keeps a gull's folded", () => {
    const cormorant = flockOf("cormorant");
    const pose = freshBirdPose();
    let spread = 0;
    for (let t = 0; t < 120; t += 0.5) {
      birdPose(cormorant, 0, t, pose, 0);
      spread = Math.max(spread, pose.flap);
      expect(pose.airborne).toBe(0);
    }
    expect(spread).toBeGreaterThan(0.4);
    const gull = flockOf("gull");
    for (let t = 0; t < 120; t += 0.5) {
      birdPose(gull, 0, t, pose, 0);
      expect(pose.fold).toBe(1);
    }
  });

  it("beats a small wing faster than a big one", () => {
    const tern = flockOf("tern");
    const swan = flockOf("swan");
    // Counted on a flock properly in the air — a whole cycle flown, read
    // from twenty seconds in, well past the take-off ramp — as the number
    // of times the shoulder crosses level in two seconds.
    const flying = (flock: Flock): Flock => ({ ...flock, phase: 0, airShare: 1 });
    const crossings = (flock: Flock): number => {
      let n = 0;
      let was = birdPose(flock, 0, 20, freshBirdPose(), 1).flap;
      for (let t = 20.01; t < 22; t += 0.01) {
        const now = birdPose(flock, 0, t, freshBirdPose(), 1).flap;
        if (was > 0 !== now > 0) n++;
        was = now;
      }
      return n;
    };
    expect(crossings(flying(tern))).toBeGreaterThan(crossings(flying(swan)));
    expect(crossings(flying(tern))).toBeGreaterThan(0);
  });
});

describe("what crosses the sky", () => {
  it("crosses in spring and autumn, and not in summer or winter", () => {
    for (const season of ["spring", "autumn"] as const) {
      const plan = planBirds({ ...levelFor(SEEDS[0]), season });
      expect(plan.crossers.length, season).toBeGreaterThan(0);
      expect(Number.isFinite(plan.interval), season).toBe(true);
      expect(crossingAt(plan, 3), season).not.toBeNull();
    }
    for (const season of ["summer", "winter"] as const) {
      const plan = planBirds({ ...levelFor(SEEDS[0]), season });
      expect(plan.crossers, season).toEqual([]);
      expect(crossingAt(plan, 3), season).toBeNull();
      let n = 0;
      forEachCrossing(plan, 60, () => n++);
      expect(n, season).toBe(0);
    }
  });

  it("sends them north in spring and south in autumn", () => {
    const spring = planBirds({ ...levelFor(SEEDS[0]), season: "spring" });
    const autumn = planBirds({ ...levelFor(SEEDS[0]), season: "autumn" });
    const north = unit(SOUTH + Math.PI);
    const south = unit(SOUTH);
    for (let k = -5; k < 40; k++) {
      const s = crossingAt(spring, k);
      const a = crossingAt(autumn, k);
      expect(s).not.toBeNull();
      expect(a).not.toBeNull();
      const us = unit(crossingBearing({ season: "spring" }, s as NonNullable<typeof s>));
      const ua = unit(crossingBearing({ season: "autumn" }, a as NonNullable<typeof a>));
      expect(us.x * north.x + us.z * north.z).toBeGreaterThan(0.95);
      expect(ua.x * south.x + ua.z * south.z).toBeGreaterThan(0.95);
    }
  });

  it("flies every crossing bird over a spread of indices, high and in shape", () => {
    const plan = planBirds({ ...levelFor(SEEDS[0]), season: "autumn" });
    const seen = new Set<string>();
    for (let k = 0; k < 200; k++) {
      const c = crossingAt(plan, k);
      expect(c).not.toBeNull();
      if (!c) continue;
      const spec = birdById(c.species);
      seen.add(c.species);
      expect(spec.passage).toBeDefined();
      expect(spec.passage?.shapes).toContain(c.shape);
      expect(c.count).toBeGreaterThanOrEqual(spec.passage?.birds.min ?? 0);
      expect(c.count).toBeLessThanOrEqual(spec.passage?.birds.max ?? 0);
      expect(c.height).toBeGreaterThanOrEqual(spec.passage?.height.min ?? 0);
      expect(c.height).toBeLessThanOrEqual(spec.passage?.height.max ?? 0);
      expect(c.at).toBeGreaterThanOrEqual(k * plan.interval);
      expect(c.at).toBeLessThan((k + 1) * plan.interval);
    }
    expect([...seen].sort()).toEqual(["crane", "goose", "swan"]);
  });

  it("has a skein in the sky on the first frame, and never more than a few", () => {
    const plan = planBirds({ ...levelFor(SEEDS[0]), season: "spring" });
    let most = 0;
    let empty = 0;
    for (let t = 0; t < 600; t += 1) {
      let n = 0;
      forEachCrossing(plan, t, () => n++);
      most = Math.max(most, n);
      if (n === 0) empty++;
    }
    expect(most).toBeLessThanOrEqual(5);
    // The sky is rarely empty in passage season.
    expect(empty).toBeLessThan(60);
    let first = 0;
    forEachCrossing(plan, 0, () => first++);
    expect(first).toBeGreaterThan(0);
  });

  it("flies a crossing straight over its point, in from a long way off, and out the other side", () => {
    const level = { ...levelFor(SEEDS[0]), season: "autumn" as const };
    const plan = planBirds(level);
    const c = crossingAt(plan, 4);
    expect(c).not.toBeNull();
    if (!c) return;
    const pose = freshBirdPose();
    crossingPose(level, c, 0, c.at, pose);
    const startOff = Math.hypot(pose.x - c.x, pose.z - c.z);
    expect(startOff).toBeCloseTo(CROSSING_LEAD, 0);
    crossingPose(level, c, 0, c.at + CROSSING_LEAD / c.speed, pose);
    expect(Math.hypot(pose.x - c.x, pose.z - c.z)).toBeLessThan(1);
    crossingPose(level, c, 0, c.at + crossingSeconds(c), pose);
    expect(Math.hypot(pose.x - c.x, pose.z - c.z)).toBeCloseTo(CROSSING_PAST, 0);
    // Every bird in it holds the bearing, stays high, and keeps its wings.
    for (let i = 0; i < c.count; i++) {
      crossingPose(level, c, i, c.at + 30, pose);
      expect(pose.heading).toBe(crossingBearing(level, c));
      expect(pose.y).toBeGreaterThan(c.height - 10);
      expect(pose.fold).toBe(0);
      expect(pose.airborne).toBe(1);
    }
  });
});
