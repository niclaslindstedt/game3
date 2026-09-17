// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REPLAY'S DIRECTOR (`pwa/src/game/replay-shots.ts`): which moments in a
// run are worth leaving the chase boom for, when the cut lands, and how fast
// the picture runs while it is on one.
//
// The premise the whole feature stands on is that a replay KNOWS THE FUTURE,
// because the run wrote it down: the shot for a flight is filed at the step
// the hull LEFT the water, decided at the step it came back, so the cut can
// land a second and a half before a lip the rider had not reached yet. The
// first case here is that back-dating, and everything after it is what the
// edit is made of.
//
// The tape itself is `tests/ghost_test.ts`'s — a replay and a ghost are one
// codec (`ghost.ts`'s `ControlTape`), so the round trip is proven once.
import { describe, expect, it } from "vitest";

import { TUNING, createGame, step, type CraftInput, type GameEvent, type GameState } from "@engine";

import {
  SHOTS,
  SLOW,
  createShotCollector,
  directAt,
  planShots,
  shotWindow,
  type ReplayShot,
} from "../pwa/src/game/replay-shots.ts";

import { snapInput } from "../pwa/src/game/ghost.ts";
import { createReplayRig } from "../pwa/src/game/replay.ts";
import { gameFor } from "../pwa/src/game/new-game.ts";
import { DEFAULT_SETTINGS, type Settings } from "../pwa/src/game/settings.ts";

import { syntheticLevel } from "./support/synthetic.ts";

const HZ = TUNING.physicsHz;

/** A state the collector will read, with the events of one step on it. The
 * collector wants a craft to read a pose off and the events it produced, and
 * nothing else — so a real `GameState` is stood up once and its event list is
 * rewritten per step rather than a run being ridden for every case. */
function stager(): { state: GameState; at: (events: GameEvent[], pose?: Partial<Pose>) => void } {
  const state = createGame({ seed: 7, craft: "skiff", level: syntheticLevel(), quiet: true });
  return {
    state,
    at: (events, pose = {}) => {
      Object.assign(state.craft, { x: 0, z: 0, y: 0, heading: 0, speed: 20 }, pose);
      state.events.length = 0;
      state.events.push(...events);
    },
  };
}

type Pose = { x: number; y: number; z: number; heading: number; speed: number };

function land(airTime: number, record = false): GameEvent {
  return {
    kind: "land",
    t: 0,
    vy: -6,
    airTime,
    length: airTime * 18,
    pitch: 0,
    speed: 20,
    record,
    lengthRecord: false,
  };
}

describe("a moment worth a camera", () => {
  it("files a flight's shot at the step it LAUNCHED, decided at the step it landed", () => {
    const rig = stager();
    const shots = createShotCollector();
    // Up at step 100, from a known place; down at step 400, having stayed up
    // long enough to be worth watching.
    rig.at([{ kind: "launch", t: 0, vy: 9, speed: 24 }], { x: 40, z: -12, heading: 1.2 });
    shots.step(rig.state, 100);
    rig.at([]);
    shots.step(rig.state, 250);
    rig.at([land(2.5)], { x: 900, z: 900 });
    shots.step(rig.state, 400);

    const plan = shots.plan();
    expect(plan).toHaveLength(1);
    // The step, the pose and the length are all the LAUNCH's — a stand
    // planted off where the hull came DOWN would be a lens the flight
    // happens behind.
    expect(plan[0].at).toBe(100);
    expect(plan[0].x).toBe(40);
    expect(plan[0].z).toBe(-12);
    expect(plan[0].heading).toBeCloseTo(1.2);
    expect(plan[0].runs).toBe(300);
    expect(plan[0].kind).toBe("air");
    // ...and the cut therefore lands before the hull ever leaves the water.
    expect(shotWindow(plan[0]).from).toBeLessThan(100);
  });

  it("caps a 'flight' that is not one, so the lens is not planted half a kilometre away", () => {
    // The fault this exists for, measured rather than argued: a hull thrown
    // clear by the tornado is off the water for ten seconds and travels most
    // of a kilometre, and it reaches the collector as one `launch` and one
    // `land` — exactly like a jump. Uncapped, the stand goes out with it (the
    // placement scales with the ground covered) and the shot is a picture of
    // some sea with a speck in it.
    const rig = stager();
    const shots = createShotCollector();
    rig.at([{ kind: "launch", t: 0, vy: 20, speed: 63 }]);
    shots.step(rig.state, 0);
    rig.at([land(10.6, true)]);
    shots.step(rig.state, 1274);
    const plan = shots.plan();
    expect(plan).toHaveLength(1);
    expect(plan[0].runs).toBe(Math.round(SHOTS.longest * HZ));
  });

  it("counts a flight's revolutions as ONE shot of it, not one shot per element", () => {
    const rig = stager();
    const shots = createShotCollector();
    rig.at([{ kind: "launch", t: 0, vy: 9, speed: 24 }]);
    shots.step(rig.state, 0);
    for (const spins of [1, 2]) {
      rig.at([{ kind: "trick", t: 0, trick: "backflip", spins, points: 100, mult: 1 + spins }]);
      shots.step(rig.state, 60 * spins);
    }
    rig.at([land(1.8)]);
    shots.step(rig.state, 200);

    const plan = shots.plan();
    expect(plan).toHaveLength(1);
    expect(plan[0].kind).toBe("trick");
    // A double is worth more than the air alone ever could be.
    expect(plan[0].weight).toBeGreaterThan(Math.min(1, 1.8 / SHOTS.airBig));
  });

  it("lets a skip off the chop go, and takes the one that was turned in", () => {
    const rig = stager();
    const shots = createShotCollector();
    // Up and straight back down with nothing turned: chop, not an event.
    rig.at([{ kind: "launch", t: 0, vy: 2, speed: 18 }]);
    shots.step(rig.state, 0);
    rig.at([land(SHOTS.airLeast * 0.5)]);
    shots.step(rig.state, 40);
    expect(shots.plan()).toHaveLength(0);

    // The same nothing of a flight, with a spin in it.
    rig.at([{ kind: "launch", t: 0, vy: 2, speed: 18 }]);
    shots.step(rig.state, 2000);
    rig.at([{ kind: "trick", t: 0, trick: "roll", spins: 1, points: 90, mult: 2 }]);
    shots.step(rig.state, 2020);
    rig.at([land(SHOTS.airLeast * 0.5)]);
    shots.step(rig.state, 2040);
    expect(shots.plan()).toHaveLength(1);
  });

  it("takes a hull met at speed and leaves a pack rafted together alone", () => {
    const rig = stager();
    const shots = createShotCollector();
    rig.at([{ kind: "bump", t: 0, rival: 3, speed: SHOTS.bumpLeast * 0.5 }]);
    shots.step(rig.state, 0);
    expect(shots.plan()).toHaveLength(0);

    rig.at([{ kind: "bump", t: 0, rival: 3, speed: SHOTS.bumpHard }]);
    shots.step(rig.state, 4000);
    const plan = shots.plan();
    expect(plan).toHaveLength(1);
    expect(plan[0].kind).toBe("bump");
    expect(plan[0].weight).toBeCloseTo(1);
  });

  it("takes it going wrong — over the bars, on its back, or taken by the tornado", () => {
    const rig = stager();
    const shots = createShotCollector();
    const gone: GameEvent[] = [
      { kind: "bail", t: 0, lost: 900 },
      { kind: "capsize", t: 0, speed: 8 },
      { kind: "tornado", t: 0, grip: 0.7, wind: 40, speed: 12 },
    ];
    gone.forEach((e, i) => {
      rig.at([e]);
      shots.step(rig.state, i * 4000);
    });
    const plan = shots.plan();
    expect(plan).toHaveLength(3);
    expect(plan.every((shot) => shot.kind === "wipeout")).toBe(true);
  });
});

describe("the running order", () => {
  const shot = (at: number, weight: number): ReplayShot => ({
    kind: "air",
    at,
    runs: 120,
    weight,
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    speed: 20,
  });

  it("keeps the BIG one out of a crowded pair, not the first one", () => {
    // A rhythm section: two flights a second apart, the second the one worth
    // watching. Kept in run order and spaced, the small one wins and the big
    // one is what the cut is resting through.
    const plan = planShots([shot(1000, 0.4), shot(1000 + HZ, 0.95)]);
    expect(plan).toHaveLength(1);
    expect(plan[0].weight).toBeCloseTo(0.95);
  });

  it("leaves the boom a stretch of water between two shots", () => {
    const apart = Math.round((SHOTS.rest + SHOTS.lead + SHOTS.hold + 2) * HZ);
    expect(planShots([shot(1000, 0.9), shot(1000 + apart, 0.9)])).toHaveLength(2);
    expect(planShots([shot(1000, 0.9), shot(1000 + HZ, 0.9)])).toHaveLength(1);
  });

  it("drops what was never worth a camera, and caps what is", () => {
    expect(planShots([shot(1000, SHOTS.least / 2)])).toHaveLength(0);
    const many = Array.from({ length: SHOTS.most * 3 }, (_, i) =>
      shot(i * Math.round((SHOTS.rest + SHOTS.lead + SHOTS.hold + 2) * HZ), 0.9),
    );
    expect(planShots(many)).toHaveLength(SHOTS.most);
  });

  it("hands the plan back in RUN order however it was ranked", () => {
    const apart = Math.round((SHOTS.rest + SHOTS.lead + SHOTS.hold + 2) * HZ);
    const plan = planShots([shot(3 * apart, 0.4), shot(apart, 0.9), shot(2 * apart, 0.6)]);
    expect(plan.map((s) => s.at)).toEqual([apart, 2 * apart, 3 * apart]);
  });
});

describe("the cut, and the picture's own speed", () => {
  const SHOT: ReplayShot = {
    kind: "air",
    at: 1000,
    runs: 240,
    weight: 0.9,
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    speed: 20,
  };
  const plan = [SHOT];

  it("is on the boom until the lead, then on the stand until the hold runs out", () => {
    const { from, until } = shotWindow(SHOT);
    expect(directAt(plan, from - 1).shot).toBeNull();
    expect(directAt(plan, from + 1).shot).toBe(SHOT);
    expect(directAt(plan, SHOT.at + SHOT.runs).shot).toBe(SHOT);
    expect(directAt(plan, until + 1).shot).toBeNull();
  });

  it("runs at full speed on the boom and slow over the thing worth watching", () => {
    expect(directAt(plan, shotWindow(SHOT).from + 1).rate).toBe(1);
    expect(directAt(plan, SHOT.at).rate).toBeCloseTo(SLOW.rate);
    expect(directAt(plan, SHOT.at + SHOT.runs).rate).toBeCloseTo(SLOW.rate);
    expect(directAt(plan, shotWindow(SHOT).until).rate).toBe(1);
  });

  it("eases in and out rather than changing gear", () => {
    // Walked step by step across both ramps, the rate only ever moves a
    // little: a jump between two frames is what reads as a dropped frame
    // rather than as slow motion.
    let last = 1;
    for (let at = shotWindow(SHOT).from; at <= shotWindow(SHOT).until; at++) {
      const { rate } = directAt(plan, at);
      expect(Math.abs(rate - last)).toBeLessThan(0.05);
      last = rate;
    }
    expect(last).toBe(1);
  });

  it("never hands back a rate that would stop the clock or run it fast", () => {
    for (let at = 0; at < 2000; at += 7) {
      const { rate } = directAt(plan, at);
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThanOrEqual(1);
    }
  });
});

describe("the moments a RIDDEN run leaves behind", () => {
  it("collects from the engine's own events without being told what to look for", () => {
    // The honest end-to-end: a craft ridden hard down the synthetic shore,
    // with the collector reading nothing but `state.events`. What comes back
    // has to be a plan the director can walk — in order, inside the run, and
    // never two shots on top of each other.
    const state = createGame({
      seed: 7,
      craft: "skiff",
      level: syntheticLevel(),
      quiet: true,
    });
    const shots = createShotCollector();
    const STEPS = 3000;
    for (let i = 0; i < STEPS; i++) {
      step(state, {
        steer: Math.sin(i / 90) * 0.5,
        throttle: 1,
        reverse: 0,
        lean: Math.sin(i / 40),
        crouch: 0,
        reset: false,
      });
      shots.step(state, i);
    }
    const plan = shots.plan();
    // Non-empty, or this case is green over a collector that found nothing:
    // the synthetic shore carries a ramp, and a craft held at full throttle
    // down it gets air off one.
    expect(plan.length).toBeGreaterThan(0);
    for (let i = 0; i < plan.length; i++) {
      expect(plan[i].at).toBeGreaterThanOrEqual(0);
      expect(plan[i].at).toBeLessThan(STEPS);
      expect(plan[i].weight).toBeGreaterThanOrEqual(SHOTS.least);
      expect(Number.isFinite(plan[i].x + plan[i].z + plan[i].heading)).toBe(true);
      if (i > 0) expect(plan[i].at).toBeGreaterThan(plan[i - 1].at);
    }
    // ...and the director answers every step of the run without throwing.
    for (let i = 0; i < STEPS; i += 13) expect(directAt(plan, i).rate).toBeGreaterThan(0);
  });
});

describe("the recording a run leaves behind", () => {
  const LEVEL = syntheticLevel();
  /** A measured run that picks its own seed rather than a pinned shore: the
   * level object is handed in on both sides, so the rebuild costs nothing and
   * the case is about the tape rather than about the generator. */
  const settings = (over: Partial<Settings["ride"]> = {}): Settings => ({
    ...DEFAULT_SETTINGS,
    ride: { ...DEFAULT_SETTINGS.ride, mode: "timeTrial", level: null, ...over },
  });
  const PARAMS = {
    hour: undefined,
    track: undefined,
    time: undefined,
    season: undefined,
    day: undefined,
    waves: undefined,
    weather: undefined,
  };
  const rigFor = (s: Settings) => createReplayRig({ params: PARAMS, settings: () => s });

  function ride(state: GameState, rig: ReturnType<typeof rigFor>, steps: number): number[][] {
    const track: number[][] = [];
    for (let i = 0; i < steps; i++) {
      // SNAPPED, because that is what the engine is handed in the app —
      // `App.tsx`'s `stepOnce` snaps every input whoever produced it, so the
      // figure the physics runs on IS the figure the tape writes down. Feed
      // the engine an axis finer than the grid and the replay is merely close,
      // which is a craft somewhere else by the second buoy.
      const driven: CraftInput = snapInput({
        steer: Math.sin(i / 47) * 0.8,
        throttle: 1,
        reverse: 0,
        lean: Math.cos(i / 29),
        crouch: 0,
        reset: false,
      });
      step(state, driven);
      rig.step(driven, state);
      track.push([state.craft.x, state.craft.y, state.craft.z, state.craft.speed]);
    }
    return track;
  }

  it("puts the recording on the same water as the run, step for step", () => {
    // The whole premise, end to end: a run ridden, cut where it stands, and
    // rebuilt — and the craft in the rebuild has to be on the very metre of
    // water the run's was, not merely near it.
    const s = settings();
    const rig = rigFor(s);
    const state = gameFor(s, PARAMS, { level: LEVEL });
    rig.arm(state, null, true);
    const track = ride(state, rig, 900);

    const cut = rig.open(state.progress.time);
    expect(cut).not.toBeNull();
    for (let i = 0; i < 900; i++) {
      step(cut!.state, cut!.input());
      expect([
        cut!.state.craft.x,
        cut!.state.craft.y,
        cut!.state.craft.z,
        cut!.state.craft.speed,
      ]).toEqual(track[i]);
    }
    expect(cut!.over()).toBe(true);
    expect(cut!.through()).toBe(1);
  });

  it("is cut where the run STANDS, so a run nobody finished is watchable", () => {
    const s = settings();
    const rig = rigFor(s);
    const state = gameFor(s, PARAMS, { level: LEVEL });
    rig.arm(state, null, true);
    ride(state, rig, 300);
    // Cut half way, and the run behind it carries on being recorded — which
    // is the whole of what the pause card's offer is.
    const early = rig.open(null);
    expect(early).not.toBeNull();
    expect(early!.bill.value).toBeNull();
    ride(state, rig, 300);
    const later = rig.open(null);
    expect(later).not.toBeNull();
    // The second cut is longer, and the first is still a whole recording.
    let earlySteps = 0;
    while (!early!.over()) {
      early!.input();
      earlySteps += 1;
    }
    let laterSteps = 0;
    while (!later!.over()) {
      later!.input();
      laterSteps += 1;
    }
    expect(earlySteps).toBe(300);
    expect(laterSteps).toBe(600);
  });

  it("keeps none of a FREE ride, and none of a run already under way", () => {
    // A free ride's wind and sea are the rider's own, so no two runs down it
    // are the same run — the same rule that keeps it out of the record book.
    const free = rigFor(settings({ mode: "free" }));
    const state = gameFor(settings(), PARAMS, { level: LEVEL });
    free.arm(state, null, true);
    expect(free.offers()).toBe(false);

    // ...and a run a link pre-rolled before handing it over. The rebuild
    // starts at t = 0, so a tape armed part way in would replay from a moment
    // the run never had.
    const late = rigFor(settings());
    const rolled = gameFor(settings(), PARAMS, { level: LEVEL });
    for (let i = 0; i < 10; i++) step(rolled, { ...NEUTRAL });
    late.arm(rolled, null, true);
    late.step({ ...NEUTRAL }, rolled);
    expect(late.offers()).toBe(false);
  });

  it("records the run it was ARMED for and no other", () => {
    // Two runs on the water at once is the ordinary case, not a corner: the
    // bot carries one on under the front door while a load builds the next,
    // and both are stepped through the same loop.
    const s = settings();
    const rig = rigFor(s);
    const mine = gameFor(s, PARAMS, { level: LEVEL });
    const other = gameFor(s, PARAMS, { level: LEVEL });
    rig.arm(mine, null, true);
    for (let i = 0; i < 50; i++) rig.step({ ...NEUTRAL }, other);
    expect(rig.offers()).toBe(false);
    rig.step({ ...NEUTRAL }, mine);
    expect(rig.offers()).toBe(true);
  });
});

const NEUTRAL: CraftInput = {
  steer: 0,
  throttle: 0,
  reverse: 0,
  lean: 0,
  crouch: 0,
  reset: false,
};
