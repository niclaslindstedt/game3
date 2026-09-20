// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MENU DRONE (`pwa/src/game/camera-menu.ts`): the shot the front door
// stands over — a lens a dozen storeys up with the rider held out in whatever
// band of frame the card does not cover.
//
// Two of the claims here are the ones that cost this camera its first three
// drafts, and both are measured rather than eyeballed:
//
//   THE RIDER IS WHERE HE WAS PUT. The framing is SOLVED (`aimFor`), so the
//   case projects the craft back through the pose that came out and checks
//   where it landed — with a projection written here from three's own
//   convention rather than borrowed from the code under test. That is not
//   pedantry: the first draft built its screen-right as `up × forward`
//   instead of `forward × up`, which MIRRORS the frame, and a rider aimed
//   into the left band landed in the right one — under the card. A test that
//   shared the mistake agreed with it.
//
//   THE LENS IS OVER WATER, WITH THE RIDER IN SIGHT. A taiga start sits in a
//   channel a hundred and fifty metres wide, so a standoff taken on a compass
//   bearing puts the lens in a pine wood with the rider behind a tree. The
//   cases below ride real shores for that reason.
import { describe, expect, it } from "vitest";

import { bedAt, createGame, sampleField, type Level } from "@engine";

import { verticalFovFor } from "../pwa/src/game/camera-lens.ts";
import {
  MENU_CAM,
  aimFor,
  anchorFor,
  createMenuCamera,
  seawardFrom,
  standoffFor,
  type ScreenBox,
  type ScreenPoint,
} from "../pwa/src/game/camera-menu.ts";
import { cardBox } from "../pwa/src/game/live-camera.ts";
import type { CameraPose } from "../pwa/src/game/camera.ts";

import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";

const DT = 1 / 60;

/** THE THREE REFERENCE VIEWPORTS, with the front door's card measured off the
 * built site at each (`make screenshots --surface menu`, CSS pixels). They are
 * three different shapes of problem, which is the whole reason the band is
 * picked rather than authored: the desktop leaves two deep side bands, the
 * phone held UPRIGHT leaves a deep band above and below, and the phone on its
 * SIDE is a card nineteen twentieths of the width with only a strip under it. */
const VIEWS = {
  desktop: { w: 1280, h: 720, card: { left: 400, right: 880, top: 130, bottom: 588 } },
  phone: { w: 390, h: 844, card: { left: 16, right: 374, top: 212, bottom: 629 } },
  landscape: { w: 844, h: 390, card: { left: 40, right: 804, top: 62, bottom: 328 } },
};

function boxFor(view: keyof typeof VIEWS): ScreenBox {
  const { w, h, card } = VIEWS[view];
  return cardBox(card, w, h);
}

/** Whether a point in the frame is inside a box — what "under the card"
 * means, and the one thing the anchor may never be. */
function inside(box: ScreenBox, at: ScreenPoint): boolean {
  return at.x > box.left && at.x < box.right && at.y > box.bottom && at.y < box.top;
}

/** WHERE A WORLD POINT LANDS IN THE FRAME, −1..1 across and up.
 *
 * Written from three.js's own `lookAt`: the camera's basis is RIGHT =
 * `forward × worldUp` and UP = `right × forward`. Stated here in full rather
 * than imported, because a test that borrows the module's basis cannot catch
 * a mirrored one. */
function screenOf(pose: CameraPose, aspect: number, p: { x: number; y: number; z: number }) {
  const f = { x: pose.aimX - pose.x, y: pose.aimY - pose.y, z: pose.aimZ - pose.z };
  const fl = Math.hypot(f.x, f.y, f.z);
  f.x /= fl;
  f.y /= fl;
  f.z /= fl;
  const r = { x: -f.z, y: 0, z: f.x };
  const rl = Math.hypot(r.x, r.z);
  r.x /= rl;
  r.z /= rl;
  const u = {
    x: r.y * f.z - r.z * f.y,
    y: r.z * f.x - r.x * f.z,
    z: r.x * f.y - r.y * f.x,
  };
  const d = { x: p.x - pose.x, y: p.y - pose.y, z: p.z - pose.z };
  const ahead = d.x * f.x + d.y * f.y + d.z * f.z;
  const across = d.x * r.x + d.y * r.y + d.z * r.z;
  const up = d.x * u.x + d.y * u.y + d.z * u.z;
  const tanY = Math.tan((verticalFovFor(pose.fov, aspect) * Math.PI) / 360);
  return { x: across / ahead / (tanY * aspect), y: up / ahead / tanY, ahead };
}

describe("the band the card leaves (anchorFor)", () => {
  it("never puts the rider under the card, at any reference viewport", () => {
    for (const view of Object.keys(VIEWS) as (keyof typeof VIEWS)[]) {
      const box = boxFor(view);
      expect(inside(box, anchorFor(box)), view).toBe(false);
    }
  });

  it("keeps him off the glass at every one of them", () => {
    for (const view of Object.keys(VIEWS) as (keyof typeof VIEWS)[]) {
      const at = anchorFor(boxFor(view));
      expect(Math.abs(at.x), `${view} across`).toBeLessThan(0.9);
      expect(Math.abs(at.y), `${view} up`).toBeLessThan(0.9);
    }
  });

  it("takes a SIDE where the card leaves side room and the FLOOR where it does not", () => {
    // The desktop's card is thirty rem in a 1280-wide window, so a third of
    // the frame is clear either side; both phone viewports are a card within
    // a rem or two of the full width, where the only room is above and below.
    expect(Math.abs(anchorFor(boxFor("desktop")).x)).toBeGreaterThan(0.5);
    for (const view of ["phone", "landscape"] as const) {
      const at = anchorFor(boxFor(view));
      expect(Math.abs(at.x), `${view} across`).toBeLessThan(0.5);
      expect(at.y, `${view} up`).toBeLessThan(boxFor(view).bottom);
    }
  });

  it("sits him LOW in a side band, which is what leaves a horizon in the frame", () => {
    // The lower the rider, the further ABOVE him the lens is aimed — see
    // `SIDE_LOW`. A side band with him level with the card is a frame with
    // nothing but water in it.
    expect(anchorFor(boxFor("desktop")).y).toBeLessThan(-0.4);
  });

  it("answers with a point even when there is no card to measure", () => {
    const at = anchorFor(null);
    expect(Math.abs(at.x)).toBeLessThan(0.9);
    expect(Math.abs(at.y)).toBeLessThan(0.9);
  });
});

describe("the framing solve (aimFor)", () => {
  const eye = { x: 0, y: MENU_CAM.height, z: 0 };
  const craft = { x: 42, y: 0.4, z: 58 };

  it("lands the craft on the point it was asked for, at every viewport's shape", () => {
    for (const view of Object.keys(VIEWS) as (keyof typeof VIEWS)[]) {
      const { w, h } = VIEWS[view];
      const aspect = w / h;
      const at = anchorFor(boxFor(view));
      const look = { x: 0, y: 0, z: 0 };
      aimFor(
        { x: craft.x - eye.x, y: craft.y - eye.y, z: craft.z - eye.z },
        at,
        MENU_CAM.fov,
        aspect,
        look,
      );
      const pose: CameraPose = {
        ...eye,
        aimX: eye.x + look.x * 100,
        aimY: eye.y + look.y * 100,
        aimZ: eye.z + look.z * 100,
        fov: MENU_CAM.fov,
        roll: 0,
      };
      const got = screenOf(pose, aspect, craft);
      expect(got.ahead, `${view} is in front of the lens`).toBeGreaterThan(0);
      expect(got.x, `${view} across`).toBeCloseTo(at.x, 1);
      expect(got.y, `${view} up`).toBeCloseTo(at.y, 1);
    }
  });

  it("is not mirrored: a rider asked into the LEFT of the frame lands left", () => {
    // The fault this whole file exists for. A sign error in the lens's own
    // right hands back a pose that is perfectly consistent with itself and
    // puts the rider in the opposite band — which, on a card, is the band the
    // menu is over.
    const look = { x: 0, y: 0, z: 0 };
    aimFor(
      { x: craft.x - eye.x, y: craft.y - eye.y, z: craft.z - eye.z },
      { x: -0.7, y: -0.6 },
      MENU_CAM.fov,
      16 / 9,
      look,
    );
    const pose: CameraPose = {
      ...eye,
      aimX: eye.x + look.x * 100,
      aimY: eye.y + look.y * 100,
      aimZ: eye.z + look.z * 100,
      fov: MENU_CAM.fov,
      roll: 0,
    };
    expect(screenOf(pose, 16 / 9, craft).x).toBeLessThan(0);
  });
});

describe("where the lens may stand (seawardFrom, standoffFor)", () => {
  const shores: Level[] = LEVEL_SEEDS.map((seed) => levelFor(seed));

  it("picks the most open bearing on the ring, never a local slope", () => {
    // The claim the ring exists for. A rider sits in the MIDDLE of his
    // channel, which is a ridge of the offshore field: the slope there is
    // noise, and on three taiga seeds it pointed inland. Asked at the
    // distance the lens wants to stand, the question answers itself.
    for (const level of shores) {
      const { x, z } = level.start;
      const at = (bearing: number): number =>
        sampleField(
          level.offshore,
          x + Math.sin(bearing) * MENU_CAM.range,
          z + Math.cos(bearing) * MENU_CAM.range,
        );
      const chosen = at(seawardFrom(level, x, z));
      for (let i = 0; i < MENU_CAM.rays; i++) {
        expect(chosen, `seed ${level.seed}`).toBeGreaterThanOrEqual(
          at((i / MENU_CAM.rays) * Math.PI * 2) - 1e-6,
        );
      }
    }
  });

  it("stands the lens over water, on every shore the corpus carries", () => {
    for (const level of shores) {
      const { x, z } = level.start;
      const out = seawardFrom(level, x, z);
      const range = standoffFor(level, x, z, 0, out, MENU_CAM.height);
      const ex = x + Math.sin(out) * range;
      const ez = z + Math.cos(out) * range;
      // The floor answer is the honest "nowhere to stand" — everywhere else
      // the lens is afloat by the margin the shot asks for.
      if (range > MENU_CAM.rangeMin) {
        expect(bedAt(level, ex, ez), `seed ${level.seed}`).toBeLessThan(-MENU_CAM.afloat);
      }
      expect(range).toBeGreaterThanOrEqual(MENU_CAM.rangeMin);
      expect(range).toBeLessThanOrEqual(MENU_CAM.range);
    }
  });

  it("takes the LONGEST clear standoff, so open water gets the whole shot", () => {
    // Searched inwards from the furthest rather than outwards from the
    // nearest: a channel gets what it has, and water with room in it gets the
    // composition the numbers were chosen for. Most starts have that room —
    // this is the claim that a search which merely SUCCEEDS is not enough.
    const full = shores.filter((level) => {
      const { x, z } = level.start;
      return (
        standoffFor(level, x, z, 0, seawardFrom(level, x, z), MENU_CAM.height) === MENU_CAM.range
      );
    });
    expect(full.length).toBeGreaterThan(shores.length / 2);
  });
});

describe("the shot itself", () => {
  const game = createGame({ seed: LEVEL_SEEDS[0], craft: "skiff", quiet: true });
  const flat = (): number => 0;
  const frame = { aspect: 16 / 9, card: boxFor("desktop") };

  /** WHAT THE SHOT IS COMPOSED ON: the rider's head rather than the keel
   * (`MENU_CAM.aimUp`), which at seventy metres is worth a twentieth of the
   * frame — enough that a case checking the hull's own origin would be
   * checking the wrong point. */
  const rider = () => ({ x: game.craft.x, y: game.craft.y + MENU_CAM.aimUp, z: game.craft.z });

  function poseAfter(seconds: number): CameraPose {
    const drone = createMenuCamera();
    const pose: CameraPose = { x: 0, y: 0, z: 0, aimX: 0, aimY: 0, aimZ: 1, fov: 60, roll: 0 };
    for (let i = 0; i < Math.round(seconds / DT); i++) {
      drone.update(pose, game, DT, flat, frame);
    }
    return pose;
  }

  it("stands a dozen storeys up, clear of whatever is under it", () => {
    const pose = poseAfter(2);
    expect(pose.y).toBeGreaterThan(MENU_CAM.height - MENU_CAM.heightSway - 1);
    expect(pose.y).toBeGreaterThan(bedAt(game.level, pose.x, pose.z) + MENU_CAM.clearance - 0.01);
  });

  it("holds the rider in the band on the very first frame, with nothing eased onto", () => {
    // A card goes up and the shot is ALREADY composed: the drone is cut to
    // rather than flown to (`camera.ts`), so a first frame that were still
    // arriving would be the first frame of every visit to the front door.
    const pose = poseAfter(DT);
    const at = screenOf(pose, frame.aspect, rider());
    const want = anchorFor(frame.card);
    expect(at.x).toBeCloseTo(want.x, 1);
    expect(at.y).toBeCloseTo(want.y, 1);
  });

  it("keeps him there while the shot drifts, banking into its own drift", () => {
    const want = anchorFor(frame.card);
    let banked = 0;
    const drone = createMenuCamera();
    const pose: CameraPose = { x: 0, y: 0, z: 0, aimX: 0, aimY: 0, aimZ: 1, fov: 60, roll: 0 };
    for (let i = 0; i < Math.round(40 / DT); i++) {
      drone.update(pose, game, DT, flat, frame);
      banked = Math.max(banked, Math.abs(pose.roll));
      if (i % 600 === 0) {
        const at = screenOf(pose, frame.aspect, rider());
        expect(at.x, `across at ${(i * DT).toFixed(0)} s`).toBeCloseTo(want.x, 1);
        expect(at.y, `up at ${(i * DT).toFixed(0)} s`).toBeCloseTo(want.y, 1);
      }
    }
    // The bank is read off the drift's own rate and is small by design —
    // a machine holding an arc, not one thrown into a turn.
    expect(banked).toBeGreaterThan(0);
    expect(banked).toBeLessThanOrEqual((MENU_CAM.bankMax * Math.PI) / 180 + 1e-9);
  });

  it("MOVES — nothing in the frame is ever quite still", () => {
    // The whole difference between drone footage and a photograph. Three
    // breaths on different rates plus the drift, so no two of them ever come
    // round together; this only has to catch a shot that has stopped.
    const first = poseAfter(2);
    const later = poseAfter(25);
    expect(Math.hypot(later.x - first.x, later.y - first.y, later.z - first.z)).toBeGreaterThan(1);
    expect(Math.abs(later.fov - first.fov)).toBeGreaterThan(0.1);
  });

  it("is a LONG lens, longer than any rung a rider steers from", () => {
    // A rider needs to see what he is about to hit and every rung on the
    // ladder is 52° or wider for it; nobody here is about to hit anything,
    // and the length is what keeps the rider legible at eighty metres.
    expect(MENU_CAM.fov + MENU_CAM.fovSway).toBeLessThan(52);
  });

  it("keeps the rider inside the range the haze leaves him legible at", () => {
    // What put the ceiling on the height and the standoff: past about eighty
    // metres the game's heaviest skies take the contrast out of a hull, and a
    // front door whose rider is a grey smudge has failed at its one job.
    const pose = poseAfter(3);
    const reach = Math.hypot(game.craft.x - pose.x, game.craft.y - pose.y, game.craft.z - pose.z);
    expect(reach).toBeLessThan(90);
  });
});

describe("the card, measured (cardBox)", () => {
  it("flips the DOM's axis: the top of the card is the TOP of the frame", () => {
    const box = cardBox({ left: 0, right: 100, top: 0, bottom: 50 }, 100, 100);
    expect(box.left).toBeCloseTo(-1, 6);
    expect(box.right).toBeCloseTo(1, 6);
    expect(box.top).toBeCloseTo(1, 6);
    expect(box.bottom).toBeCloseTo(0, 6);
  });

  it("survives a viewport that has not been laid out yet", () => {
    const box = cardBox({ left: 0, right: 0, top: 0, bottom: 0 }, 0, 0);
    for (const v of Object.values(box)) expect(Number.isFinite(v)).toBe(true);
  });
});
