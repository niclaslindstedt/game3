// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The §25 guards: a run replayed from the same seed and inputs is the same
// run, bit for bit; the engine draws nothing from a clock or a global
// random source; and a different seed is a different run.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  botInput,
  createGame,
  simulateStage,
  step,
  type CraftInput,
  type GameState,
} from "@engine";

import { syntheticLevel } from "./support/synthetic.ts";

/** A fingerprint of the moving parts of a state. */
function fingerprint(state: GameState): string {
  const c = state.craft;
  return [
    c.x,
    c.y,
    c.z,
    c.vx,
    c.vy,
    c.vz,
    c.q.x,
    c.q.y,
    c.q.z,
    c.q.w,
    c.wx,
    c.wy,
    c.wz,
    c.rpm,
    c.nozzle,
    state.wind.gust,
    state.wind.veer,
    state.progress.time,
    state.progress.nextGate,
  ].join(",");
}

/** A scripted rider: throttle on, a slow weave, a lean now and then. */
function scripted(t: number): CraftInput {
  return {
    steer: Math.sin(t * 0.7) * 0.6,
    throttle: 0.5 + 0.5 * Math.sin(t * 0.3) ** 2,
    reverse: 0,
    lean: Math.sin(t * 1.3) > 0.8 ? 1 : 0,
    crouch: 0,
    reset: false,
  };
}

function walk(source: string, out: string[]): void {
  for (const name of readdirSync(source)) {
    const path = join(source, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith(".ts")) out.push(path);
  }
}

describe("determinism", () => {
  it("replays a scripted run identically from the same seed", () => {
    const level = syntheticLevel({ windSpeed: 5 });
    const runs = [0, 1].map(() => {
      const state = createGame({ seed: 77, craft: "marlin", level, quiet: true });
      const prints: string[] = [];
      for (let i = 0; i < 120 * 12; i++) {
        step(state, scripted(state.t));
        if (i % 120 === 0) prints.push(fingerprint(state));
      }
      prints.push(fingerprint(state));
      return prints;
    });
    expect(runs[0]).toEqual(runs[1]);
  });

  it("the bot's run digests identically twice", () => {
    const level = syntheticLevel({ windSpeed: 6 });
    const a = simulateStage({ seed: 5, craft: "skiff", level, maxSeconds: 90 });
    const b = simulateStage({ seed: 5, craft: "skiff", level, maxSeconds: 90 });
    expect(a.digest).toBe(b.digest);
    expect(a.time).toBe(b.time);
    expect(a.events.length).toBe(b.events.length);
  });

  it("a different seed gusts differently and so rides differently", () => {
    const level = syntheticLevel({ windSpeed: 6 });
    const a = simulateStage({ seed: 5, craft: "skiff", level, maxSeconds: 60 });
    const b = simulateStage({ seed: 6, craft: "skiff", level, maxSeconds: 60 });
    expect(a.digest).not.toBe(b.digest);
  });

  it("the bot is a pure function of the state", () => {
    const level = syntheticLevel();
    const state = createGame({ seed: 3, level, quiet: true });
    for (let i = 0; i < 400; i++) step(state, botInput(state));
    const one = botInput(state);
    const two = botInput(state);
    expect(one).toEqual(two);
  });

  it("the engine never reads a clock or a global random source", () => {
    const files: string[] = [];
    walk(join(process.cwd(), "engine"), files);
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      // The analyzer times itself for its report; it is dev-time only and
      // never steps a run.
      if (file.includes("/analysis/")) continue;
      // The prose may name the thing it forbids; the code may not.
      const text = readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join("\n");
      expect(text, file).not.toMatch(/Math\.random/);
      expect(text, file).not.toMatch(/Date\.now|new Date\(|performance\.now/);
    }
  });

  it("nothing in the engine prints to the console", () => {
    const files: string[] = [];
    walk(join(process.cwd(), "engine"), files);
    for (const file of files) {
      if (file.endsWith("/output.ts")) continue;
      expect(readFileSync(file, "utf8"), file).not.toMatch(/console\./);
    }
  });
});
