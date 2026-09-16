// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GUIDE LINE'S ROUTE (pwa/src/game/guide-plan.ts): the stretch of the
// course's own line the dashes are laid over. The rule the whole mark rests
// on is that the line belongs to the COURSE rather than to the craft — it
// spans checkpoint to checkpoint and does not shrink to a stub as the rider
// closes on a mark — and that is what these cases hold.
import { describe, expect, it } from "vitest";

import {
  aimPoint,
  angleDiff,
  botInput,
  createGame,
  distanceAlong,
  placeRun,
  pointAlong,
  standCraft,
  step,
  type GameState,
} from "@engine";

import { BEHIND, REACH, guidePath, guideWindow } from "../pwa/src/game/guide-plan.ts";

import { levelFor } from "./support/levels.ts";

const SEED = 38;

function run(): GameState {
  return createGame({ seed: SEED, level: levelFor(SEED) });
}

/** The aim the renderer hands the plan — the next gate's centre while the
 * course is being counted, which is what the engine's own `aimPoint` returns
 * for these runs. */
function aimOf(state: GameState): { x: number; z: number } {
  const g = state.level.course.gates[state.progress.nextGate];
  return { x: g.x, z: g.z };
}

/** Where the craft stands on the course's line, m — measured off the
 * checkpoint behind it, the way the plan measures it. */
function stationOf(state: GameState, path: ReturnType<typeof guidePath>): number {
  const next = state.progress.nextGate;
  const from = next > 0 ? path.gates[next - 1] : 0;
  return distanceAlong(path.points, path.cum, state.craft.x, state.craft.z, from);
}

/** Ride the bot until the predicate holds or the clock runs out. */
function rideUntil(state: GameState, done: (s: GameState) => boolean, seconds: number): void {
  const until = state.t + seconds;
  while (state.t < until && !done(state)) step(state, botInput(state));
}

describe("the guide line's path", () => {
  it("measures every gate's station in order along the course's line", () => {
    const level = levelFor(SEED);
    const path = guidePath(level);
    expect(path.gates.length).toBe(level.course.gates.length);
    expect(path.length).toBeGreaterThan(0);
    for (let i = 1; i < path.gates.length; i++) {
      expect(path.gates[i]).toBeGreaterThan(path.gates[i - 1]);
    }
    expect(path.gates[path.gates.length - 1]).toBeLessThanOrEqual(path.length + 1e-6);
  });
});

describe("the guide line's window", () => {
  it("runs from astern of the rider to the checkpoint ahead", () => {
    const state = run();
    const path = guidePath(state.level);
    // Two gates taken, so the leg being ridden has a mark at both ends and a
    // mark before that for the tail to hang off.
    rideUntil(state, (s) => s.progress.nextGate >= 2, 180);
    expect(state.progress.nextGate).toBeGreaterThanOrEqual(2);
    const next = state.progress.nextGate;
    const { begin, end } = guideWindow(path, state, aimOf(state));
    expect(end).toBeGreaterThanOrEqual(path.gates[next] - 1e-6);
    // The tail is the rider's own `BEHIND` metres, held no further back than
    // the checkpoint before last.
    expect(begin).toBeGreaterThanOrEqual(path.gates[next - 2] - 1e-6);
    expect(stationOf(state, path)).toBeLessThanOrEqual(begin + BEHIND + 1e-6);
  });

  it("keeps its tail whole as the rider crosses a checkpoint", () => {
    const state = run();
    const path = guidePath(state.level);
    // The first mark is taken before this is worth asking: the tail hangs off
    // the start line until there is a checkpoint before last to hang it off.
    rideUntil(state, (s) => s.progress.nextGate >= 1, 180);
    const was = state.progress.nextGate;
    rideUntil(state, (s) => s.progress.nextGate > was, 180);
    const crossed = state.progress.nextGate - 1;
    expect(crossed).toBe(was);
    // The rider is standing ON the mark they have just taken, which is the
    // frame a tail cut off at that mark has nothing left in it.
    const { begin } = guideWindow(path, state, aimOf(state));
    expect(path.gates[crossed] - begin).toBeGreaterThan(BEHIND / 2);
  });

  it("keeps a leg in front of the rider right up to the checkpoint", () => {
    const state = run();
    const path = guidePath(state.level);
    const next = state.progress.nextGate;
    const gate = state.level.course.gates[next];
    // Stood a couple of boat lengths short of the mark: the moment a line
    // drawn from the HULL to it would be a stub.
    const back = 8;
    standCraft(
      state,
      gate.x - Math.sin(gate.heading) * back,
      gate.z - Math.cos(gate.heading) * back,
      gate.heading,
    );
    const { begin, end } = guideWindow(path, state, aimOf(state));
    expect(end - begin).toBeGreaterThan(REACH / 2);
    // …and it reaches past the mark, onto the leg the rider is about to ride.
    expect(end).toBeGreaterThan(path.gates[next] + 1);
  });

  it("never draws more line than the buffer is sized for", () => {
    const state = run();
    const path = guidePath(state.level);
    const gates = state.level.course.gates.length;
    for (let i = 0; i < 6 && state.progress.nextGate < gates; i++) {
      const { begin, end } = guideWindow(path, state, aimOf(state));
      expect(end).toBeGreaterThanOrEqual(begin);
      expect(end - begin).toBeLessThanOrEqual(REACH + BEHIND + 1e-6);
      expect(end).toBeLessThanOrEqual(path.length + 1e-6);
      rideUntil(state, (s) => s.progress.nextGate >= gates, 8);
    }
  });
});

/** A run over the same shore with the course switched off — the rules a
 * TRICKS run is dealt (`MODE_RULES`), where there are no checkpoints to hang
 * the line's ends off and `aimPoint` answers for a lip or for nothing. */
function tricksRun(): GameState {
  return createGame({ seed: SEED, level: levelFor(SEED), mode: "tricks" });
}

/** Stand the craft on the course's own line at station `d`, travelling
 * `speed` m/s along it — `way` of -1 rides the line the other way, which is
 * the half of a tricks field that is laid homebound. */
function standOnLine(
  state: GameState,
  path: ReturnType<typeof guidePath>,
  d: number,
  way: 1 | -1,
  speed: number,
): void {
  const at = pointAlong(path.points, path.cum, d);
  const heading = way > 0 ? at.heading : at.heading + Math.PI;
  standCraft(state, at.x, at.z, heading);
  state.craft.vx = Math.sin(heading) * speed;
  state.craft.vz = Math.cos(heading) * speed;
  state.craft.speed = speed;
}

describe("the guide line in a run with no course to count", () => {
  it("draws the rider's own stretch of the line, ahead of them and astern", () => {
    const state = tricksRun();
    const path = guidePath(state.level);
    const here = path.length / 2;
    standOnLine(state, path, here, 1, 20);
    const { begin, end } = guideWindow(path, state, aimPoint(state));
    expect(begin).toBeCloseTo(here - BEHIND, 6);
    expect(end).toBeCloseTo(here + REACH, 6);
  });

  it("turns round with the rider on the field's homebound pass", () => {
    const state = tricksRun();
    const path = guidePath(state.level);
    const here = path.length / 2;
    standOnLine(state, path, here, -1, 20);
    const { begin, end } = guideWindow(path, state, aimPoint(state));
    expect(begin).toBeCloseTo(here - REACH, 6);
    expect(end).toBeCloseTo(here + BEHIND, 6);
  });

  it("does not turn round under a rider half way through a backflip", () => {
    const state = tricksRun();
    const path = guidePath(state.level);
    const at = pointAlong(path.points, path.cum, path.length / 2);
    // A flight along the line with a flip already turning in it. The fold is
    // the engine's own: `toEuler` folds the pitch back as the nose passes
    // vertical and swings the heading a clean 180° to compensate, so the hull
    // READS as one going the other way while it is still travelling the way
    // the lip sent it.
    placeRun(state, {
      x: at.x,
      z: at.z,
      heading: at.heading,
      speed: 20,
      height: 14,
      vy: 8,
    });
    // The bars hauled back at the top of their axis is the PUMP, and a
    // tricks run is what reads it (`strokes.ts`): held there, the flip turns.
    let folded = false;
    for (let i = 0; i < 600 && !folded && state.craft.airborne; i++) {
      step(state, { steer: 0, throttle: 1, reverse: 0, lean: 1, crouch: 0, reset: false });
      folded = Math.abs(angleDiff(state.craft.heading, at.heading)) > Math.PI / 2;
    }
    expect(folded).toBe(true);
    expect(state.craft.airborne).toBe(true);
    // …and he is still going the way he was sent.
    const c = state.craft;
    expect(c.vx * Math.sin(at.heading) + c.vz * Math.cos(at.heading)).toBeGreaterThan(0);
    const here = distanceAlong(path.points, path.cum, c.x, c.z, 0);
    const { begin, end } = guideWindow(path, state, aimPoint(state));
    expect(end - here).toBeCloseTo(REACH, 6);
    expect(here - begin).toBeCloseTo(BEHIND, 6);
  });

  it("is never switched off by a moment with no lip to point at", () => {
    const state = tricksRun();
    const path = guidePath(state.level);
    let aimless = 0;
    let airborne = 0;
    for (let i = 0; i < 120 * 60; i++) {
      step(state, botInput(state));
      if (!aimPoint(state)) aimless++;
      if (state.craft.airborne) airborne++;
      const { begin, end } = guideWindow(path, state, aimPoint(state));
      expect(end - begin).toBeGreaterThan(0);
      expect(end - begin).toBeLessThanOrEqual(REACH + BEHIND + 1e-6);
    }
    // …and the run really did ride through the moments this is about.
    expect(aimless).toBeGreaterThan(0);
    expect(airborne).toBeGreaterThan(0);
  });

  it("goes dark with the run when a COURSE is ridden out to its last gate", () => {
    const state = run();
    const path = guidePath(state.level);
    state.progress.nextGate = state.level.course.gates.length;
    expect(aimPoint(state)).toBeNull();
    const { begin, end } = guideWindow(path, state, aimPoint(state));
    expect(end - begin).toBe(0);
  });
});
