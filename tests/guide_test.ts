// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GUIDE LINE'S ROUTE (pwa/src/game/guide-plan.ts): the stretch of the
// course's own line the dashes are laid over. The rule the whole mark rests
// on is that the line belongs to the COURSE rather than to the craft — it
// spans checkpoint to checkpoint and does not shrink to a stub as the rider
// closes on a mark — and that is what these cases hold.
import { describe, expect, it } from "vitest";

import { botInput, createGame, standCraft, step, type GameState } from "@engine";

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
  it("runs from the checkpoint behind the rider to the one ahead", () => {
    const state = run();
    const path = guidePath(state.level);
    // Two gates taken, so the leg being ridden has a mark at both ends.
    rideUntil(state, (s) => s.progress.nextGate >= 2, 180);
    expect(state.progress.nextGate).toBeGreaterThanOrEqual(2);
    const next = state.progress.nextGate;
    const { begin, end } = guideWindow(path, state, aimOf(state));
    expect(begin).toBeGreaterThanOrEqual(path.gates[next - 1] - 1e-6);
    expect(end).toBeGreaterThanOrEqual(path.gates[next] - 1e-6);
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
