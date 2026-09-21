// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR OVER THE WATER, held to the level it was loaded for.
//
// `pwa/src/game/environment.ts` is the one object in the renderer that
// OUTLIVES a level: it is built once with the scene and handed each shore in
// turn (`load`). Everything else about a sky is re-read every frame off the
// preset, so it cannot go stale — the rain is the exception, because it is a
// pool of geometry that is switched on and off rather than a colour, and what
// it is switched to is decided once a level.
//
// The scene is stood up in plain Node: nothing here draws, so no context and
// no DOM is needed, and a `THREE.Scene` with the dome and the rain hung in it
// costs milliseconds.

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { createGame, type Level, type Weather } from "@engine";

import { createEnvironment } from "../pwa/src/game/environment.ts";

import { levelFor } from "./support/levels.ts";

/** The same shore under a weather it was not dealt. The corpus is SHARED and
 * read-only, so the sky is moved on a copy. */
function under(seed: number, weather: Weather): Level {
  return { ...levelFor(seed), weather };
}

/** The rain's own geometry, found by the name the frame's scene tally buckets
 * it under (`environment.ts`) rather than by its place in the list. */
function rainLines(env: { unmirrored: readonly THREE.Object3D[] }): THREE.Object3D {
  const lines = env.unmirrored.find((o) => o.name === "rain");
  if (lines === undefined) throw new Error("the environment hung no rain in the scene");
  return lines;
}

describe("the environment", () => {
  /** The wet level RIDDEN, not merely loaded: the sheet is stood up by the
   * frame (`update`), so a leak from one level to the next is only reachable
   * once a frame has run under the wet sky. */
  function ride(env: ReturnType<typeof createEnvironment>, level: Level): void {
    const state = createGame({ seed: 38, level, quiet: true });
    env.update(state, new THREE.Vector3(state.craft.x, 3, state.craft.z), 1 / 60);
  }

  it("TAKES THE RAIN DOWN for a level whose sky is dry", () => {
    // The trap this holds: the sheet is only carried along while something is
    // falling, so a dry level that did not state its own rainfall would keep
    // whatever the last one left in the air — a squall's streaks standing
    // over a clear morning, frozen where the previous lens left them, and
    // billed every frame as a transparent sheet across the picture. It is
    // reachable from the front door, which rides a seed of its own behind the
    // card before the player has chosen anything.
    const env = createEnvironment(new THREE.Scene());
    const rain = rainLines(env);

    const wet = under(38, "squall");
    env.load(wet);
    ride(env, wet);
    expect(rain.visible).toBe(true);
    expect(env.rainfall()).toBeGreaterThan(0);

    env.load(under(38, "high"));
    expect(rain.visible).toBe(false);
    expect(env.rainfall()).toBe(0);
  });

  it("puts the rain back up when the next sky is wet again", () => {
    const env = createEnvironment(new THREE.Scene());
    const rain = rainLines(env);

    const dry = under(38, "clear");
    env.load(dry);
    ride(env, dry);
    expect(rain.visible).toBe(false);

    env.load(under(38, "rain"));
    expect(rain.visible).toBe(true);
  });

  it("keeps the RAIN row from standing a sheet up under a dry sky", () => {
    // The row scales the sheet the weather asked for; it does not decide that
    // there is one. Pressed under a clear sky it has nothing to scale.
    const env = createEnvironment(new THREE.Scene());
    const rain = rainLines(env);

    env.load(under(38, "clear"));
    env.setRainSheet(1);
    expect(rain.visible).toBe(false);

    env.load(under(38, "rain"));
    env.setRainSheet(0);
    expect(rain.visible).toBe(false);
    env.setRainSheet(1);
    expect(rain.visible).toBe(true);
  });
});
