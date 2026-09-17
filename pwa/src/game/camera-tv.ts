// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TV CAM — the run as a broadcast rather than as a ride, and the only
// camera in the game that is not hung off the craft.
//
// Every rung of the ladder (`camera.ts`) stands somewhere on or behind the
// hull and goes where it goes. This one is a LENS PLANTED ON THE WATER, off
// to one side of a moment the recording already knows is coming, and the only
// thing that happens while the run plays is that the craft arrives at it.
// Nothing follows. The craft comes.
//
// THREE DECISIONS MAKE IT READ AS TELEVISION rather than as a buoy with a
// webcam on it:
//
//   THE STAND IS OFF TO THE SIDE AND OUT TO SEA. Beside the line the craft is
//   about to take, low enough that a hull off a ramp is against the SKY —
//   which is the only angle a flight has a shape in at all, the same reading
//   that puts the chase boom where it is (camera-rigs.ts) — and far enough
//   along that the craft is still coming at the lens through the whole of the
//   thing worth watching. SEAWARD where the coast says which way that is: a
//   camera boat stands off the shore, and a lens planted between a rider and
//   the beach photographs him against granite instead of against water.
//
//   THE OPERATOR IS SLOW. The aim lags the craft (`pan`), so a hull going
//   past leads the frame and the lens catches up after it — what a human on a
//   tripod does and what a rig bolted to a transom never does.
//
//   THE LENS BREATHES. It holds about `frame` metres of world across at
//   whatever range the craft is, so a craft two hundred metres out is a long
//   lens on a speck and the same craft arriving is wide open — and the zoom
//   is deliberately too slow to keep up, so it is still long as he arrives
//   (which is what makes the arrival sudden) and still wide for a beat after
//   he has gone (which is the operator catching up). A zoom that tracked the
//   solve exactly would be a rubber band with a jetski in it.
//
// ALL THREE ARE CHOICES MADE FOR AN AUDIENCE, WHICH IS WHY NOBODY RIDES FROM
// IT. A lens framed on the ramp a rider is arriving at has the water beyond
// it off the frame, and the cut lands at the moment he most needs to be
// reading the next gate. So it is off `CAMERA_MODES` — the ladder the camera
// key walks and the OPTIONS row lists — and reachable in the one place nobody
// is steering: a REPLAY, which opens on it (`replay.ts`).
//
// WHICH MOMENT, WHEN THE CUT LANDS AND HOW SLOWLY THE PICTURE RUNS ARE NOT
// THIS FILE'S — that is `replay-shots.ts`, which knows the future because the
// run wrote it down. Everything here is what a lens does once it has been
// handed a shot.
//
// Three-free, like the rest of the camera: this turns a shot into a
// `CameraPose` and `renderer.ts` applies it.

import { angleDiff, bedAt, type GameState, type Level } from "@engine";

import { clamp } from "../lib/util.ts";
import type { CameraPose } from "./camera.ts";
import type { ReplayShot } from "./replay-shots.ts";

/** The whole camera, as numbers. Metres, seconds and degrees. */
export const TV = {
  /** How far to the side of the craft's own line the lens stands, m, and
   * what it gains per m/s of the pace the moment happens at — a hull doing
   * 30 m/s past a lens at ten metres is two frames of blur. */
  out: 8,
  outPerSpeed: 0.34,
  outMin: 7,
  outMax: 22,
  /** How far ALONG that line the stand sits: a fixed bias, m, plus this
   * share of the ground the craft covers during the thing worth watching.
   * Just over half, so the lens is beside the apex of a flight rather than
   * at either end of it, and the craft is still closing for most of the
   * shot. */
  ahead: 12,
  alongShare: 0.55,
  /** ...and the MOST it is placed ahead, m. This is a TRIPOD: a lens planted
   * four hundred metres down the course is not beside the action, it is a
   * lens with the action four hundred metres away, and at that range the
   * craft is inside the haze and the shot is a picture of some sea. The cap
   * binds on exactly the moments whose length the collector cannot know is
   * honest — a hull carried half a kilometre by the tornado is one flight —
   * and on nothing a rider would recognise as a jump. */
  alongMax: 55,
  /** How high the lens is held over the sea under it, m. LOW, and on
   * purpose: the one thing a trackside lens can show that the boom cannot is
   * a hull with sky under it, and every metre of lift trades sky for water. */
  lift: 1.5,
  /** How far over the craft's own height the aim sits, m — the rider's head
   * rather than the keel. */
  aimUp: 1,
  /** How fast the aim follows, 1/s. Loose on purpose; see the header. */
  pan: 4.5,
  /** THE ZOOM. `frame` is the width of world the lens tries to hold at the
   * craft, m — a decision about how big the CRAFT is in shot, so it is sized
   * to the craft: about five hull lengths, which puts it a fifth of the frame
   * across at the range the operator is holding. Sized to the SEA instead
   * (a comfortable forty metres) a craft a hundred metres out is four pixels
   * and the shot is a picture of some water. */
  frame: 15,
  /** The ceiling on the zoom, deg, and the other end. `fovMin` is what lets
   * the long end be long: at 24° a craft two hundred metres out is still a
   * speck, and the whole drama of a trackside shot is a dot that becomes a
   * jetski. `fovMax` is wide enough that one passing eight metres away is
   * still inside the frame rather than cropped to a sponson. */
  fovMin: 11,
  fovMax: 70,
  /** How fast the lens works, 1/s. Slower than the pan, and deliberately not
   * fast enough to keep up. */
  zoom: 2.8,
  /** The least range the lens will solve for, m — a hull that comes THROUGH
   * the stand must not take the fov to a hemisphere on one frame. */
  near: 5,
  /** How much water there has to be UNDER a stand, m. A tripod is a camera
   * boat: planted on a skerry it is a lens inside a rock, and planted up the
   * beach it is a lens inside a hillside — and both come back as a dark
   * polygon filling the frame rather than as anything a viewer could read as
   * a mistake. Deep enough to clear a shoal a boat would not sit on. */
  afloat: 1.6,
  /** ...and how far a stand keeps off a solid, m, on top of the solid's own
   * radius: a lens a metre from a skerry is a lens with a skerry across half
   * of it. */
  clear: 9,
  /** How much further out the stand is pushed when the water where it wanted
   * to be is fouled, m, and how many times. Pushing OUT rather than in or
   * along, because the standoff is the one number the framing can give up
   * without the shot becoming a different shot — it costs reach on the lens
   * and nothing else. */
  pushOut: 6,
  pushes: 3,
};

/** Where a lens has been planted. Fixed for the life of the shot: a tripod
 * does not move, and one that eased toward the action would be a drone. */
export type Stand = { x: number; y: number; z: number };

/** WHETHER A CAMERA BOAT COULD SIT HERE: water under it, and no rock in it.
 * A stand is planted off a pose the run recorded rather than off anything the
 * lens can see, so nothing else stops it landing on a skerry or up the beach
 * — and either is a dark polygon filling the frame, which reads as a broken
 * renderer rather than as a badly chosen angle. */
export function clearWater(level: Level, x: number, z: number): boolean {
  if (bedAt(level, x, z) > -TV.afloat) return false;
  for (const solid of level.solids) {
    const r = solid.r + TV.clear;
    const dx = x - solid.x;
    const dz = z - solid.z;
    if (dx * dx + dz * dz < r * r) return false;
  }
  return true;
}

export type TvCamera = {
  /** Frame `shot` from the stand it earns, and write the pose. A shot this
   * camera has not seen before lands as a CUT — the aim and the lens are
   * snapped rather than eased, because the two readings are of a craft that
   * was in the last shot and is not in this one.
   *
   * FALSE where there is nowhere on the water to stand a lens for this
   * moment, and then the pose is not written at all: the caller keeps the
   * boom, which is what a director does with a corner no crew could get to.
   *
   * `surfaceY` is the sea's height at a plan point, the same function the
   * outside rigs floor themselves on. */
  update: (
    pose: CameraPose,
    shot: ReplayShot,
    state: GameState,
    dt: number,
    surfaceY: (x: number, z: number) => number,
  ) => boolean;
  /** Forget the live stand, so the next shot lands as a cut whatever it is.
   * Wanted whenever something else has had the frame in between. */
  drop: () => void;
};

/** WHICH SIDE OF THE CRAFT'S LINE THE LENS STANDS ON: the seaward one, where
 * the coast has an opinion, and an alternating side where it does not.
 *
 * `Level.seaHeading` points at the open sea (R15). A stand to the RIGHT of
 * travel is at heading + 90°, so the seaward side is whichever of the two
 * lies within a right angle of it. Where the sea is dead ahead or dead astern
 * the two sides are equally wet and the choice is made on the shot's own step
 * instead, which keeps two shots in a row from being the same angle. */
export function standSide(shot: ReplayShot, seaHeading: number): 1 | -1 {
  const off = angleDiff(shot.heading + Math.PI / 2, seaHeading);
  const seaward = Math.cos(off);
  if (Math.abs(seaward) < 0.2) return shot.at % 2 === 0 ? 1 : -1;
  return seaward > 0 ? 1 : -1;
}

/** WHERE THE LENS IS PLANTED for a shot, before the craft has got anywhere
 * near it — or NULL where there is nowhere to stand one, in which case the
 * moment keeps the boom (`camera.ts`). Pure, so `tests/camera_tv_test.ts` can
 * hold the framing rules without a renderer.
 *
 * The preferred side is the seaward one; a fouled stand is tried on the other
 * side and then pushed further out on both, in that order, because the SIDE
 * is a decision about the shot and the standoff is only a decision about the
 * lens. Refusing outright is the last answer rather than the first: a shot
 * that lands on the boom is a shot nobody notices, and a shot that lands
 * inside a skerry is the only kind a viewer reads as a bug. */
export function standFor(
  shot: ReplayShot,
  level: Level,
  dt: number,
  surfaceY: (x: number, z: number) => number,
): Stand | null {
  const first = standSide(shot, level.seaHeading);
  const fx = Math.sin(shot.heading);
  const fz = Math.cos(shot.heading);
  // Right of travel, as the rest of the renderer reads it: forward is
  // (sin h, cos h), so right is its derivative in h.
  const rx = Math.cos(shot.heading);
  const rz = -Math.sin(shot.heading);
  const reach = shot.speed * shot.runs * dt;
  const along = Math.min(TV.alongMax, TV.ahead + reach * TV.alongShare);
  const want = clamp(TV.out + shot.speed * TV.outPerSpeed, TV.outMin, TV.outMax);
  for (let push = 0; push <= TV.pushes; push++) {
    const out = want + push * TV.pushOut;
    for (const side of [first, -first as 1 | -1]) {
      const x = shot.x + fx * along + rx * out * side;
      const z = shot.z + fz * along + rz * out * side;
      if (clearWater(level, x, z)) return { x, y: surfaceY(x, z) + TV.lift, z };
    }
  }
  return null;
}

export function createTvCamera(): TvCamera {
  /** The shot the live stand was planted for, by its own step — a run has
   * only one moment at any step, so this is what a shot is recognised by from
   * one frame to the next. -1 off a shot. */
  let live = -1;
  /** The stand for the live shot, and null on one there was nowhere to stand
   * a lens for — held either way, so the decision is made once at the cut and
   * the frame does not flicker between the tripod and the boom. */
  let stand: Stand | null = null;
  const aim = { x: 0, y: 0, z: 0 };
  let fov = TV.fovMax;

  return {
    drop: () => {
      live = -1;
      stand = null;
    },
    update: (pose, shot, state, dt, surfaceY) => {
      const cut = shot.at !== live;
      if (cut) {
        live = shot.at;
        stand = standFor(shot, state.level, dt, surfaceY);
      }
      if (!stand) return false;
      const c = state.craft;
      const toX = c.x;
      const toY = c.y + TV.aimUp;
      const toZ = c.z;
      if (cut) {
        aim.x = toX;
        aim.y = toY;
        aim.z = toZ;
      } else {
        const follow = clamp(TV.pan * dt, 0, 1);
        aim.x += (toX - aim.x) * follow;
        aim.y += (toY - aim.y) * follow;
        aim.z += (toZ - aim.z) * follow;
      }
      // The lens, solved from how far away the craft is so it fills about
      // `frame` of world however far out it is — then eased, badly, on
      // purpose.
      const range = Math.max(TV.near, Math.hypot(toX - stand.x, toY - stand.y, toZ - stand.z));
      const want = clamp(
        (2 * Math.atan(TV.frame / (2 * range)) * 180) / Math.PI,
        TV.fovMin,
        TV.fovMax,
      );
      fov = cut ? want : fov + (want - fov) * clamp(TV.zoom * dt, 0, 1);
      pose.x = stand.x;
      pose.y = stand.y;
      pose.z = stand.z;
      pose.aimX = aim.x;
      pose.aimY = aim.y;
      pose.aimZ = aim.z;
      pose.fov = fov;
      pose.roll = 0;
      return true;
    },
  };
}
