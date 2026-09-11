// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MINIMAP — the square of sea it draws, and what stands on it
// (pwa/src/game/minimap-scene.ts, minimap-view.ts).
//
// It is tested rather than looked at because a screenshot only ever shows one
// place on one run, and every claim the instrument makes is a claim about
// EVERY place a craft can get to:
//
//   * the window is centred on the CRAFT, not on the course — on the line, a
//     hundred metres out to sea, and turned round facing back down it;
//   * it holds a fixed square of water, so a short course and a long one are
//     drawn at the same scale and the shore is a coast on both;
//   * the schematic is cut around an ANCHOR and slid, so the picture moves
//     every frame while the geometry behind it is rebuilt now and then — and
//     the two must agree, or the coast lags the craft;
//   * the marks that can leave the window behave the way each of them has to:
//     a gate goes, the gate the run still owes rides the rim.

import { describe, expect, it } from "vitest";
import { createGame, gateBuoys, type GameState } from "@engine";

import { TREE_LINE } from "../pwa/src/game/flora-defs.ts";
import {
  SPAN,
  VIEW,
  inView,
  minimapScene,
  project,
  spanFor,
  spanNow,
} from "../pwa/src/game/minimap-scene.ts";
import { buildMinimap, scaleBar } from "../pwa/src/game/minimap-view.ts";
import { syntheticLevel } from "./support/synthetic.ts";

/** The rig: the synthetic shore — a straight coast along z = 0, six gates
 * out at z = 40, two skerries off the line. Everything below reasons about
 * those, so a claim here is a claim about a level no generator built. */
const LEVEL = syntheticLevel();

function game(): GameState {
  return createGame({ seed: 7, level: LEVEL, quiet: true });
}

/** Every `M`/`L`/`A` coordinate pair in a path, in the order written. */
function points(path: string): [number, number][] {
  const out: [number, number][] = [];
  for (const m of path.matchAll(/[MLA] (-?[\d.]+) (-?[\d.]+)/g)) {
    out.push([Number(m[1]), Number(m[2])]);
  }
  return out;
}

/** Stand the craft at a plan point, at rest — no physics, just the pose the
 * map reads. */
function stand(state: GameState, x: number, z: number, heading = 0): void {
  state.craft.x = x;
  state.craft.z = z;
  state.craft.heading = heading;
}

describe("minimap window", () => {
  it("centres on the craft wherever the craft is", () => {
    const state = game();
    for (const at of [
      { x: state.craft.x, z: state.craft.z },
      { x: 300, z: 40 },
      { x: -2000, z: 3000 },
    ]) {
      stand(state, at.x, at.z);
      const [px, py] = project(state, at.x, at.z, SPAN);
      expect(px).toBeCloseTo(VIEW / 2, 6);
      expect(py).toBeCloseTo(VIEW / 2, 6);
    }
  });

  it("draws north up and the engine's clockwise turn to the left", () => {
    // The one flip is input-model.ts's `SCREEN_TO_ENGINE`, and the map is
    // downstream of it: a point due north of the craft is up-screen, and a
    // heading that GROWS (the engine's clockwise) turns the icon the way the
    // rider's own screen turns.
    const state = game();
    stand(state, 300, 40);
    const [, north] = project(state, 300, 140, SPAN);
    expect(north).toBeLessThan(VIEW / 2);
    const [east] = project(state, 400, 40, SPAN);
    expect(east).toBeLessThan(VIEW / 2);

    stand(state, 300, 40, 0);
    const level = buildMinimap(state).heading;
    stand(state, 300, 40, 0.4);
    expect(buildMinimap(state).heading).toBeLessThan(level);
  });

  it("breathes with the speedo, and settles at both ends", () => {
    const still = spanFor(SPAN, 0);
    const cruising = spanFor(SPAN, 40);
    const flat = spanFor(SPAN, 200);
    expect(still).toBeLessThan(cruising);
    expect(cruising).toBeLessThan(flat);
    // Closed in at a standstill, opened up on the plane, and never past
    // either stop however hard the speedo is pushed.
    expect(still).toBeLessThan(SPAN);
    expect(flat).toBeGreaterThan(SPAN);
    expect(spanFor(SPAN, 1e4)).toBe(flat);
    expect(spanFor(SPAN, -5)).toBe(still);
  });

  it("chases the speedo rather than jumping to it", () => {
    // `CraftState.speed` carries every crest the hull drops off, so a window
    // wired straight to it pumps. The first reading on a level LANDS — there
    // is nothing to chase from — and every one after it is chased.
    const level = syntheticLevel();
    const closed = spanNow(level, SPAN, 0, 0);
    expect(closed).toBeCloseTo(spanFor(SPAN, 0), 6);

    const open = spanFor(SPAN, 80);
    const tick = spanNow(level, SPAN, 80, 0.1);
    expect(tick).toBeGreaterThan(closed);
    expect(tick).toBeLessThan(closed + (open - closed) * 0.5);

    // ...and it gets there. A couple of seconds of full throttle is the
    // window open, not a window still on its way.
    let span = tick;
    for (let i = 0; i < 20; i++) span = spanNow(level, SPAN, 80, 0.1 + i * 0.1);
    expect(span).toBeGreaterThan(open * 0.97);
    expect(span).toBeLessThanOrEqual(open);

    // A clock that has gone backwards is a fresh run at the same level, and
    // the window lands rather than sliding back down the coast.
    expect(spanNow(level, SPAN, 0, 0)).toBeCloseTo(closed, 6);
  });

  it("rules the window in round figures that fit inside it", () => {
    for (const span of [spanFor(SPAN, 0), SPAN, spanFor(SPAN, 80), 2000]) {
      const bar = scaleBar(span);
      // The bar is a share of the box, so what it is WORTH has to be read
      // off its word — which is why the word is always round.
      expect(bar.label).toMatch(/^(10|20|25|50|100|200|250|500|1000) M$/);
      expect(bar.length).toBeGreaterThan(0);
      expect(bar.length).toBeLessThanOrEqual(VIEW / 3);
      // …and the bar means what it says: its length is its metres at the
      // window's own scale.
      expect(bar.length).toBeCloseTo((Number(bar.label.split(" ")[0]) * VIEW) / span, 6);
    }
    // A window that opens steps UP a rung rather than drawing a longer bar.
    expect(scaleBar(spanFor(SPAN, 80)).label).not.toBe(scaleBar(spanFor(SPAN, 0)).label);
  });
});

describe("minimap schematic", () => {
  it("cuts once and then slides, and the two compose to one picture", () => {
    const state = game();
    stand(state, 300, 60);
    const first = minimapScene(state, SPAN);
    expect(first.offset).toEqual({ x: 0, y: 0 });

    // A few metres on: the same cut, translated. The paths must be the very
    // same strings — a re-cut here would be geometry rebuilt for nothing.
    stand(state, 306, 60);
    const slid = minimapScene(state, SPAN);
    expect(slid.cut).toBe(first.cut);
    expect(slid.shore).toBe(first.shore);
    expect(slid.offset.x).toBeCloseTo(6 * (VIEW / SPAN), 6);

    // ...and the offset is what puts the world back where it belongs: the
    // anchor's own point, drawn at the middle of the box, now stands where
    // the craft has left it.
    const anchor = project(state, 300, 60, SPAN);
    expect(VIEW / 2 + slid.offset.x).toBeCloseTo(anchor[0], 6);
    expect(VIEW / 2 + slid.offset.y).toBeCloseTo(anchor[1], 6);
  });

  it("re-cuts once the craft has outrun the anchor", () => {
    const state = game();
    stand(state, 200, 60);
    const before = minimapScene(state, SPAN);
    stand(state, 260, 60);
    const after = minimapScene(state, SPAN);
    expect(after.cut).not.toBe(before.cut);
    expect(after.offset).toEqual({ x: 0, y: 0 });
  });

  it("holds the same picture across a change of zoom step", () => {
    // The paths are cut at a rounded span and the difference is carried as a
    // scale, so crossing a step must be invisible: a world point lands in the
    // same place in the box either side of it.
    const state = game();
    stand(state, 300, 60);
    const shown = [SPAN * 0.7, SPAN * 0.71, SPAN * 1.3];
    for (const span of shown) {
      const scene = minimapScene(state, span);
      // The group is scaled about the middle of the box and then slid, so
      // the anchor — which is the craft here — is at the middle either way.
      expect(scene.zoom).toBeGreaterThanOrEqual(1);
      expect(scene.zoom * span).toBeCloseTo(Math.ceil(span / 40) * 40, 6);
    }
  });

  it("puts the land on the shoreward side and the shallows between", () => {
    // The craft sits offshore of a coast running along z = 0, so on a
    // north-up map the land is BELOW it and the deep water above.
    const state = game();
    stand(state, 300, 90);
    const scene = minimapScene(state, SPAN);
    expect(scene.land).not.toBe("");
    expect(scene.shallows).not.toBe("");
    for (const [, y] of points(scene.land)) expect(y).toBeGreaterThan(VIEW / 2);
    // The shallows are the band the bed rises through, so they lie between
    // the land and the craft rather than out to sea beyond it.
    const deepest = Math.min(...points(scene.shallows).map(([, y]) => y));
    const highestLand = Math.min(...points(scene.land).map(([, y]) => y));
    expect(deepest).toBeGreaterThan(VIEW / 2);
    expect(deepest).toBeLessThan(highestLand);
  });

  it("bands the ground all the way from the shelf to the tree line", () => {
    // Every band is the whole region ABOVE its own level, so they nest: the
    // shelf reaches furthest out to sea, the shallows stop short of it, the
    // land short of them again. Nesting is what lets them be drawn over one
    // another with no band having to find its own inner edge.
    const state = game();
    stand(state, 300, 90);
    const scene = minimapScene(state, SPAN);
    const seaward = (path: string): number => Math.min(...points(path).map(([, y]) => y));
    expect(seaward(scene.shelf)).toBeLessThan(seaward(scene.shallows));
    expect(seaward(scene.shallows)).toBeLessThan(seaward(scene.land));
    // This shore climbs to +5 m and the wood runs to the tree line at 20,
    // so the whole of it is wooded and none of it is bare headland.
    expect(TREE_LINE).toBeGreaterThan(5);
    expect(scene.highland).toBe("");
  });

  it("cuts a band's edge through the lattice rather than snapping it to one", () => {
    // The synthetic bed is linear in z and crosses zero at z = 0, so the
    // land's seaward edge is at z = 0 EXACTLY. A band built out of whole
    // cells would put it up to one cell out — several view units at this
    // framing, and the staircase a coast used to be drawn as.
    const state = game();
    stand(state, 300, 90);
    const scene = minimapScene(state, SPAN);
    const [, shoreY] = project(state, 300, 0, SPAN);
    expect(Math.min(...points(scene.land).map(([, y]) => y))).toBeCloseTo(shoreY, 1);
  });

  it("tells a rock that breaks the surface from a reef that does not", () => {
    const state = game();
    // S1 stands 1.5 m proud at (250, 75); nothing else is near.
    stand(state, 250, 75);
    const standing = minimapScene(state, SPAN);
    expect(standing.rocks).not.toBe("");

    const drowned = createGame({
      seed: 7,
      quiet: true,
      level: {
        ...LEVEL,
        solids: LEVEL.solids.map((s) => ({ ...s, kind: "reef" as const, top: -1 })),
      },
    });
    stand(drowned, 250, 75);
    const under = minimapScene(drowned, SPAN);
    expect(under.rocks).toBe("");
    expect(under.reefs).not.toBe("");
  });
});

describe("minimap marks", () => {
  it("draws the gates the window holds and drops the ones it does not", () => {
    const state = game();
    stand(state, 100, 40);
    const near = buildMinimap(state);
    expect(near.gates.map((g) => g.index)).toContain(0);
    for (const gate of near.gates) expect(inView([gate.x, gate.y])).toBe(true);

    stand(state, 100, 4000);
    expect(buildMinimap(state).gates).toEqual([]);
  });

  it("draws a water gate as the very line the engine tests a crossing on", () => {
    const state = game();
    stand(state, 100, 40);
    const gate = buildMinimap(state).gates.find((g) => g.index === 0);
    expect(gate).toBeDefined();
    const buoys = gateBuoys(LEVEL.course.gates[0]);
    for (let i = 0; i < 2; i++) {
      const at = project(state, buoys[i].x, buoys[i].z, spanFor(SPAN, 0));
      expect(gate?.buoys[i][0]).toBeCloseTo(at[0], 6);
      expect(gate?.buoys[i][1]).toBeCloseTo(at[1], 6);
    }
    // ...and the centre is between them, which is the gap to aim at.
    const mid = (gate!.buoys[0][0] + gate!.buoys[1][0]) / 2;
    expect(mid).toBeCloseTo(gate!.x, 4);
  });

  it("marks the gate the run owes, and remembers the one it left behind", () => {
    const state = game();
    stand(state, 100, 40);
    expect(buildMinimap(state).gates.find((g) => g.index === 0)?.state).toBe("next");

    state.progress.passed.push(0);
    state.progress.nextGate = 1;
    expect(buildMinimap(state).gates.find((g) => g.index === 0)?.state).toBe("passed");

    state.progress.missed.push(0);
    expect(buildMinimap(state).gates.find((g) => g.index === 0)?.state).toBe("missed");
  });

  it("rides the rim once the gate the run owes is off the window", () => {
    const state = game();
    stand(state, 100, 40);
    expect(buildMinimap(state).chevron).toBeNull();

    // Blown a long way out to sea: the gate is due south, so the chevron is
    // on the bottom edge and points down-screen (180°).
    stand(state, 100, 900);
    const chevron = buildMinimap(state).chevron;
    expect(chevron).not.toBeNull();
    expect(inView([chevron!.x, chevron!.y])).toBe(true);
    expect(chevron!.y).toBeGreaterThan(VIEW / 2);
    expect(Math.abs(chevron!.angle)).toBeCloseTo(180, 0);
  });

  it("has nowhere to point once the run is over", () => {
    const state = game();
    const total = LEVEL.course.gates.length;
    stand(state, 700, 40);
    state.progress.nextGate = total;
    state.progress.passed = LEVEL.course.gates.map((g) => g.index);
    const map = buildMinimap(state);
    expect(map.chevron).toBeNull();
    expect(map.progress).toBe(1);
  });

  it("fills the gauge with the share of the gates reached", () => {
    const state = game();
    stand(state, 100, 40);
    const total = LEVEL.course.gates.length;
    expect(buildMinimap(state).progress).toBe(0);
    // A gate skipped past was still REACHED, and the engine's `gatesReached`
    // is what says so — the gauge and the HUD's own counter read the one
    // figure rather than each summing the book.
    state.progress.passed.push(1);
    state.progress.missed.push(0);
    state.progress.nextGate = 2;
    expect(buildMinimap(state).progress).toBeCloseTo(2 / total, 9);
  });

  it("flags the run's two ends while the window holds them", () => {
    const state = game();
    stand(state, LEVEL.start.x, LEVEL.start.z);
    expect(buildMinimap(state).ends.map((e) => e.kind)).toContain("start");

    const last = LEVEL.course.gates[LEVEL.course.gates.length - 1];
    stand(state, last.x, last.z);
    expect(buildMinimap(state).ends.map((e) => e.kind)).toContain("finish");

    stand(state, 300, 4000);
    expect(buildMinimap(state).ends).toEqual([]);
  });
});
