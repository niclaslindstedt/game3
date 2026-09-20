// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MENU DRONE — the shot the front door and the attract card stand over,
// and the only camera in the game framed around something that is not in the
// picture: the CARD.
//
// Every other rung of the ladder (`camera.ts`) is framed for a rider who is
// steering, so the craft sits where a rider needs it — low, centred, with the
// water he is about to cross filling the frame. Behind a card none of that is
// true. Nobody is steering, the middle of the screen is a menu, and the only
// thing the picture owes anybody is that the game is plainly RUNNING. So this
// rung inverts the framing: the lens goes a long way up, the craft is held out
// in the band of frame the card does not cover, and the sea between them is
// the shot.
//
// FOUR DECISIONS MAKE IT READ AS DRONE FOOTAGE rather than as a camera that
// has been parked:
//
//   IT HOLDS A BEARING, NOT THE CRAFT'S. The lens stands off on a compass
//   bearing that drifts on two slow, incommensurate sinusoids — a couple of
//   minutes to come round, never the same way twice — and the craft turns
//   underneath it. A rig hung off the hull's heading swings the whole world
//   every time the bot carves; this one keeps the shore where it was and lets
//   the rider wander through it, which is what an operator holding a position
//   actually gets.
//
//   IT TRAILS THE RIDER'S AVERAGED COURSE. Where the lens stands is not only
//   a question of where the water is: it is preferred ASTERN of the direction
//   the rider has been going, heavily averaged over several seconds, so the
//   shot looks along his line with his wake running toward the lens. Averaged
//   is the whole point — a drone that answered his instantaneous heading
//   would swing the world round on every carve, which is the fault the first
//   version of this shot had by holding a fixed bearing instead and the fault
//   a naive follow would have by holding none.
//
//   IT IS COMPOSED ON A SMOOTHED RIDER, NOT AN INSTANTANEOUS ONE. The framing
//   is solved against a point that follows the craft on a slow ease and is
//   LEASHED to it (`MENU_CAM.compose`, `.leash`) — so a hull slamming through
//   a wave, bobbing in a seaway or twitching under the bot moves within the
//   frame instead of moving the frame. That is what an operator holding a
//   shot actually produces, and it is the difference between a lens that
//   looks flown and one that looks stuck to a transom. The leash is what
//   stops the rider wandering out of the band he was put in.
//
//   AND IT STANDS OVER WATER, WITH THE RIDER IN SIGHT. The drift is measured
//   off the direction the OPEN WATER lies in from wherever the rider is — the
//   gradient of the level's own offshore field, which is "away from the
//   nearest shore" and knows about the skerry two hundred metres out that a
//   coast's overall bearing (`Level.seaHeading`, R15) does not. Then the
//   standoff is pulled in until the lens is over water AND nothing stands
//   between it and the rider (`standoffFor`). Both halves are needed and
//   neither is dressing: a taiga start sits in a channel a hundred and fifty
//   metres wide, so a drone told to stand a hundred metres out on a compass
//   bearing is a drone in a pine wood with the rider behind a tree. That was
//   the first thing this shot did.
//
//   IT FLIES CLOSER WHEN IT CANNOT SEE. How far out the lens stands is scaled
//   by the sky the seed was dealt (R19, `flownIn`), because the one thing
//   this shot owes anybody is a rider they can SEE, and the haze under the
//   game's heaviest skies takes the contrast out of a hull well before the
//   framing runs out of room. It is also simply what an operator does: in
//   rain you fly lower and closer, and the picture is the better for it.
//
//   IT BREATHES. The height, the standoff and the lens all move on their own
//   slow cycles, so nothing in the frame is ever quite still even when the
//   craft is. None of them is fast enough to read as a move being made; all
//   of them together are what stops the shot reading as a photograph.
//
//   IT BANKS INTO ITS OWN DRIFT. The roll is read off the rate the bearing is
//   turning at, so the horizon tips a degree or two the way a machine holding
//   a slow arc tips, and comes back level when the drift does.
//
//   IT IS NOT QUITE STEADY. Two oscillators well under a hertz on the aim,
//   worth a fifth of a degree between them — under the threshold of anything
//   a viewer could point at, and over the threshold of a locked-off tripod.
//   (The `game-feel` rule for anything that vibrates a lens: incommensurate
//   oscillators on an envelope, never a fresh random offset per frame.)
//
// THE CRAFT IS PUT WHERE THE CARD IS NOT, and the card says where that is:
// `anchorFor` takes the card's own box — measured off the DOM and handed down
// in normalised device coordinates — and answers with the point in the frame
// the craft is to be held at. It picks the roomiest band around the card and
// sits the craft in the middle of it, which is the one rule that survives all
// three reference viewports on its own: the desktop's card leaves two deep
// side bands, the phone held UPRIGHT leaves a deep band top and bottom, and
// the phone on its SIDE — the worst of the three, a card nineteen twentieths
// of the width — leaves only the strip under it. Nothing here is a copy of
// the stylesheet's arithmetic, so a card that grows moves the rider by
// itself.
//
// …and the framing is solved rather than nudged. `aimFor` turns "hold the
// craft at this point in the frame" into an aim direction, given what the
// lens is worth at this viewport's shape (`camera-lens.ts`). That is why the
// rider lands in the same place on a 16:9 window and on a phone whose
// vertical field is half again as wide.
//
// THE PICTURE IS SOFTENED WITH DISTANCE, which is this shot's alone: see
// `MENU_CAM.dream`. Three-free and DOM-free like the rest of the camera —
// this turns a `GameState` and a frame into a `CameraPose`, and
// `renderer.ts` applies it.

import { angleDiff, bedAt, sampleField, type GameState, type Level } from "@engine";

import { clamp } from "../lib/util.ts";
import { frameTangents } from "./camera-lens.ts";
import type { CameraPose } from "./camera.ts";

const DEG = Math.PI / 180;

/** THE WHOLE SHOT, AS NUMBERS. Metres, seconds, radians and degrees. */
export const MENU_CAM = {
  /** How high over the sea the drone holds, m, and the amplitude of the
   * breath on it. Forty-odd metres is a dozen storeys — plainly a machine in
   * the air rather than a boom on a long arm — and it is as high as the shot
   * can go while a rider is still a rider: the hull subtends about a
   * twentieth of the frame's height from here, which with a wake behind it is
   * legible and no more.
   *
   * The HEIGHT is the fixed half of the shot and the STANDOFF is the half
   * that gives, which is the right way round for water this shape: how high a
   * drone may fly is its own decision, how far out it may stand is the
   * channel's.
   *
   * WHAT PUT THE CEILING HERE WAS THE WEATHER, not the framing. At 46 m and a
   * hundred metres out the shot was lovely under a clear sky and a GHOST
   * under the game's heaviest ones: the haze at that range takes most of the
   * contrast out of a hull, and a front door whose rider is a grey smudge in
   * the rain has failed at the one thing it is for. Everything here is sized
   * so the slant range to the rider stays inside about eighty metres, which
   * is where he is still plainly a rider under every sky R19 deals. */
  height: 34,
  heightSway: 5,
  /** The furthest back along the bearing the lens will stand in plan, m, its
   * breath, and the CLOSEST it will come in when the water runs out.
   *
   * HEIGHT OVER STANDOFF IS THE COMPOSITION: 34 over 72 is 25° down, a high
   * OBLIQUE with the coast across the top of the frame and a strip of sky
   * over it; 34 over 36 is 43°, most of the way to a plan view, with the
   * water filling the frame instead. The shot crosses that range as the
   * course leaves the shore and comes back to it, and it is meant to — the
   * framing is SOLVED at whatever it ends up at (`aimFor`), so what the
   * standoff changes is how much sea and sky are in the picture, never where
   * the rider is in it.
   *
   * The ladder's own `drone` rung is the opposite decision for the opposite
   * reason (`camera-rigs.ts`): it looks straight down because what it is FOR
   * — the wake's V, the line between two buoys — is only legible from there,
   * and it pays for it with a frame that has no sea in it. A card wants the
   * picture. */
  range: 72,
  rangeSway: 6,
  rangeMin: 36,
  /** How many bearings the ring that finds the open water is sampled at
   * (`seawardFrom`). */
  rays: 16,
  /** How many standoffs are tried on the way in from the first to the last.
   * Coarse on purpose: the answer is eased onto, so a step is a couple of
   * metres of drift rather than a jump, and a finer search would only buy
   * precision the breath above is already spending. */
  rangeSteps: 9,
  /** What the lens has to have under it to stand there, m of water — and how
   * tall the cover on a piece of ground is taken to be when asking whether it
   * is between the lens and the rider. The second is the pines: a bare
   * heightfield says a skerry is four metres high and the wood on it is
   * fifteen, and a sight line drawn over the rock goes straight through the
   * trees (`flora-defs.ts` is where they are actually sized). */
  afloat: 2,
  treeLine: 15,
  /** How briskly the base bearing eases onto the way the open water lies, and
   * the standoff onto what the water allows — both 1/s. Slow: these two are
   * the drone REPOSITIONING, and a reposition that arrives in a frame is a
   * cut. */
  bearingFollow: 0.5,
  rangeFollow: 0.7,
  /** THE DRIFT, as two incommensurate sinusoids on the bearing off the way
   * the open water lies: amplitude in rad and rate in rad/s. Together they
   * are worth about ±35° over a couple of minutes and never repeat inside a
   * visit — enough that the shore swings through the frame, little enough
   * that the lens stays on the water's own side of the rider. */
  driftA: 0.45,
  driftRateA: 0.034,
  driftB: 0.16,
  driftRateB: 0.089,
  /** ...and the rates the height, the standoff and the lens breathe at,
   * rad/s. All different, all prime-ish against the drift's, so no two of
   * them ever come round together. */
  heightRate: 0.047,
  rangeRate: 0.061,
  fovRate: 0.029,
  /** The lens at rest, deg, and how much of it the breath is worth. LONGER
   * than any rung on the ladder — every one of those is 52° or wider, because
   * a rider needs to see what he is about to hit. Nobody here is about to hit
   * anything, and a long lens buys the two things this shot wants: the rider
   * big enough to read at a hundred metres, and the compression that makes
   * the coast stack up behind him instead of running away. */
  fov: 38,
  fovSway: 2,
  /** THE BANK: degrees of lens roll per rad/s of bearing drift, and the most
   * it may ever be worth. Small — this is a machine holding an arc, not one
   * being thrown into a turn. */
  bankPerRate: 26,
  bankMax: 2.2,
  /** THE TREMOR on the aim: two oscillators, amplitude in deg and rate in
   * Hz. See the header — this is the difference between a drone and a
   * tripod, and it is deliberately under what anybody can name. */
  shakeA: 0.13,
  shakeHzA: 0.61,
  shakeB: 0.08,
  shakeHzB: 0.93,
  /** Metres the lens is held clear of whatever is under it — the sea, or the
   * shore when the drift carries it over the land. */
  clearance: 6,
  /** How briskly the LENS follows the craft's own plan position, 1/s — where
   * the stand is taken from, as against where the shot is aimed. Slow enough
   * that a chop does not walk the stand about. */
  follow: 2.2,
  /** How briskly the point the shot is COMPOSED ON follows the craft, 1/s,
   * and how far behind him it may ever fall, m.
   *
   * These two are what make the picture calm. The framing is solved every
   * frame (`aimFor`), so solving it against the craft's own position tracks
   * every slam, every heave and every twitch of the bot's steering straight
   * into the frame — the lens ends up glued to a hull that is not being
   * ridden smoothly, which is the opposite of what a drone shot looks like.
   * Solved against a point that lags him by about a second instead, the
   * RIDER moves within a frame that is holding still.
   *
   * The leash is the safety: three metres is worth an eighth of the frame's
   * height at this range, so he drifts around his anchor and can never be
   * carried out of the band the card left him. */
  compose: 0.9,
  leash: 3,
  /** THE RIDER'S OWN COURSE, averaged: how fast the average follows his
   * travel direction (1/s — a time constant of five or six seconds, which is
   * several carves), and the pace below which his direction is not worth
   * reading at all, m/s. A hull at rest in a seaway has a travel direction
   * made of nothing but the orbital motion under it. */
  courseFollow: 0.18,
  underway: 4,
  /** ...and what standing ASTERN of that average is worth to the ring that
   * picks the bearing, in metres of the open water it is scored against
   * (`seawardFrom`). Enough to decide between two bearings the water has no
   * strong opinion about, and nowhere near enough to stand the lens in a
   * wood: a couple of hundred metres of open sea beats it every time, which
   * is the order the two should be in. */
  asternPull: 22,
  /** How far up the frame the craft's own height is read from, m — the
   * rider's head rather than the keel, so he sits where he is aimed at. */
  aimUp: 1,
  /** HOW MUCH OF THE SHOT EACH SKY LEAVES, 0..1 on both the height and the
   * standoff together — so the DEPRESSION never moves and only the reach
   * does. Sized off what the haze does to a hull rather than off the sky's
   * own name: under clear air a rider reads at eighty metres and the shot is
   * flown whole; under rain he is a grey smudge there and a little over fifty
   * is the limit; a squall is the sky the game can least afford to lose him
   * in. `haze` is thinner than it sounds — it is a clear sky with the far
   * distance gone, which is this shot's own look anyway. */
  flownIn: {
    clear: 1,
    high: 1,
    haze: 0.9,
    overcast: 0.85,
    rain: 0.7,
    squall: 0.6,
  } as Record<string, number>,
  /** THE SOFTNESS, which is this shot's and no other's.
   *
   * A lens looking 55° down has its far distance at the TOP of the frame and
   * the water directly under it at the bottom, and the run of the picture
   * between them is very nearly a run of range. So the softening is a ramp up
   * the frame — a tilt-shift, the way an aerial plate is finished — rather
   * than anything that needs a depth buffer: `from` is the height up the
   * frame it starts at and `to` where it is fully on, both 0 at the bottom
   * and 1 at the top, and `radius` is what it is worth there in pixels at a
   * 1080-tall picture (`grade-pass.ts` scales it with the buffer, so a phone
   * and a desktop are softened by the same amount of PICTURE).
   *
   * It goes nowhere near the rider: the card's bands put him low or to the
   * side, and the ramp has barely started under the horizon. What it takes
   * out is the far shore and the haze behind it, which is exactly what makes
   * the frame read as a long lens looking down through air rather than as a
   * game paused behind a menu. */
  dream: { from: 0.38, to: 0.98, radius: 8 },
};

/** A box in NORMALISED DEVICE COORDINATES: −1 is the left and the bottom of
 * the frame, +1 the right and the top. What the app hands down when it has
 * measured the card standing over the sea. */
export type ScreenBox = { left: number; right: number; bottom: number; top: number };

/** Where in the frame the craft is held, in the same coordinates. */
export type ScreenPoint = { x: number; y: number };

/** HOW LOW A SIDE BAND SITS THE RIDER. A band at the side leaves the other
 * axis free, and the free axis is spent on the shot rather than on the card:
 * the lower the rider sits in the frame, the further ABOVE him the lens is
 * aimed, and the aim is what decides whether the horizon is in the picture at
 * all. At two thirds of the way down, a shot 25° below the horizontal still
 * has its horizon in the top fifth; at the middle of the frame the same shot
 * has nothing but water in it. It is also simply the better photograph. */
const SIDE_LOW = -0.62;

/** WHAT A BAND IS WORTH, against its own depth — because the room a card
 * leaves is not equally good everywhere, and in a shot that looks DOWN the
 * difference is large. Up the frame is the far distance: the rider is
 * smaller there, the haze is thicker, and he is inside the softening's own
 * ramp (`MENU_CAM.dream`). Down the frame is the near water, sharp and
 * close, and it is the better photograph besides — a subject low in the
 * frame with the sea running away above him.
 *
 * So the FLOOR is worth its whole depth, a side band very nearly so, and the
 * CEILING a little over half: a card has to leave nearly twice the room
 * above it as below before the rider is put up there at all. A phone held
 * upright with a tall card is exactly that case, and it was putting him in
 * the blur. */
const BAND_WORTH = { floor: 1, side: 0.95, ceiling: 0.55 };

/** How close to the edge of the frame the craft is ever put. A rider against
 * the glass reads as a mistake however much room the card left, and the haze
 * and the grade's own vignette live out there. */
const EDGE = 0.14;
/** ...and where he goes when there is no card at all (the attract card's own
 * cover is the whole screen, so there is no band to pick): low and a little
 * off to one side, which is where a drone operator would put him. */
const NO_CARD: ScreenPoint = { x: -0.42, y: -0.6 };

/** THE BAND THE CARD LEAVES, and the point in it the craft is held at.
 *
 * Four bands — left, right, below, above — each measured as the clear run
 * between the card's own edge and the edge of the frame, and each weighed by
 * what that part of the frame is WORTH to be in (`BAND_WORTH`). The best one
 * wins and the craft goes in the middle of it, pulled off the glass by
 * `EDGE`; the other axis is centred within whatever the card leaves on it,
 * so a band chosen at the side still sits low rather than dead level with
 * the card's middle.
 *
 * Pure, so `tests/camera_menu_test.ts` can hold it to the three reference
 * viewports without a browser or a renderer. */
export function anchorFor(card: ScreenBox | null, into?: ScreenPoint): ScreenPoint {
  const out = into ?? { x: 0, y: 0 };
  if (!card) {
    out.x = NO_CARD.x;
    out.y = NO_CARD.y;
    return out;
  }
  const bands = [
    { worth: (card.left + 1) * BAND_WORTH.side, x: (-1 + card.left) / 2, y: SIDE_LOW },
    { worth: (1 - card.right) * BAND_WORTH.side, x: (card.right + 1) / 2, y: SIDE_LOW },
    { worth: (card.bottom + 1) * BAND_WORTH.floor, x: -0.3, y: (-1 + card.bottom) / 2 },
    { worth: (1 - card.top) * BAND_WORTH.ceiling, x: -0.3, y: (card.top + 1) / 2 },
  ];
  let best = bands[0];
  for (const band of bands) if (band.worth > best.worth) best = band;
  out.x = clamp(best.x, -1 + EDGE, 1 - EDGE);
  out.y = clamp(best.y, -1 + EDGE, 1 - EDGE);
  return out;
}

/** The frame the shot is being composed in: how wide the window is against
 * its height, and the card standing over it. */
export type MenuFrame = { aspect: number; card: ScreenBox | null };

type Vec = { x: number; y: number; z: number };

const scratch: Vec = { x: 0, y: 0, z: 0 };
const right: Vec = { x: 1, y: 0, z: 0 };
const up: Vec = { x: 0, y: 1, z: 0 };

function normalise(v: Vec): void {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  v.x /= len;
  v.y /= len;
  v.z /= len;
}

/** THE FRAMING SOLVE: the direction the lens has to look so that a point
 * lying along `toTarget` from the eye lands at `at` in the frame.
 *
 * A camera looking along `f`, with its right `r` and its up `u`, puts a point
 * at frame position (sx, sy) when that point lies along `f + sx·tanX·r +
 * sy·tanY·u`. Turned round, the direction wanted is that expression solved
 * for `f` — but `r` and `u` are built from `f`, so it is solved by iteration
 * from the target's own direction, which converges in a couple of passes at
 * any framing a band can ask for. Iterating is also what makes it TESTABLE
 * the honest way: the test projects the craft back through the pose it got
 * and checks where it landed, rather than agreeing with this arithmetic.
 *
 * `r` is horizontal, as three's `lookAt` builds it from a world up — so the
 * roll applied afterwards (`pose.roll`) is a bank about a level frame, and a
 * couple of degrees of it moves nothing here worth solving for. */
export function aimFor(
  toTarget: Vec,
  at: ScreenPoint,
  fov: number,
  aspect: number,
  into: Vec,
): void {
  const { tanX, tanY } = frameTangents(fov, aspect);
  const sx = at.x * tanX;
  const sy = at.y * tanY;
  const scale = Math.hypot(sx, sy, 1);
  into.x = toTarget.x;
  into.y = toTarget.y;
  into.z = toTarget.z;
  normalise(into);
  scratch.x = into.x;
  scratch.y = into.y;
  scratch.z = into.z;
  for (let pass = 0; pass < 3; pass++) {
    // The lens's own right and up, built off the world's up exactly the way
    // three's `lookAt` builds them: RIGHT IS `forward × up`, not `up ×
    // forward`. The two differ by a sign and the sign is the whole shot — it
    // mirrors the frame, so a rider aimed into the left band lands in the
    // right one, which on a card is the band the menu is over. (`renderer.ts`
    // builds the same pair the same way for the lens's roll.)
    right.x = -into.z;
    right.y = 0;
    right.z = into.x;
    normalise(right);
    up.x = right.y * into.z - right.z * into.y;
    up.y = right.z * into.x - right.x * into.z;
    up.z = right.x * into.y - right.y * into.x;
    into.x = scratch.x - (sx * right.x + sy * up.x) / scale;
    into.y = scratch.y - (sx * right.y + sy * up.y) / scale;
    into.z = scratch.z - (sx * right.z + sy * up.z) / scale;
    normalise(into);
  }
}

/** WHICH WAY THE OPEN WATER LIES from a plan point, as a heading: a RING of
 * bearings sampled at the standoff the shot wants, answered with whichever
 * one is furthest from a shoreline (`Level.offshore` — metres from the
 * nearest shore, positive out to sea).
 *
 * A RING, AND NOT THE FIELD'S GRADIENT, and the difference is the whole
 * answer. The gradient is "away from the nearest land" measured over a couple
 * of metres, and a rider on a course sits in the MIDDLE of his channel, which
 * is a ridge of that field: the gradient there is a few centimetres of noise
 * pointing anywhere, and following it seventy metres lands on the skerry
 * across the way as often as not. (Measured: on three taiga seeds it pointed
 * inland on all three, and the first draft of this shot stood its lens in a
 * pine wood.) Asked at the distance the lens actually wants to stand, the
 * question answers itself and the noise is gone.
 *
 * `astern` is where the rider has been COMING FROM, averaged (the update
 * below), and a bearing near it is credited `MENU_CAM.asternPull` metres of
 * openness it does not have — so the lens prefers to trail his line, and
 * gives that preference up the moment the water disagrees strongly. Leave it
 * out and the ring answers the water alone.
 *
 * Coarse on purpose — the answer is eased onto and a drift of thirty-odd
 * degrees is laid over it, so a finer ring would be precision nothing spends. */
export function seawardFrom(
  level: Level,
  x: number,
  z: number,
  far = MENU_CAM.range,
  astern?: number,
): number {
  let best = level.seaHeading;
  let most = -Infinity;
  for (let i = 0; i < MENU_CAM.rays; i++) {
    const bearing = (i / MENU_CAM.rays) * Math.PI * 2;
    const out = sampleField(
      level.offshore,
      x + Math.sin(bearing) * far,
      z + Math.cos(bearing) * far,
    );
    const pull = astern === undefined ? 0 : Math.cos(bearing - astern) * MENU_CAM.asternPull;
    if (out + pull > most) {
      most = out + pull;
      best = bearing;
    }
  }
  return best;
}

/** HOW FAR OUT THE LENS MAY STAND on a bearing: the longest standoff, of the
 * ones tried, that puts the lens over water AND leaves nothing standing
 * between it and the rider.
 *
 * Searched from the furthest inwards, so what comes back is the longest clear
 * one rather than the first acceptable one — the difference between a shot
 * that opens out as the course leaves the coast and a shot that never does.
 * The sight line is checked at a handful of points against the ground plus a
 * wood's worth of cover: a skerry the lens clears by two metres is a skerry
 * whose pines are in the way.
 *
 * Nothing clear anywhere means the rider is somewhere no lens can stand off
 * from — a river gorge, a lead in the ice, the middle of a skerry field. The
 * second pass then asks only for water under the lens and gives up the clear
 * sight line, because a rider seen past the edge of a rock is a shot and a
 * lens INSIDE the rock is not; the shortest standoff is the answer only when
 * even that fails.
 *
 * Pure, so `tests/camera_menu_test.ts` can hold it over real shores. */
export function standoffFor(
  level: Level,
  x: number,
  z: number,
  craftY: number,
  bearing: number,
  lift: number,
  far = MENU_CAM.range,
): number {
  const ux = Math.sin(bearing);
  const uz = Math.cos(bearing);
  const near = Math.min(MENU_CAM.rangeMin, far);
  const span = far - near;
  const eyeY = craftY + lift;
  let afloat = 0;
  for (let step = 0; step < MENU_CAM.rangeSteps; step++) {
    const range = far - (span * step) / (MENU_CAM.rangeSteps - 1);
    const ex = x + ux * range;
    const ez = z + uz * range;
    if (bedAt(level, ex, ez) > -MENU_CAM.afloat) continue;
    if (afloat === 0) afloat = range;
    let clear = true;
    for (let i = 1; i < 5 && clear; i++) {
      const t = i / 5;
      const bx = ex + (x - ex) * t;
      const bz = ez + (z - ez) * t;
      clear = bedAt(level, bx, bz) + MENU_CAM.treeLine < eyeY + (craftY - eyeY) * t;
    }
    if (clear) return range;
  }
  return afloat || near;
}

export type MenuCamera = {
  /** Advance the shot and write the pose. `surfaceY` is the sea's height at a
   * plan point, the same function every outside rig is handed. */
  update: (
    pose: CameraPose,
    state: GameState,
    dt: number,
    surfaceY: (x: number, z: number) => number,
    frame: MenuFrame,
  ) => void;
  /** Forget the eased craft position: the next update composes the shot in
   * one frame rather than flying in from wherever the last run left it. */
  drop: () => void;
};

export function createMenuCamera(): MenuCamera {
  /** The clock the whole shot is composed on. Its OWN, not the run's: the
   * sea behind a card is restood every time a run is left, and a shot that
   * jumped back to its opening framing each time would announce it. */
  let t = 0;
  /** The craft's plan position, eased — see `MENU_CAM.follow`. */
  let heldX = 0;
  let heldZ = 0;
  let held = false;
  /** The base bearing and the standoff the lens has EASED onto, as against
   * the ones the water is offering this frame. Both are repositions rather
   * than framings, so both are flown to rather than taken. */
  let seaward = 0;
  let stand = MENU_CAM.range;
  /** The rider's own direction, heavily averaged — what the lens prefers to
   * stand astern of. Held through every stretch he is not making way in,
   * because a drifting hull's travel direction is the water's, not his. */
  let course = 0;
  let steered = false;
  /** ...and THE POINT THE SHOT IS COMPOSED ON: the craft, lagged and leashed
   * (`MENU_CAM.compose`). This is what the framing is solved against, and it
   * is why the rider moves within the frame instead of moving it. */
  const shown: Vec = { x: 0, y: 0, z: 0 };
  const eye: Vec = { x: 0, y: 0, z: 0 };
  const toCraft: Vec = { x: 0, y: 0, z: 0 };
  const look: Vec = { x: 0, y: 0, z: 1 };
  const at: ScreenPoint = { x: 0, y: 0 };

  return {
    drop: () => {
      held = false;
      // The averaged course goes with it: a shore that has just been stood
      // up has no history, and the last one's line is not this one's.
      steered = false;
    },
    update: (pose, state, dt, surfaceY, frame) => {
      const c = state.craft;
      t += dt;
      // THE FIRST FRAME OF A SHOT stands everything rather than easing onto
      // it: there is nothing to fly from, and a shot that eased onto its own
      // stand would open every visit by swinging into position from wherever
      // the last run happened to leave the numbers.
      const first = !held;
      if (first) {
        heldX = c.x;
        heldZ = c.z;
        shown.x = c.x;
        shown.y = c.y;
        shown.z = c.z;
        held = true;
      } else {
        const ease = clamp(MENU_CAM.follow * dt, 0, 1);
        heldX += (c.x - heldX) * ease;
        heldZ += (c.z - heldZ) * ease;
      }

      // THE RIDER'S AVERAGED COURSE. Read off his TRAVEL rather than his
      // heading — a hull is often carried across its own nose — and only
      // while he is making way, because a drifting hull's travel direction
      // is the orbital motion of the water under it.
      const pace = Math.hypot(c.vx, c.vz);
      if (pace > MENU_CAM.underway) {
        const travel = Math.atan2(c.vx, c.vz);
        course =
          steered && !first
            ? course + angleDiff(course, travel) * clamp(MENU_CAM.courseFollow * dt, 0, 1)
            : travel;
        steered = true;
      }

      // ...AND THE POINT THE SHOT IS COMPOSED ON: the craft on a slow ease,
      // then LEASHED back to within `leash` metres of where he actually is.
      // The ease is what takes the slam, the heave and the bot's twitch out
      // of the frame; the leash is what stops a rider who has simply ridden
      // away from being framed where he was a second ago.
      if (!first) {
        const ease = clamp(MENU_CAM.compose * dt, 0, 1);
        shown.x += (c.x - shown.x) * ease;
        shown.y += (c.y - shown.y) * ease;
        shown.z += (c.z - shown.z) * ease;
        const lagX = c.x - shown.x;
        const lagY = c.y - shown.y;
        const lagZ = c.z - shown.z;
        const lag = Math.hypot(lagX, lagY, lagZ);
        if (lag > MENU_CAM.leash) {
          const pull = 1 - MENU_CAM.leash / lag;
          shown.x += lagX * pull;
          shown.y += lagY * pull;
          shown.z += lagZ * pull;
        }
      }

      // WHICH WAY THE WATER LIES from where the rider is, eased onto: this
      // moves as the course leaves the coast and comes back to it, and a lens
      // that snapped round with it would be a cut.
      // HOW MUCH SHOT THIS SKY LEAVES — the whole reach, height and standoff
      // together, so the composition holds and only the range gives.
      const seen = MENU_CAM.flownIn[state.level.weather] ?? 1;
      const wantSeaward = seawardFrom(
        state.level,
        heldX,
        heldZ,
        MENU_CAM.range * seen,
        steered ? course + Math.PI : undefined,
      );
      seaward = first
        ? wantSeaward
        : seaward + angleDiff(seaward, wantSeaward) * clamp(MENU_CAM.bearingFollow * dt, 0, 1);

      // THE BEARING the lens stands off on, and the rate it is turning at —
      // the second read straight off the first's derivative, so the bank can
      // never disagree with the drift it is meant to be banking into.
      const drift =
        MENU_CAM.driftA * Math.sin(MENU_CAM.driftRateA * t) +
        MENU_CAM.driftB * Math.sin(MENU_CAM.driftRateB * t);
      const bearing = seaward + drift;
      const bearingRate =
        MENU_CAM.driftA * MENU_CAM.driftRateA * Math.cos(MENU_CAM.driftRateA * t) +
        MENU_CAM.driftB * MENU_CAM.driftRateB * Math.cos(MENU_CAM.driftRateB * t);

      const lift =
        (MENU_CAM.height + MENU_CAM.heightSway * Math.sin(MENU_CAM.heightRate * t)) * seen;
      // ...and HOW FAR OUT the water lets it stand on that bearing, eased the
      // same way and for the same reason.
      const wantStand = standoffFor(
        state.level,
        heldX,
        heldZ,
        c.y,
        bearing,
        lift,
        MENU_CAM.range * seen,
      );
      stand = first
        ? wantStand
        : stand + (wantStand - stand) * clamp(MENU_CAM.rangeFollow * dt, 0, 1);
      const range = stand + MENU_CAM.rangeSway * seen * Math.sin(MENU_CAM.rangeRate * t);

      eye.x = heldX + Math.sin(bearing) * range;
      eye.z = heldZ + Math.cos(bearing) * range;
      // The height is measured off the sea under the LENS rather than off the
      // craft's, because the stand is a hundred metres away and a shot hung
      // off a hull riding a swell is a shot that heaves.
      eye.y = surfaceY(eye.x, eye.z) + lift;
      // ...and it never goes into anything. `bedAt` is the shore as well as
      // the sea bed, so a drift that swings the lens in over a headland
      // simply lifts it over the headland.
      const floor = bedAt(state.level, eye.x, eye.z) + MENU_CAM.clearance;
      if (eye.y < floor) eye.y = floor;

      const fov = MENU_CAM.fov + MENU_CAM.fovSway * Math.sin(MENU_CAM.fovRate * t);
      // THE SHOT IS COMPOSED ON `shown`, NOT ON `c` — see the header and
      // `MENU_CAM.compose`. Everything else about the frame follows from
      // this one substitution.
      toCraft.x = shown.x - eye.x;
      toCraft.y = shown.y + MENU_CAM.aimUp - eye.y;
      toCraft.z = shown.z - eye.z;
      const reach = Math.hypot(toCraft.x, toCraft.y, toCraft.z) || 1;
      anchorFor(frame.card, at);
      aimFor(toCraft, at, fov, frame.aspect, look);

      // THE TREMOR, applied to the aim alone: a lens that is not quite still
      // rather than a machine that is not quite still, which is what a
      // stabilised gimbal on a drifting airframe actually gives.
      const shake =
        (MENU_CAM.shakeA * Math.sin(2 * Math.PI * MENU_CAM.shakeHzA * t) +
          MENU_CAM.shakeB * Math.sin(2 * Math.PI * MENU_CAM.shakeHzB * t)) *
        DEG;
      const tilt =
        (MENU_CAM.shakeA * Math.sin(2 * Math.PI * MENU_CAM.shakeHzB * t + 1.7) +
          MENU_CAM.shakeB * Math.sin(2 * Math.PI * MENU_CAM.shakeHzA * t + 0.4)) *
        DEG;

      pose.x = eye.x;
      pose.y = eye.y;
      pose.z = eye.z;
      pose.aimX = eye.x + (look.x + shake * look.z) * reach;
      pose.aimY = eye.y + (look.y + tilt) * reach;
      pose.aimZ = eye.z + (look.z - shake * look.x) * reach;
      pose.fov = fov;
      pose.roll = clamp(
        -bearingRate * MENU_CAM.bankPerRate * DEG,
        -MENU_CAM.bankMax * DEG,
        MENU_CAM.bankMax * DEG,
      );
    },
  };
}
