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
  reframeEase,
  seawardFrom,
  standoffFor,
  type ScreenBox,
  type ScreenPoint,
} from "../pwa/src/game/camera-menu.ts";
import { cameraFor, cardBox, composesCard } from "../pwa/src/game/live-camera.ts";
import {
  CAMERA_MODES,
  WATCHING_MODES,
  createCameraRig,
  type CameraPose,
} from "../pwa/src/game/camera.ts";
import { BENCHMARK } from "../pwa/src/game/benchmark-plan.ts";
import { mergeSettings } from "../pwa/src/game/settings.ts";
import { readParams } from "../pwa/src/game/url-params.ts";

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

  it("takes the FLOOR over the ceiling, even where the ceiling is roomier", () => {
    // A phone held upright with a tall card is exactly this: a deeper band
    // above than below, and the rider put up there is small, hazed and
    // inside the softening's own ramp. `BAND_WORTH` is what says the near
    // water is worth more than the far — up to nearly twice the room.
    const taller = { left: -0.95, right: 0.95, top: 0.2, bottom: -0.45 };
    expect(1 - taller.top).toBeGreaterThan(taller.bottom + 1);
    expect(anchorFor(taller).y).toBeLessThan(taller.bottom);
    // ...and it is a preference, not a law: a ceiling with twice the room
    // still wins, because by then there is nowhere else worth being.
    const noFloor = { left: -0.95, right: 0.95, top: -0.1, bottom: -0.93 };
    expect(anchorFor(noFloor).y).toBeGreaterThan(noFloor.top);
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

describe("the walk between bands (reframeEase)", () => {
  it("starts and ends flat, and covers the whole move", () => {
    // The edge is what the jump WAS, so an ease that leaves at full speed
    // (an exponential, which is what every other quantity in this shot
    // tracks its target on) would take out only half the complaint.
    expect(reframeEase(0)).toBe(0);
    expect(reframeEase(1)).toBe(1);
    expect(reframeEase(0.5)).toBeCloseTo(0.5, 6);
    expect(reframeEase(0.02) / 0.02).toBeLessThan(0.2);
    expect((1 - reframeEase(0.98)) / 0.02).toBeLessThan(0.2);
    // ...and it never runs off either end, whatever it is handed.
    expect(reframeEase(-1)).toBe(0);
    expect(reframeEase(9)).toBe(1);
    let last = -1;
    for (let i = 0; i <= 20; i++) {
      const s = reframeEase(i / 20);
      expect(s).toBeGreaterThan(last);
      last = s;
    }
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

  it("prefers to stand ASTERN of the rider's course, and gives it up to the water", () => {
    // The pull is worth `asternPull` metres of openness the bearing does not
    // have: enough to decide between two the water has no strong opinion
    // about, never enough to stand the lens in a wood.
    for (const level of shores) {
      const { x, z } = level.start;
      const plain = seawardFrom(level, x, z);
      const at = (bearing: number): number =>
        sampleField(
          level.offshore,
          x + Math.sin(bearing) * MENU_CAM.range,
          z + Math.cos(bearing) * MENU_CAM.range,
        );
      for (const astern of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const pulled = seawardFrom(level, x, z, MENU_CAM.range, astern);
        // Whatever it picked, it is a bearing the pull could pay for: the
        // openness it gave up is inside the pull's own budget.
        expect(at(plain) - at(pulled), `seed ${level.seed}`).toBeLessThanOrEqual(
          2 * MENU_CAM.asternPull + 1e-6,
        );
      }
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

  it("WALKS him to a new band when the card changes — a page turn is not a cut", () => {
    // THE COMPLAINT THIS ANSWERS: clicking around the front door made the
    // background jump. `anchorFor` PICKS a band, and a pick is a step — every
    // page is a different card (30 rem at the door, 36 at OPTIONS, 52 at the
    // gallery), and the attract card is no card at all — so the rider used to
    // cross the frame in ONE frame whenever the card under him changed.
    //
    // Measured through the projection like every other framing claim here, so
    // what is checked is where the rider actually IS rather than what the
    // anchor holds. The walk chosen is the attract card's cover giving way to
    // the front door's, which is the biggest one the shell asks for and the
    // one a boot onto the door plays every time.
    const frame = { aspect: 16 / 9, card: null as ScreenBox | null };
    const drone = createMenuCamera();
    const pose: CameraPose = { x: 0, y: 0, z: 0, aimX: 0, aimY: 0, aimZ: 1, fov: 60, roll: 0 };
    const fly = (seconds: number): void => {
      for (let i = 0; i < Math.round(seconds / DT); i++) drone.update(pose, game, DT, flat, frame);
    };
    const where = (): ScreenPoint => screenOf(pose, frame.aspect, rider());
    const apart = (a: ScreenPoint, b: ScreenPoint): number => Math.hypot(a.x - b.x, a.y - b.y);

    fly(3);
    const opened = where();
    frame.card = boxFor("desktop");
    const want = anchorFor(frame.card);
    const walk = apart(opened, want);
    // The case is only worth anything if the page turn really does move him.
    expect(walk).toBeGreaterThan(0.2);

    // THE FRAME THE CARD CHANGES ON: he has barely left. A cut lands the
    // whole walk here, and the ease is flat at both ends, so a quarter of it
    // is a wide margin around "essentially nothing".
    fly(DT);
    expect(apart(where(), opened)).toBeLessThan(walk * 0.25);

    // ...half way through, genuinely on his way — neither still standing in
    // the old band nor already arrived in the new one.
    fly(MENU_CAM.reframe / 2);
    const crossing = apart(where(), opened) / walk;
    expect(crossing).toBeGreaterThan(0.1);
    expect(crossing).toBeLessThan(0.9);

    // ...and there when the walk is over, held as tightly as any other frame.
    fly(MENU_CAM.reframe / 2 + 0.3);
    const arrived = where();
    expect(arrived.x).toBeCloseTo(want.x, 1);
    expect(arrived.y).toBeCloseTo(want.y, 1);
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

  it("does NOT take the hull's bob into the frame", () => {
    // THE CALMNESS CLAIM, measured. The framing is solved every frame, so a
    // shot composed on the craft's own position tracks every heave and slam
    // straight into the aim; composed on a point that lags him by about a
    // second (`MENU_CAM.compose`) the RIDER moves and the frame does not.
    //
    // Measured as the DIFFERENCE between two shots run in lockstep, one over
    // a bobbing hull and one over a still one — everything the shot does on
    // its own (the height's breath, the standoff's, the lens's, the drift,
    // the tremor) is a function of its own clock and cancels, so what is left
    // is the bob's contribution and nothing else. A 3 Hz bob of ±0.6 m is a
    // hull crossing chop.
    const bobbing = createGame({ seed: LEVEL_SEEDS[0], craft: "skiff", quiet: true });
    const still = createGame({ seed: LEVEL_SEEDS[0], craft: "skiff", quiet: true });
    const one = createMenuCamera();
    const two = createMenuCamera();
    const poseA: CameraPose = { x: 0, y: 0, z: 0, aimX: 0, aimY: 0, aimZ: 1, fov: 60, roll: 0 };
    const poseB: CameraPose = { ...poseA };
    const base = still.craft.y;
    const elevation = (pose: CameraPose): number =>
      Math.atan2(pose.aimY - pose.y, Math.hypot(pose.aimX - pose.x, pose.aimZ - pose.z));
    let low = Infinity;
    let high = -Infinity;
    let hullLow = Infinity;
    let hullHigh = -Infinity;
    for (let i = 0; i < Math.round(6 / DT); i++) {
      bobbing.craft.y = base + 0.6 * Math.sin(2 * Math.PI * 3 * i * DT);
      one.update(poseA, bobbing, DT, flat, frame);
      two.update(poseB, still, DT, flat, frame);
      // Past the first second, so the ease has settled onto the hull.
      if (i * DT < 1) continue;
      const took = elevation(poseA) - elevation(poseB);
      low = Math.min(low, took);
      high = Math.max(high, took);
      // ...against what a lens aimed straight AT the hull would have taken.
      const raw = Math.atan2(
        bobbing.craft.y - poseB.y,
        Math.hypot(bobbing.craft.x - poseB.x, bobbing.craft.z - poseB.z),
      );
      hullLow = Math.min(hullLow, raw);
      hullHigh = Math.max(hullHigh, raw);
    }
    const framed = ((high - low) * 180) / Math.PI;
    const hull = ((hullHigh - hullLow) * 180) / Math.PI;
    // The hull's own swing is about a degree at this range; what reaches the
    // frame is a small fraction of it.
    expect(hull).toBeGreaterThan(0.5);
    expect(framed).toBeLessThan(hull / 5);
  });

  it("keeps a rider who is RIDING inside the band the card left him", () => {
    // ...and the other half of the same knob: the lag is LEASHED, so a rider
    // who has simply ridden away is not framed where he was a second ago.
    const ride = createGame({ seed: LEVEL_SEEDS[0], craft: "skiff", quiet: true });
    const drone = createMenuCamera();
    const pose: CameraPose = { x: 0, y: 0, z: 0, aimX: 0, aimY: 0, aimZ: 1, fov: 60, roll: 0 };
    const box = frame.card as ScreenBox;
    for (let i = 0; i < Math.round(30 / DT); i++) {
      // A steady 18 m/s along the shore, with the hull working in a seaway.
      ride.craft.vx = 18;
      ride.craft.vz = 0;
      ride.craft.x += 18 * DT;
      ride.craft.y = 0.4 + 0.5 * Math.sin(2 * Math.PI * 1.4 * i * DT);
      drone.update(pose, ride, DT, flat, frame);
      if (i * DT < 1) continue;
      const at = screenOf(pose, frame.aspect, ride.craft);
      expect(inside(box, at), `under the card at ${(i * DT).toFixed(0)} s`).toBe(false);
      expect(Math.abs(at.x), `across at ${(i * DT).toFixed(0)} s`).toBeLessThan(1);
      expect(Math.abs(at.y), `up at ${(i * DT).toFixed(0)} s`).toBeLessThan(1);
    }
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

describe("the drone is the MENU's and nobody else's", () => {
  // It frames a card rather than the water ahead of a rider: the guide line
  // is off under it, the course is furniture, and a rider handed it mid-run
  // would be steering a hull he can barely see from a lens that is composing
  // around a menu that is not there. So every door onto it is shut except
  // one — a card going up (`live-camera.ts`) — and these are the doors.

  it("is the rung EVERY card over the sea gets, from the attract card on", () => {
    // The flicker this answers: the attract card's cover is opaque but it
    // FADES, so a surface whose camera waited on its own card reaching the
    // DOM spent that fade revealing the last thing the lens was on. Both
    // cards get the drone, and `App.tsx` settles the rung off this BEFORE
    // the first frame of a shore is drawn.
    expect(cameraFor("splash", "chase")).toBe("menu");
    expect(cameraFor("menu", "chase")).toBe("menu");
  });

  it("is NOT what any surface somebody rides, watches or times gets", () => {
    for (const shell of ["run", "pause", "replay", "bench", "loading"] as const) {
      expect(cameraFor(shell, "chase"), shell).toBe("chase");
      expect(composesCard(shell), shell).toBe(false);
    }
  });

  it("is on neither ladder the camera key walks", () => {
    expect(CAMERA_MODES).not.toContain("menu");
    expect(WATCHING_MODES).not.toContain("menu");
  });

  it("cannot be cycled onto, and the key walks OFF it", () => {
    const rig = createCameraRig();
    rig.setMode("menu");
    expect(rig.mode()).toBe("menu");
    // A rung the live ladder does not carry walks to its head.
    expect(rig.cycle()).toBe(CAMERA_MODES[0]);
    // ...and no amount of walking comes back round to it, on either ladder.
    for (const ladder of [CAMERA_MODES, WATCHING_MODES]) {
      rig.setLadder(ladder);
      for (let i = 0; i < ladder.length + 1; i++) {
        expect(rig.cycle()).not.toBe("menu");
      }
    }
  });

  it("cannot be read out of a stored blob", () => {
    // `mergeSettings` checks every value against what this build OFFERS, and
    // the drone is not on the ladder it offers.
    const merged = mergeSettings({ ride: { camera: "menu" } });
    expect(merged.ride.camera).not.toBe("menu");
  });

  it("cannot be asked for by a link", () => {
    expect(readParams("?camera=menu").camera).toBeUndefined();
    // ...where a rung that IS on the ladder comes through.
    expect(readParams("?camera=heli").camera).toBe("heli");
  });

  it("is not what the benchmark is scored from", () => {
    // The stopwatch times a RACE, and a frame drawn from a lens nobody rides
    // is not the frame the score is about (`benchmark-plan.ts` says so too).
    expect(BENCHMARK.camera).not.toBe("menu");
    expect(CAMERA_MODES).toContain(BENCHMARK.camera);
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
