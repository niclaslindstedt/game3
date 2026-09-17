// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GHOST'S TAPE (`pwa/src/game/ghost.ts`): the controls a run was ridden
// on, written down and put back on the water.
//
// The case that matters is the last one in this file and it is the whole
// premise of the feature: a run replayed off its tape puts the craft on the
// same centimetre of water as the run that cut it. Everything above it is
// what that case stands on — an axis snapped onto the grid the tape can
// write, a stream that survives the round trip whatever is in it, and a
// stored blob trusted no further than a run could have written it.
import { describe, expect, it } from "vitest";

import {
  NEUTRAL_INPUT,
  createGame,
  dropField,
  step,
  type CraftInput,
  type GameState,
} from "@engine";

import {
  GHOST_FORMAT,
  createGhostRecorder,
  decodeStream,
  encodeStream,
  ghostMatches,
  readGhost,
  readsAsGhost,
  snapInput,
  type GhostRun,
  type GhostStage,
} from "../pwa/src/game/ghost.ts";

import { syntheticLevel } from "./support/synthetic.ts";

const STAGE: GhostStage = { id: "c/mangrove-2", digest: "deadbeef", limit: 120 };

/** A varied afternoon at the bars: every axis moving on its own period, the
 * brake jabbed, the tuck walked in and out, and one reset banked partway
 * through — so the tape is exercised on something no run-length encoder can
 * flatter, rather than on a throttle held open. */
function scripted(step: number): CraftInput {
  return snapInput({
    steer: Math.sin(step / 37) * 0.9,
    throttle: 0.5 + 0.5 * Math.sin(step / 11),
    reverse: step % 97 < 6 ? 0.8 : 0,
    lean: Math.cos(step / 23),
    crouch: step % 53 < 20 ? 0.6 : 0,
    reset: step === 400,
  });
}

describe("an axis on the tape's grid", () => {
  it("survives the round trip exactly, so the replay is driven on what the run was", () => {
    const recorder = createGhostRecorder();
    for (let i = 0; i < 600; i++) recorder.record(scripted(i));
    const tape = readGhost(recorder.seal(STAGE, "skiff", 12.5));
    for (let i = 0; i < 600; i++) {
      // The very object the engine is handed, compared field by field: a
      // hundredth of a degree of lock recorded wrong is a replay that walks
      // off the line a gate later.
      expect({ ...tape.at(i) }).toEqual({ ...scripted(i) });
    }
  });

  it("clamps and keeps centre POSITIVE, because a tape cannot write -0", () => {
    const wild = snapInput({ ...NEUTRAL_INPUT, steer: -2, lean: 1.5, throttle: 4 });
    expect(wild.steer).toBe(-1);
    expect(wild.lean).toBe(1);
    expect(wild.throttle).toBe(1);
    expect(Object.is(snapInput({ ...NEUTRAL_INPUT, steer: -1e-9 }).steer, 0)).toBe(true);
  });

  it("is finer than a thumb or a key ramp can resolve", () => {
    // A hundredth of full lock either side of a value has to come back as a
    // different figure, or the grid is coarse enough to be felt.
    expect(snapInput({ ...NEUTRAL_INPUT, steer: 0.5 }).steer).not.toBe(
      snapInput({ ...NEUTRAL_INPUT, steer: 0.51 }).steer,
    );
  });
});

describe("the stream", () => {
  it("round-trips whatever is in it, held still or never still", () => {
    const held = new Array(1000).fill(7) as number[];
    expect([...decodeStream(encodeStream(held), held.length)]).toEqual(held);
    const churning = Array.from({ length: 1000 }, (_v, i) => (i * 37) % 256);
    expect([...decodeStream(encodeStream(churning), churning.length)]).toEqual(churning);
  });

  it("carries a run longer than one byte can count", () => {
    const long = new Array(900).fill(3) as number[];
    expect([...decodeStream(encodeStream(long), long.length)]).toEqual(long);
  });

  it("leaves the tail of a short or damaged tape at rest rather than throwing", () => {
    const short = encodeStream([1, 1, 1]);
    expect([...decodeStream(short, 8)]).toEqual([1, 1, 1, 0, 0, 0, 0, 0]);
    // …and one `atob` refuses outright comes back at rest rather than
    // throwing on the first frame of a run somebody is about to ride.
    expect([...decodeStream("\u00a3\u00a3\u00a3\u00a3", 4)]).toEqual([0, 0, 0, 0]);
  });
});

describe("what a tape is allowed back onto the water for", () => {
  const run = createGhostRecorder().seal(STAGE, "skiff", 12.5);

  it("is the same stage, the same shore and the same length", () => {
    expect(ghostMatches({ ...run, steps: 1 }, STAGE)).toBe(true);
    expect(ghostMatches({ ...run, id: "c/mangrove-5" }, STAGE)).toBe(false);
    // A generator that moved under a pinned seed is the case an id alone
    // sails straight past.
    expect(ghostMatches({ ...run, digest: "01234567" }, STAGE)).toBe(false);
    expect(ghostMatches({ ...run, limit: 240 }, STAGE)).toBe(false);
    expect(ghostMatches({ ...run, format: GHOST_FORMAT + 1 }, STAGE)).toBe(false);
  });

  it("is a blob a run could actually have written", () => {
    const good: GhostRun = { ...run, steps: 12 };
    expect(readsAsGhost(good)).toBe(true);
    expect(readsAsGhost(null)).toBe(false);
    expect(readsAsGhost("a tape")).toBe(false);
    expect(readsAsGhost({ ...good, craft: "hovercraft" })).toBe(false);
    expect(readsAsGhost({ ...good, steps: 0 })).toBe(false);
    expect(readsAsGhost({ ...good, steps: 1.5 })).toBe(false);
    expect(readsAsGhost({ ...good, value: Number.NaN })).toBe(false);
    expect(readsAsGhost({ ...good, steer: 12 })).toBe(false);
  });
});

describe("the run, ridden again", () => {
  const LEVEL = syntheticLevel();
  const STEPS = 900;
  const options = { seed: 7, craft: "skiff" as const, level: LEVEL, quiet: true };

  /** Where the hull is, to the figure the physics produced and not rounded:
   * a replay that is merely close is a ghost somewhere else by the buzzer. */
  const pose = (state: GameState): number[] => [
    state.craft.x,
    state.craft.y,
    state.craft.z,
    state.craft.q.x,
    state.craft.q.y,
    state.craft.q.z,
    state.craft.q.w,
    state.craft.speed,
    state.tricks.score,
  ];

  it("puts the craft on the same water, step for step, off the tape alone", () => {
    const ridden = createGame(options);
    const recorder = createGhostRecorder();
    const track: number[][] = [];
    for (let i = 0; i < STEPS; i++) {
      const driven = scripted(i);
      recorder.record(driven);
      step(ridden, driven);
      track.push(pose(ridden));
    }
    const tape = readGhost(recorder.seal(STAGE, "skiff", ridden.progress.time));
    expect(tape.steps).toBe(STEPS);

    const replayed = createGame(options);
    for (let i = 0; i < STEPS; i++) {
      step(replayed, tape.at(i));
      expect(pose(replayed)).toEqual(track[i]);
    }
  });

  it("rides the run's own stream when the run had a FIELD and the ghost has none", () => {
    // The `dropField` contract (`engine/game/rivals.ts`), which is the whole
    // reason a ghost is built the way its run was built. The grid deals a
    // rider's weight and a pace off the run's own stream for every rival, so
    // a ghost stood up with `rivals: 0` would have its wind gusting off a
    // stream twenty-two draws further along.
    //
    // The one thing the drop cannot hand back is the WATER: every rider's
    // wash stands on the one sea (`engine/game/wash.ts`), and eleven wakes
    // go with the eleven hulls. So the run this is read against is a fielded
    // one whose trails are lifted off the sea by hand before it is ridden —
    // leaving the STREAM as the only thing that can still put the two runs
    // apart, which is what this case is about. Nothing ships a ghost of a
    // race: a tape is kept only for the two modes that ride alone
    // (`pwa/src/game/ghost-run.ts`).
    const raced = { ...options, rules: { rivals: 11, contact: false } };
    const ridden = createGame(raced);
    ridden.sea.washes.length = 0;
    ridden.sea.washes.push(ridden.wash);
    const recorder = createGhostRecorder();
    for (let i = 0; i < STEPS; i++) {
      const driven = scripted(i);
      recorder.record(driven);
      step(ridden, driven);
    }
    const tape = readGhost(recorder.seal(STAGE, "skiff", 1));

    const ghost = createGame(raced);
    dropField(ghost);
    expect(ghost.rivals).toHaveLength(0);
    // …and the field's wakes came off the sea with the field, so what is
    // left in the water is the rider's own trail and nothing else.
    expect(ghost.sea.washes).toEqual([ghost.wash]);
    for (let i = 0; i < STEPS; i++) step(ghost, tape.at(i));
    expect(pose(ghost)).toEqual(pose(ridden));

    // …and the control: the same tape over a run that was never dealt a
    // grid ends up somewhere else, which is what makes the case above a
    // claim about the stream rather than about the level.
    const unfielded = createGame({ ...options, rules: { rivals: 0 } });
    for (let i = 0; i < STEPS; i++) step(unfielded, tape.at(i));
    expect(pose(unfielded)).not.toEqual(pose(ridden));
  });

  it("holds still at the end of the tape rather than riding on", () => {
    const tape = readGhost(createGhostRecorder().seal(STAGE, "skiff", 1));
    expect({ ...tape.at(0) }).toEqual({ ...NEUTRAL_INPUT });
    expect({ ...tape.at(-1) }).toEqual({ ...NEUTRAL_INPUT });
  });

  it("is a run the RECORDING moved, not one the engine would have anyway", () => {
    // The guard under the case above: a craft handed neutral controls for the
    // same steps ends up somewhere else entirely, so passing it means the
    // tape drove the replay rather than the level doing the work.
    const idle = createGame(options);
    for (let i = 0; i < STEPS; i++) step(idle, NEUTRAL_INPUT);
    const ridden = createGame(options);
    for (let i = 0; i < STEPS; i++) step(ridden, scripted(i));
    const apart = Math.hypot(ridden.craft.x - idle.craft.x, ridden.craft.z - idle.craft.z);
    expect(apart).toBeGreaterThan(10);
  });
});
