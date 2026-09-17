// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TV CAM (`pwa/src/game/camera-tv.ts`): where a broadcast lens is planted
// for a moment the recording already knows is coming, and what it does once
// the craft arrives at it.
//
// Every claim here is a framing rule stated in that file's header, measured
// rather than eyeballed — a camera is judged by what has a SHAPE in it, and
// the three shapes this lens exists for are a hull with sky under it, a hull
// arriving out of the distance, and a hull going past close enough to throw
// its spray at the glass. WHICH moment and WHEN is `tests/replay_test.ts`'s.
import { describe, expect, it } from "vitest";

import { createGame, type GameState, type Level } from "@engine";

import { TV, clearWater, createTvCamera, standFor, standSide } from "../pwa/src/game/camera-tv.ts";
import type { CameraPose } from "../pwa/src/game/camera.ts";
import type { ReplayShot } from "../pwa/src/game/replay-shots.ts";

import { syntheticLevel } from "./support/synthetic.ts";

const DT = 1 / 120;
/** A flat sea, which is what a framing rule wants to be measured against:
 * the lens's own floor is the water, and a crest under the stand would put a
 * metre of swell into every number below. */
const FLAT = (): number => 0;

/** The synthetic shore: a flat bed at −8 m, a straight beach along z = 0 with
 * land climbing behind it, and two skerries standing off the line. The
 * shore's own bearing is 0 — the open sea is toward +z — and a case that
 * cares about the side says so by turning that. */
const SHORE = syntheticLevel();
const seaAt = (seaHeading: number): Level => ({ ...SHORE, seaHeading });
/** Well out from the beach and clear of both skerries, so a placement case
 * measures the framing rather than the refusal. */
const OPEN = { x: 620, z: 80 };
/** One run over that shore, for the cases outside the lens block below —
 * stood up once for the reason `state` is (see there). */
const ASHORE_RUN = createGame({ seed: 7, craft: "skiff", level: SHORE, quiet: true });

function shotAt(over: Partial<ReplayShot> = {}): ReplayShot {
  return {
    kind: "air",
    at: 1000,
    runs: 240,
    weight: 0.9,
    y: 0,
    heading: 0,
    speed: 22,
    ...OPEN,
    ...over,
  };
}

function pose(): CameraPose {
  return { x: 0, y: 0, z: 0, aimX: 0, aimY: 0, aimZ: 1, fov: 60, roll: 0 };
}

/** The distance from the stand to the craft's own line of travel, m — the
 * standoff the shot is framed at. */
function sideways(shot: ReplayShot, stand: { x: number; z: number }): number {
  const rx = Math.cos(shot.heading);
  const rz = -Math.sin(shot.heading);
  return Math.abs((stand.x - shot.x) * rx + (stand.z - shot.z) * rz);
}

/** ...and how far ALONG that line it stands, m. Positive is ahead of where
 * the craft was at the beat, which is the whole shot: the craft arrives. */
function along(shot: ReplayShot, stand: { x: number; z: number }): number {
  return (stand.x - shot.x) * Math.sin(shot.heading) + (stand.z - shot.z) * Math.cos(shot.heading);
}

describe("where the lens is planted", () => {
  it("stands OFF the craft's line, never on it", () => {
    for (const heading of [0, 0.9, 2.4, -1.7, Math.PI]) {
      const shot = shotAt({ heading });
      const stand = standFor(shot, seaAt(0), DT, FLAT)!;
      const out = sideways(shot, stand);
      expect(out).toBeGreaterThanOrEqual(TV.outMin - 1e-6);
      expect(out).toBeLessThanOrEqual(TV.outMax + 1e-6);
    }
  });

  it("stands further off the faster the moment happens, and no further than the cap", () => {
    const slow = standFor(shotAt({ speed: 6 }), seaAt(0), DT, FLAT)!;
    const quick = standFor(shotAt({ speed: 26 }), seaAt(0), DT, FLAT)!;
    const absurd = standFor(shotAt({ speed: 200, runs: 0 }), seaAt(0), DT, FLAT)!;
    expect(sideways(shotAt({ speed: 6 }), slow)).toBeLessThan(
      sideways(shotAt({ speed: 26 }), quick),
    );
    expect(sideways(shotAt({ speed: 200, runs: 0 }), absurd)).toBeCloseTo(TV.outMax);
  });

  it("stands AHEAD of the beat, beside the middle of what is worth watching", () => {
    const shot = shotAt();
    const stand = standFor(shot, seaAt(0), DT, FLAT)!;
    // Ahead of the launch, and short of where the hull comes down — a lens
    // past the landing photographs a transom.
    const reach = shot.speed * shot.runs * DT;
    expect(along(shot, stand)).toBeGreaterThan(0);
    expect(along(shot, stand)).toBeLessThan(reach + TV.ahead + 1e-6);
  });

  it("stands SEAWARD where the coast says which way that is", () => {
    // `Level.seaHeading` points at the open sea (R15), and a stand to the
    // right of travel is at heading + 90°. A craft running along the beach
    // with the sea on its right is filmed from the water.
    const shot = shotAt({ heading: 0 });
    expect(standSide(shot, Math.PI / 2)).toBe(1);
    expect(standSide(shot, -Math.PI / 2)).toBe(-1);
  });

  it("alternates the side where the sea is dead ahead, so two shots are not one angle", () => {
    // Nothing to prefer: both sides are equally wet, so the choice falls to
    // the shot's own step and consecutive moments get opposite angles.
    expect(standSide(shotAt({ at: 100, heading: 0 }), 0)).not.toBe(
      standSide(shotAt({ at: 101, heading: 0 }), 0),
    );
  });

  it("stays BESIDE the moment however long the moment claims to be", () => {
    // A tripod four hundred metres down the course is not beside the action,
    // it is a lens with the action four hundred metres away — and at that
    // range the craft is inside the haze and the shot is a picture of some
    // sea. Measured against the worst a collector can hand over: a hull
    // carried half a kilometre in one "flight".
    const far = shotAt({ speed: 63, runs: 1274 });
    const stand = standFor(far, seaAt(0), DT, FLAT)!;
    const away = Math.hypot(stand.x - far.x, stand.z - far.z);
    // The worst the placement can be: the along cap, and the standoff pushed
    // out as far as a fouled stand may push it.
    const widest = TV.outMax + TV.pushes * TV.pushOut;
    expect(away).toBeLessThanOrEqual(Math.hypot(TV.alongMax, widest) + 1e-6);
    // ...and an ordinary jump is not pulled IN by the same cap: the lens
    // still stands ahead of the lip rather than on top of it.
    const jump = shotAt({ speed: 22, runs: 240 });
    const near = standFor(jump, seaAt(0), DT, FLAT)!;
    expect(along(jump, near)).toBeGreaterThan(TV.ahead);
    expect(along(jump, near)).toBeLessThan(TV.alongMax);
  });

  it("REFUSES a rock and a beach, and takes the other side or stands further out", () => {
    // The fault this exists for: a stand is planted off a pose the run
    // recorded, so nothing else stops it landing inside a skerry — and a lens
    // inside a rock comes back as a dark polygon filling the frame, which
    // reads as a broken renderer rather than as a badly chosen angle.
    const skerry = SHORE.solids[0];
    expect(clearWater(SHORE, skerry.x, skerry.z)).toBe(false);
    // ...and the beach behind it: `z = 0` is the water's edge, the land
    // climbing inland from there.
    expect(clearWater(SHORE, 400, -40)).toBe(false);
    expect(clearWater(SHORE, 400, 90)).toBe(true);

    // A moment that WOULD put the lens on that skerry gets a stand somewhere
    // else rather than no stand and rather than the rock.
    const onto = shotAt({ x: skerry.x, z: skerry.z, heading: Math.PI / 2, speed: 8, runs: 1 });
    const stand = standFor(onto, seaAt(0), DT, FLAT);
    expect(stand).not.toBeNull();
    expect(clearWater(SHORE, stand!.x, stand!.z)).toBe(true);
  });

  it("hands the frame back when there is nowhere at all to stand one", () => {
    // Well inland, where every side and every push is hillside. The camera
    // says so rather than planting a lens in the ground, and the caller keeps
    // the boom (`camera.ts`).
    const ashore = shotAt({ x: 400, z: -200, speed: 4, runs: 1 });
    expect(standFor(ashore, seaAt(0), DT, FLAT)).toBeNull();
    const tv = createTvCamera();
    const p = pose();
    const before = { ...p };
    const framed = tv.update(p, ashore, ASHORE_RUN, DT, FLAT);
    expect(framed).toBe(false);
    // ...and the pose is left exactly as the caller had it, so the rig it
    // falls back to is not flying away from a lens that was never stood.
    expect(p).toEqual(before);
  });

  it("holds the lens over the water it stands on, whatever the water is doing", () => {
    const swell = (x: number, z: number): number => 1.4 * Math.sin(x / 9) + 0.6 * Math.cos(z / 5);
    for (const heading of [0, 1.1, -2.2]) {
      const shot = shotAt({ heading });
      const stand = standFor(shot, seaAt(0), DT, swell)!;
      expect(stand.y - swell(stand.x, stand.z)).toBeCloseTo(TV.lift);
    }
  });
});

describe("the lens, once the craft is coming at it", () => {
  const level = SHORE;
  /** ONE run, stood up once and MOVED — not a fresh `createGame` per
   * assertion. Building a game is the expensive thing this engine does
   * (the sea's bands, the wind, the hull), the lens reads nothing off it but
   * the craft's place and the level's own shore, and `.github/workflows/ci.yml`
   * says plainly that a file rebuilding the same world once per rule is what
   * puts the floor under a shard.
   *
   * The craft `back` metres short of the moment, on the line it is riding
   * toward the stand — which is what every shot is made of. */
  const RUN = createGame({ seed: 7, craft: "skiff", level, quiet: true });
  const state = (back: number, side = 0): GameState => {
    Object.assign(RUN.craft, { x: OPEN.x + side, z: OPEN.z - back, y: 0 });
    return RUN;
  };

  it("stands still: a tripod does not follow the craft it is watching", () => {
    const tv = createTvCamera();
    const shot = shotAt();
    const p = pose();
    tv.update(p, shot, state(240), DT, FLAT);
    const planted = { x: p.x, y: p.y, z: p.z };
    for (let i = 0; i < 60; i++) tv.update(p, shot, state(240 - i * 4), DT, FLAT);
    expect([p.x, p.y, p.z]).toEqual([planted.x, planted.y, planted.z]);
  });

  it("is LONG on a craft out in the distance and opens up as it arrives", () => {
    const tv = createTvCamera();
    const shot = shotAt();
    const p = pose();
    // Cut: the lens is snapped rather than eased, so the first frame of a
    // shot is already framed on a speck rather than easing onto one.
    tv.update(p, shot, state(260), DT, FLAT);
    const far = p.fov;
    expect(far).toBeCloseTo(TV.fovMin, 1);
    // ...and then a second and a half of a craft closing on it.
    for (let i = 0; i < 180; i++) {
      tv.update(p, shot, state(260 - i * 1.4), DT, FLAT);
    }
    expect(p.fov).toBeGreaterThan(far);
    expect(p.fov).toBeLessThanOrEqual(TV.fovMax);
  });

  it("keeps the lens inside its own two stops whatever the range", () => {
    const tv = createTvCamera();
    const p = pose();
    for (const back of [4000, 300, 20, 1, 0, -1, -40]) {
      tv.update(p, shotAt({ at: back }), state(back), DT, FLAT);
      expect(p.fov).toBeGreaterThanOrEqual(TV.fovMin - 1e-6);
      expect(p.fov).toBeLessThanOrEqual(TV.fovMax + 1e-6);
    }
  });

  it("LAGS the craft going past, so the hull leads the frame and the aim catches up", () => {
    const tv = createTvCamera();
    const shot = shotAt();
    const p = pose();
    tv.update(p, shot, state(80), DT, FLAT);
    // A craft moving a long way in one frame: an aim that arrived would sit
    // on it, and an operator's does not.
    const moved = state(40);
    tv.update(p, shot, moved, DT, FLAT);
    const behind = Math.hypot(p.aimX - moved.craft.x, p.aimZ - moved.craft.z);
    expect(behind).toBeGreaterThan(0.5);
    // ...and it does get there, given the frames.
    for (let i = 0; i < 400; i++) tv.update(p, shot, moved, DT, FLAT);
    expect(Math.hypot(p.aimX - moved.craft.x, p.aimZ - moved.craft.z)).toBeLessThan(0.05);
  });

  it("snaps rather than eases when a NEW shot takes the frame", () => {
    const tv = createTvCamera();
    const p = pose();
    const here = state(60);
    tv.update(p, shotAt({ at: 100 }), here, DT, FLAT);
    // A second shot a long way down the shore. Eased, the aim would fly
    // across the water between two stands; cut, it is simply on the craft.
    tv.update(p, shotAt({ at: 9000, x: 800, z: 800 }), here, DT, FLAT);
    expect(p.aimX).toBeCloseTo(here.craft.x);
    expect(p.aimZ).toBeCloseTo(here.craft.z);
    expect(p.aimY).toBeCloseTo(here.craft.y + TV.aimUp);
  });

  it("aims at the rider rather than at the keel, and never banks the frame", () => {
    const tv = createTvCamera();
    const p = pose();
    const here = state(60);
    tv.update(p, shotAt(), here, DT, FLAT);
    expect(p.aimY).toBeGreaterThan(here.craft.y);
    expect(p.roll).toBe(0);
  });
});
